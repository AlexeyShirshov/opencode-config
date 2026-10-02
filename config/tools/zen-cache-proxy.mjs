// zen-cache-proxy — минимальный реверс-прокси перед OpenCode Zen (opencode.ai/zen/v1).
//
// Зачем: opencode отправляет запросы strong-тир модели на Zen в формате Anthropic Messages
// (`POST /v1/messages`) с `cache_control: { type: "ephemeral" }` без `ttl`, что даёт
// 5-минутный prompt-cache. Если ход оркестратора ждёт субагента 5–10 мин, кэш
// протухает и весь контекст перезаписывается по цене cache_write ($5/M у strong-тира).
// Прокси добавляет `ttl: "1h"` к каждому ephemeral-блоку, и вместо перезаписи
// идёт дешёвое чтение кэша ($0.2/M).
//
// WARM (опционально, по умолчанию ВЫКЛ): пока по /v1/messages нет новых запросов,
// переотправлять префикс последнего запроса с max_tokens:1. Смысл был только при
// 5-мин TTL; при ttl=1h/retention кэш не протухает, а прогрев лишь жжёт cache_read
// (замер: ~$0.0163/пинг, ~$0.29/ч, часами после закрытия сессий). Включается явно: WARM=1.
//
// Запуск (обычно поднимается автоматически из алиаса oc-ds):
//   PORT=8787 REWRITE=ttl bun zen-cache-proxy.mjs
//
// Для medium-тир модели, идущей через /v1/responses, ситуация иная: там cache_control
// нет, а TTL кэша задаётся полем prompt_cache_retention. opencode его не шлёт, поэтому
// действует короткий in-memory TTL (~5–10 мин) и после простоя оркестратор
// переписывает весь префикс (у замера — 80% всего cache_write). Прокси добавляет
// prompt_cache_retention: "24h" (единственное поддерживаемое значение для этой ветки API).
//
// ENV:
//   UPSTREAM    апстрим                       (default https://opencode.ai/zen/v1)
//   PORT        порт прослушивания            (default 8787)
//   REWRITE     none | ttl | add              (default ttl; add = ещё и инжектить блок)
//   RETENTION   значение prompt_cache_retention для /v1/responses; "" | none — off
//                                             (default 24h)
//   LOG         1 — дампить тела запросов в CAPTURE_DIR (по умолчанию выключено)
//   CAPTURE_DIR каталог дампа/лога            (default /tmp/opencode/zen-capture)
//   WARM        1 — включить прогрев кэша     (default 0 = выключен)
//   WARM_AFTER_MS  простой, после которого шлётся прогрев (default 180000 = 3 мин)
//   WARM_TIMEOUT_MS таймаут прогревающего запроса          (default 60000)
//
// WARM выключен по умолчанию: с cache_control ttl=1h (Anthropic) и
// prompt_cache_retention=24h (Responses) кэш и так переживает паузы, а прогрев
// лишь жёг cache_read каждые ~3 мин — в т.ч. часами по уже закрытым сессиям.
//
// Ключи не хранятся: заголовки авторизации клиента (x-api-key / Authorization)
// проксируются как есть. Порт слушает только 127.0.0.1.
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";

const UPSTREAM = (process.env.UPSTREAM || "https://opencode.ai/zen/v1").replace(/\/+$/, "");
const PORT = Number(process.env.PORT || 8787);
const REWRITE = process.env.REWRITE || "ttl";
const RETENTION = process.env.RETENTION ?? "24h"; // "" | "none" — выключить
const RETENTION_ON = RETENTION !== "" && RETENTION !== "none";
const LOG = process.env.LOG === "1";
const CAPTURE_DIR = process.env.CAPTURE_DIR || "/tmp/opencode/zen-capture";
const WARM = process.env.WARM === "1";
const WARM_AFTER_MS = Number(process.env.WARM_AFTER_MS || 180000);
const WARM_TIMEOUT_MS = Number(process.env.WARM_TIMEOUT_MS || 60000);

