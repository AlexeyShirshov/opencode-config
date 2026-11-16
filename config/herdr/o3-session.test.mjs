import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import plugin from "./o3-session.js";

describe("Восстановление профиля O3 в Herdr", () => {
  for (const { label, resumeEnv, command } of [
    { label: "прямой O3", resumeEnv: undefined, command: ["o3", "agent", "opencode"] },
    { label: "oc-gp", resumeEnv: '["oc-gp"]', command: ["oc-gp"] },
    { label: "oc-dev", resumeEnv: '["oc-dev"]', command: ["oc-dev"] },
    { label: "произвольный профиль", resumeEnv: '["oc","customer-profile"]', command: ["oc", "customer-profile"] },
  ]) {
    test(`сохраняет ${label}, повторяет отклонённый отчёт и обновляет выбранную сессию`, async () => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "o3-herdr-"));
      const socketPath = path.join(dir, "api.sock");
      const previousEnv = { ...process.env };
      const reports = [];
      let selected = "ses_first";
      let status = "idle";
      let cleanup;
      const server = net.createServer((socket) => {
        let buffer = "";
        socket.on("data", (chunk) => {
          buffer += chunk.toString();
          if (!buffer.includes("\n")) return;
          const request = JSON.parse(buffer.split("\n")[0]);
          reports.push(request);
          const response = reports.length === 1
            ? { id: request.id, error: { code: "retry" } }
            : { id: request.id, result: { accepted: true } };
          socket.end(`${JSON.stringify(response)}\n`);
        });
      });
      try {
        await new Promise((resolve) => server.listen(socketPath, resolve));
        Object.assign(process.env, {
          HERDR_ENV: "1", HERDR_PANE_ID: "w1:p1",
          HERDR_SOCKET_PATH: socketPath,
        });
        delete process.env.O3_HERDR_RESUME_ARGV;
        if (resumeEnv !== undefined) process.env.O3_HERDR_RESUME_ARGV = resumeEnv;
        const api = {
          ui: { router: { current: () => ({ type: "session", sessionID: selected }) } },
          data: { session: {
            get: (id) => ({ id }), family: () => [], status: () => status,
            permission: { list: () => [] }, form: { list: () => [] },
          } },
        };
        cleanup = plugin.setup(api);
        await delay(700);
        assert.equal(reports.length, 2);
        assert.deepEqual(reports[1].params.resume_argv, [...command, "--session", "ses_first"]);
        assert.equal(reports[1].params.pane_id, "w1:p1");
        assert.equal(reports[1].params.source, "herdr:opencode");
        assert.equal(reports[1].method, "pane.report_agent_session");
        selected = "ses_second";
        status = "running";
        await delay(500);
        assert.deepEqual(reports.at(-1).params.resume_argv, [...command, "--session", "ses_second"]);
        assert.equal(reports.at(-1).params.state, undefined);
        assert.ok(reports.at(-1).params.seq > reports[1].params.seq);
      } finally {
        cleanup?.();
        process.env = previousEnv;
        await new Promise((resolve) => server.close(resolve));
        await rm(dir, { recursive: true, force: true });
      }
    });
  }

  test("не активируется вне Herdr", () => {
    const previous = process.env.HERDR_ENV;
    delete process.env.HERDR_ENV;
    try {
      assert.equal(plugin.setup({}), undefined);
    } finally {
      if (previous !== undefined) process.env.HERDR_ENV = previous;
    }
  });

  test("игнорирует небезопасную команду восстановления", () => {
    const previous = process.env.O3_HERDR_RESUME_ARGV;
    process.env.HERDR_ENV = "1";
    process.env.HERDR_PANE_ID = "w1:p1";
    process.env.HERDR_SOCKET_PATH = "/tmp/herdr.sock";
    process.env.O3_HERDR_RESUME_ARGV = '["oc-gp", "bad\\narg"]';
    try {
      assert.equal(plugin.setup({}), undefined);
    } finally {
      if (previous === undefined) delete process.env.O3_HERDR_RESUME_ARGV;
      else process.env.O3_HERDR_RESUME_ARGV = previous;
    }
  });

  test("подключён в TUI и получает профиль из launcher", async () => {
    const config = JSON.parse(await readFile(new URL("../tui.json", import.meta.url), "utf8"));
    assert.ok(config.plugin.includes(new URL("./o3-session.js", import.meta.url).href));
    const script = await readFile(new URL("../bin/oc", import.meta.url), "utf8");
    assert.ok(script.includes('export O3_HERDR_RESUME_ARGV="[\\"oc\\",\\"$profile\\"]"'));
  });
});
