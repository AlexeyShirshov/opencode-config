// Pane-local profile-aware session recovery for OpenCode V2 and Herdr.
import net from "node:net";
import { appendFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// TUI errors otherwise disappear into the terminal's hidden console.
const log = (event, details = {}) => {
  try {
    const dir = path.join(process.env.XDG_STATE_HOME || path.join(os.homedir(), ".local/state"), "opencode-herdr");
    mkdirSync(dir, { recursive: true });
    appendFileSync(path.join(dir, "session.jsonl"), JSON.stringify({
      time: new Date().toISOString(), pid: process.pid,
      pane: process.env.HERDR_PANE_ID, event, ...details,
    }) + "\n", { mode: 0o600 });
  } catch { /* Diagnostics must never prevent starting the TUI. */ }
};

const parseResumeCommand = () => {
  const raw = process.env.OPENCODE_HERDR_RESUME_ARGV;
  if (raw === undefined) return ["opencode"];
  try {
    const command = JSON.parse(raw);
    if (!Array.isArray(command) || command.length === 0 ||
        command.length > 62 || command.some((arg) => typeof arg !== "string" || /['\x00-\x1f\x7f]/.test(arg)) ||
        !/^[a-zA-Z0-9][a-zA-Z0-9._+-]*$/.test(command[0]) ||
        Buffer.byteLength(JSON.stringify([...command, "--session", "s".repeat(128)])) > 8192) return undefined;
    return command;
  } catch {
    return undefined;
  }
};

const plugin = {
  id: "opencode.herdr.session",
  setup(api) {
    const command = parseResumeCommand();
    const pane = process.env.HERDR_PANE_ID;
    const endpoint = process.env.HERDR_SOCKET_PATH;
    if (process.env.HERDR_ENV !== "1" || !pane || !endpoint || !command) return;
    log("started", { command });

    let disposed = false;
    let pending = false;
    let lastReport;
    let lastReportAt = 0;
    let lastError;
    const failed = (error) => {
      const message = String(error?.message ?? error);
      if (message !== lastError) log("error", { message });
      lastError = message;
    };
    let sequence = Date.now() * 1000;
    const sockets = new Set();

    const root = (id) => {
      const seen = new Set();
      while (id && !seen.has(id)) {
        seen.add(id);
        const session = api.data.session.get(id);
        if (!session) return;
        if (!session.parentID) return id;
        id = session.parentID;
      }
    };

    const report = async () => {
      if (disposed || pending) return;
      const route = api.ui.router.current();
      if (route.type !== "session") return;
      const sessionID = root(route.sessionID);
      if (!sessionID) return;

      const fingerprint = JSON.stringify([sessionID, command]);
      // Reassert ownership if another integration or a server restart cleared it.
      if (lastReport === fingerprint && Date.now() - lastReportAt < 5000) return;

      pending = true;
      sequence = Math.max(sequence + 1, Date.now() * 1000);
      const request = {
        id: `opencode-resume:${sequence}`,
        method: "pane.report_agent_session",
        params: {
          pane_id: pane,
          // Extend Herdr's OpenCode integration, not a different custom agent.
          // A foreign owner cannot replace an already saved OpenCode session.
          source: "herdr:opencode",
          agent: "opencode",
          session_start_source: "select",
          agent_session_id: sessionID,
          resume_argv: [...command, "--session", sessionID],
        },
      };
      try {
        const send = (request) => new Promise((resolve) => {
          let buffer = "";
          let settled = false;
          const socket = net.createConnection(endpoint);
          sockets.add(socket);
          const finish = (ok) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            sockets.delete(socket);
            socket.destroy();
            resolve(ok);
          };
          const timer = setTimeout(() => { failed("Herdr socket timeout"); finish(false); }, 500);
          timer.unref?.();
          socket.on("connect", () => socket.write(`${JSON.stringify(request)}\n`));
          socket.on("data", (chunk) => {
            buffer += chunk.toString();
            if (!buffer.includes("\n")) return;
            try {
              const reply = JSON.parse(buffer.split("\n")[0]);
              const ok = reply.id === request.id && !!reply.result && !reply.error && reply.result.accepted !== false;
              if (!ok) failed(JSON.stringify(reply.error ?? reply.result ?? "Unexpected Herdr response"));
              finish(ok);
            } catch {
              finish(false);
            }
          });
          socket.on("error", (error) => { failed(error); finish(false); });
          socket.on("close", () => finish(false));
        });
        const accepted = await send(request);
        if (accepted) {
          if (lastReport !== fingerprint || lastError) log("accepted", {
            sessionID, resume_argv: request.params.resume_argv,
          });
          lastError = undefined;
          lastReport = fingerprint;
          lastReportAt = Date.now();
        }
      } finally {
        pending = false;
      }
    };

    // Читаем выбранную сессию в TUI, а не глобальные события общего сервера.
    const tick = () => { void report().catch(failed); };
    const timer = setInterval(tick, 500);
    timer.unref?.();
    tick();
    return () => {
      disposed = true;
      clearInterval(timer);
      for (const socket of sockets) socket.destroy();
    };
  },
};

export default plugin;
