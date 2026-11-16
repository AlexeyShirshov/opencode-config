// Run directly: node config/herdr/session.tui.test.mjs.
// No live Herdr socket: exercise its wire replies and the V2 TUI API.
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { EventEmitter } from "node:events";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const originalEnv = { ...process.env };
const originalNow = Date.now;
const dir = mkdtempSync(path.join(os.tmpdir(), "o3-herdr-tui-"));
const reports = [];
let cleanup;
let reject = true;
// The real pane already belongs to the native OpenCode integration.
let owner = "herdr:opencode";
globalThis.herdrTestNet = { createConnection() {
  const socket = new EventEmitter();
  socket.destroy = () => queueMicrotask(() => socket.emit("close"));
  socket.write = (line) => {
    const request = JSON.parse(line);
    reports.push(request);
    const accepted = !reject;
    reject = false;
    let error;
    if (accepted && request.params.resume_argv && owner !== request.params.source) {
      error = { code: "resume_not_accepted" };
    }
    queueMicrotask(() => socket.emit("data", Buffer.from(JSON.stringify({
      id: request.id, ...(error ? { error } : { result: { accepted } }),
    }) + "\n")));
  };
  queueMicrotask(() => socket.emit("connect"));
  return socket;
} };

try {
  Object.assign(process.env, {
    HERDR_ENV: "1", HERDR_PANE_ID: "w5:p1", HERDR_SOCKET_PATH: "/test.sock",
    OPENCODE_HERDR_RESUME_ARGV: '["bash","-ic","oc-gp \\"$@\\"","--"]', XDG_STATE_HOME: dir,
  });
  const source = readFileSync(new URL("./tui.js", import.meta.url), "utf8")
    .replace('import net from "node:net";', "const net = globalThis.herdrTestNet;");
  const { default: plugin } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
  let route = { type: "session", sessionID: "ses_root" };
  const sessions = new Map([
    ["ses_root", { id: "ses_root" }],
    ["ses_child", { id: "ses_child", parentID: "ses_root" }],
    ["ses_other", { id: "ses_other" }],
  ]);
  const listeners = new Map();
  const api = {
    ui: { router: { current: () => route } },
    data: { session: {
      get: (id) => sessions.get(id),
    } },
    event: { on(type, callback) {
      listeners.set(type, callback);
      return () => listeners.delete(type);
    } },
  };
  cleanup = plugin.setup(api);
  await delay(700);
  assert.equal(reports.length, 2, "retry result.accepted=false");
  assert.deepEqual(reports.at(-1).params.resume_argv, ["bash", "-ic", 'oc-gp "$@"', "--", "--session", "ses_root"]);
  assert.equal(reports.at(-1).params.source, "herdr:opencode");
  assert.equal(reports.at(-1).params.agent, "opencode");
  assert.equal(reports.at(-1).method, "pane.report_agent_session");
  assert.equal(reports.at(-1).params.session_start_source, "select");
  assert.equal(reports.at(-1).params.state, undefined);
  assert.equal(reports.at(-1).params.source, owner, "do not compete with the native OpenCode owner");
  console.log("PASS current TUI entry + oc-gp resume command + rejected-report retry");

  route = { type: "session", sessionID: "ses_child" };
  await delay(550);
  assert.equal(reports.at(-1).params.agent_session_id, "ses_root");
  console.log("PASS descendants preserve root session + native ownership");

  route = { type: "session", sessionID: "ses_other" };
  await delay(550);
  assert.deepEqual(reports.at(-1).params.resume_argv, ["bash", "-ic", 'oc-gp "$@"', "--", "--session", "ses_other"]);
  const count = reports.length;
  Date.now = () => originalNow() + 6000;
  await delay(550);
  assert.ok(reports.length > count, "refresh unchanged report after server/ownership reset");
  assert.equal(owner, "herdr:opencode");
  assert.ok(reports.at(-1).params.resume_argv);
  Date.now = originalNow;
  cleanup(); cleanup = undefined;
  const stopped = reports.length;
  await delay(550);
  assert.equal(reports.length, stopped);
  assert.equal(listeners.size, 0);
  const events = readFileSync(path.join(dir, "opencode-herdr/session.jsonl"), "utf8")
    .trim().split("\n").map(JSON.parse);
  assert.ok(events.some((event) => event.event === "started"));
  assert.ok(events.some((event) => event.event === "error"));
  assert.ok(events.some((event) => event.event === "accepted"));
  console.log("PASS selection changes + heartbeat + disposal + diagnostic log");
} finally {
  cleanup?.();
  Date.now = originalNow;
  process.env = originalEnv;
  delete globalThis.herdrTestNet;
  rmSync(dir, { recursive: true, force: true });
}
