// zen-cache-proxy — минимальный реверс-прокси перед OpenCode Zen (opencode.ai/zen/v1).
//
// Зачем: opencode отправляет Opus-запросы на Zen в формате Anthropic Messages
// (`POST /v1/messages`) с `cache_control: { type: "ephemeral" }` без `ttl`, что даёт
// 5-минутный prompt-cache. Если ход оркестратора ждёт субагента 5–10 мин, кэш
// протухает и весь контекст перезаписывается по цене cache_write ($5/M у Opus 5.5).
// Прокси добавляет `ttl: "1h"` к каждому ephemeral-блоку, и вместо перезаписи
// идёт дешёвое чтение кэша ($0.2/M).
//
// Запуск (обычно поднимается автоматически из алиаса oc-dev):
//   PORT=8787 REWRITE=ttl bun zen-cache-proxy.mjs
//
// ENV:
//   UPSTREAM    апстрим                       (default https://opencode.ai/zen/v1)
//   PORT        порт прослушивания            (default 8787)
//   REWRITE     none | ttl | add              (default ttl; add = ещё и инжектить блок)
//   LOG         1 — дампить тела запросов в CAPTURE_DIR (по умолчанию выключено)
//   CAPTURE_DIR каталог дампа/лога            (default /tmp/opencode/zen-capture)
//
// Ключи не хранятся: заголовки авторизации клиента (x-api-key / Authorization)
// проксируются как есть. Порт слушает только 127.0.0.1.
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";

const UPSTREAM = (process.env.UPSTREAM || "https://opencode.ai/zen/v1").replace(/\/+$/, "");
const PORT = Number(process.env.PORT || 8787);
const REWRITE = process.env.REWRITE || "ttl";
const LOG = process.env.LOG === "1";
const CAPTURE_DIR = process.env.CAPTURE_DIR || "/tmp/opencode/zen-capture";

if (LOG) mkdirSync(CAPTURE_DIR, { recursive: true });
let seq = 0;
const logline = (s) => { if (LOG) appendFileSync(`${CAPTURE_DIR}/proxy.log`, s + "\n"); };
const safeJson = (t) => { if (typeof t !== "string") return t; try { return JSON.parse(t); } catch { return null; } };

// Ставит ttl:"1h" всем ephemeral-блокам cache_control. Возвращает число правок.
function rewriteTtl(obj) {
  let n = 0;
  const walk = (o) => {
    if (Array.isArray(o)) { for (const v of o) walk(v); return; }
    if (o && typeof o === "object") {
      const cc = o.cache_control;
      if (cc && typeof cc === "object" && cc.type === "ephemeral" && cc.ttl !== "1h") {
        cc.ttl = "1h";
        n++;
      }
      for (const k of Object.keys(o)) walk(o[k]);
    }
  };
  walk(obj);
  return n;
}

// Добавляет ephemeral+1h на последний content-блок последнего сообщения (если блоков нет).
function addCacheControl(obj) {
  const msgs = obj?.messages;
  const last = Array.isArray(msgs) ? msgs[msgs.length - 1] : null;
  if (!last) return 0;
  const content = last.content;
  if (Array.isArray(content) && content.length) {
    content[content.length - 1].cache_control = { type: "ephemeral", ttl: "1h" };
    return 1;
  }
  if (typeof content === "string") {
    last.content = [{ type: "text", text: content, cache_control: { type: "ephemeral", ttl: "1h" } }];
    return 1;
  }
  return 0;
}

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  // idleTimeout: 0 — иначе Bun закрывает соединение после ~10 с без байтов.
  // Opus 5.5 штатно «молчит» дольше (thinking / TTFB / ожидание tool-call), и
  // SSE-стрим рвётся в mid-stream → opencode видит "socket connection was closed
  // unexpectedly" и ретраит. 0 = не закрывать по простою.
  idleTimeout: 0,
  async fetch(req) {
    const id = String(++seq).padStart(4, "0");
    const url = new URL(req.url);
    if (url.pathname === "/__health") return new Response("ok", { status: 200 });
    const path = url.pathname.replace(/^\/v1(?=\/|$)/, "");
    const target = UPSTREAM + path + url.search;

    let bodyText = null;
    if (req.method !== "GET" && req.method !== "HEAD") bodyText = await req.text();

    const fwd = new Headers(req.headers);
    fwd.delete("host");
    fwd.delete("content-length");
    fwd.delete("accept-encoding");
    fwd.set("host", new URL(UPSTREAM).host);

    if (bodyText && REWRITE !== "none") {
      const j = safeJson(bodyText);
      if (j !== null && typeof j === "object") {
        let n = 0;
        if (REWRITE === "ttl" || REWRITE === "add") n += rewriteTtl(j);
        if (REWRITE === "add") n += addCacheControl(j);
        if (n > 0) {
          bodyText = JSON.stringify(j);
          logline(`${id} rewrite=${REWRITE} changed=${n} path=${path}`);
          if (LOG) writeFileSync(`${CAPTURE_DIR}/${id}-rewritten${path.replace(/\//g, "_")}.json`, JSON.stringify(j, null, 2));
        }
      }
    }

    if (LOG && bodyText) {
      const red = Object.fromEntries([...req.headers.entries()].map(([k, v]) =>
        [k, /authorization|api-key|cookie/i.test(k) ? v.slice(0, 12) + "…" : v]));
      writeFileSync(`${CAPTURE_DIR}/${id}-${req.method}${path.replace(/\//g, "_")}.json`,
        JSON.stringify({ url: target, headers: red, body: safeJson(bodyText) ?? bodyText }, null, 2));
    }

    let down;
    try {
      down = await fetch(target, { method: req.method, headers: fwd, body: bodyText ?? undefined });
    } catch (e) {
      logline(`${id} ${req.method} ${path} -> 502 ${e?.message ?? e}`);
      return new Response(JSON.stringify({ error: { type: "proxy_error", message: String(e?.message ?? e) } }),
        { status: 502, headers: { "content-type": "application/json" } });
    }
    logline(`${id} ${req.method} ${path} -> ${down.status}`);
    const out = new Headers(down.headers);
    out.delete("content-encoding");
    out.delete("content-length");
    // hop-by-hop: Bun сам управляет фреймингом стрима, заголовки апстрима не нужны
    out.delete("transfer-encoding");
    out.delete("connection");
    out.delete("keep-alive");
    return new Response(down.body, { status: down.status, headers: out });
  },
});

console.error(`zen-cache-proxy http://127.0.0.1:${PORT} -> ${UPSTREAM} (REWRITE=${REWRITE} LOG=${LOG ? 1 : 0})`);