if (LOG) mkdirSync(CAPTURE_DIR, { recursive: true });
let seq = 0;
const logline = (s) => { if (LOG) appendFileSync(`${CAPTURE_DIR}/proxy.log`, s + "\n"); };
const safeJson = (t) => { if (typeof t !== "string") return t; try { return JSON.parse(t); } catch { return null; } };

// --- prompt-cache warm ------------------------------------------------------
// Помним последний cacheable-запрос к /v1/messages и, если по нему давно нет
// активности (оркестратор ждёт субагента), переотправляем его префикс с
// max_tokens:1. Кэш читается/освежается дёшево, полной перезаписи не случается.
// Сессию не трогаем — это отдельный запрос к тому же апстриму и ключу.
let last = null;       // { kind, target, headers, body, time }
let inFlight = 0;      // сколько реальных запросов сейчас летит на апстрим
let warming = false;

function warmOnce() {
  if (warming || !last || inFlight > 0) return;
  const ageMs = Date.now() - last.time;
  if (ageMs < WARM_AFTER_MS) return;
  warming = true;
  last.time = Date.now();
  void (async () => {
    let status = "?";
    try {
      const body = safeJson(last.body) ?? {};
      body.stream = false;
      if (last.kind === "responses") {
        body.max_output_tokens = 16; // у Responses минимум 16
      } else {
        body.max_tokens = 1;
        delete body.thinking; // max_tokens:1 несовместим с thinking
      }
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), WARM_TIMEOUT_MS);
      try {
        const res = await fetch(last.target, { method: "POST", headers: new Headers(last.headers), body: JSON.stringify(body), signal: ac.signal });
        status = res.status;
        await res.text();
      } finally {
        clearTimeout(timer);
      }
      logline(`warm idle=${Math.round(ageMs / 1000)}s -> ${status}`);
    } catch (e) {
      logline(`warm idle=${Math.round(ageMs / 1000)}s -> error ${e?.message ?? e}`);
    } finally {
      warming = false;
    }
  })();
}

if (WARM) {
  const tickMs = Math.max(15000, Math.min(30000, Math.floor(WARM_AFTER_MS / 2)));
  const timer = setInterval(warmOnce, tickMs);
  if (typeof timer.unref === "function") timer.unref();
}

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

// /v1/responses (medium-тир): cache_control нет, TTL задаётся prompt_cache_retention.
// Без него — короткий in-memory TTL и полная перезапись префикса после простоя.
function addResponsesRetention(obj, path) {
  if (path !== "/responses") return 0; // path уже без префикса /v1
  if (!RETENTION_ON) return 0;
  if (obj.prompt_cache_retention) return 0;
  obj.prompt_cache_retention = RETENTION;
  return 1;
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
  // strong-тир штатно «молчит» дольше (thinking / TTFB / ожидание tool-call), и
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
        n += addResponsesRetention(j, path);
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

    if (WARM && req.method === "POST") {
      if (path === "/messages" && bodyText?.includes('"cache_control"')) {
        last = { kind: "messages", target, headers: [...fwd.entries()], body: bodyText, time: Date.now() };
      } else if (path === "/responses" && !RETENTION_ON && bodyText?.includes('"prompt_cache_key"')) {
        // fallback: только если retention выключен (иначе прогрев не нужен)
        last = { kind: "responses", target, headers: [...fwd.entries()], body: bodyText, time: Date.now() };
      }
    }

    inFlight++;
    let down;
    try {
      down = await fetch(target, { method: req.method, headers: fwd, body: bodyText ?? undefined });
    } catch (e) {
      inFlight--;
      logline(`${id} ${req.method} ${path} -> 502 ${e?.message ?? e}`);
      return new Response(JSON.stringify({ error: { type: "proxy_error", message: String(e?.message ?? e) } }),
        { status: 502, headers: { "content-type": "application/json" } });
    }
    inFlight--;
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

console.error(`zen-cache-proxy http://127.0.0.1:${PORT} -> ${UPSTREAM} (REWRITE=${REWRITE} RETENTION=${RETENTION_ON ? RETENTION : "off"} LOG=${LOG ? 1 : 0} WARM=${WARM ? WARM_AFTER_MS + "ms" : "off"})`);
