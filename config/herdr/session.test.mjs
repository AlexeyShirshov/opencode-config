import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import plugin from "./tui.js";

describe("Восстановление профиля OpenCode в Herdr", () => {
  for (const { label, resumeEnv, command } of [
    { label: "прямой OpenCode", resumeEnv: undefined, command: ["opencode"] },
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
        process.env.XDG_STATE_HOME = dir;
        delete process.env.OPENCODE_HERDR_RESUME_ARGV;
        if (resumeEnv !== undefined) process.env.OPENCODE_HERDR_RESUME_ARGV = resumeEnv;
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
        assert.equal(reports.at(-1).params.seq, undefined);
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
    const previous = { ...process.env };
    process.env.HERDR_ENV = "1";
    process.env.HERDR_PANE_ID = "w1:p1";
    process.env.HERDR_SOCKET_PATH = "/tmp/herdr.sock";
    process.env.OPENCODE_HERDR_RESUME_ARGV = '["oc-gp", "bad\\narg"]';
    try {
      assert.equal(plugin.setup({}), undefined);
    } finally {
      process.env = previous;
    }
  });

  test("подключён в TUI и получает профиль из launcher", async () => {
    const config = await readFile(new URL("../cli.json", import.meta.url), "utf8");
    assert.match(config, /"\.\/herdr"/);
    const script = await readFile(new URL("../../home/.bash_aliases", import.meta.url), "utf8");
    assert.match(script, /OPENCODE_HERDR_RESUME_ARGV=.*oc-gp/);
    assert.match(script, /OPENCODE_HERDR_RESUME_ARGV=.*oc-ds/);
  });

  test("bash восстанавливает функции обоих профилей с аргументами сессии", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "herdr-bash-"));
    try {
      await writeFile(path.join(dir, ".bashrc"),
        'oc-gp() { printf "%s\\n" gp "$@"; }\noc-ds() { printf "%s\\n" ds "$@"; }\n');
      for (const profile of ["gp", "ds"]) {
        const result = spawnSync("bash", ["-ic", `oc-${profile} "$@"`, "--", "--session", "ses_test"], {
          env: { ...process.env, HOME: dir }, encoding: "utf8",
        });
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout, `${profile}\n--session\nses_test\n`);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
