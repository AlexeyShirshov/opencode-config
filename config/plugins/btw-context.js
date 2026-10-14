// Injects a condensed copy of the parent session context into a `/btw` run.
//
// V2 rewrite of the V1 plugin:
//  - the `task` tool is now `subagent` and a `subagent: true` command runs in a
//    server-created child session, so there is no `args.command` to match. The
//    trigger is the child session's agent id instead (`agents/btw.md`).
//  - the parent transcript is read with `ctx.session.context()`, summarization
//    uses the transient `ctx.generate.text()`, and the digest is prepended to
//    the child's first prompt through the `prompt` hook — that hook edits the
//    canonical persisted user input, so the child sees the context on every
//    step (the V1 plugin mutated the tool args the same way).

import { appendFileSync } from "node:fs"

const DEBUG_LOG = "/tmp/opencode/btw-context.log"
const DEBUG = process.env.BTW_CONTEXT_DEBUG === "1"
const AGENT = process.env.BTW_AGENT ?? "btw"
const ALL_CHILDREN = process.env.BTW_ALL_CHILDREN === "1"
const MAX_MESSAGES = Number(process.env.BTW_MAX_MESSAGES ?? 80)
const MAX_CHARS = Number(process.env.BTW_MAX_CHARS ?? 16000)
const SUMMARY_TIMEOUT_MS = Number(process.env.BTW_SUMMARY_TIMEOUT_MS ?? 45000)
const SUMMARY_MODEL = process.env.BTW_SUMMARY_MODEL
const SUMMARY_DISABLED = process.env.BTW_SUMMARY_DISABLED === "1"

const HEADER = "## Контекст основной сессии (сжато автоматически)\n"
const MARKER = "Контекст основной сессии"

const SUMMARY_SYSTEM = [
  "Ты — компонент сжатия контекста.",
  "На вход дан транскрипт диалога основного агента с пользователем.",
  "Составь компактную выжимку (не более ~300 слов): текущая задача и её статус,",
  "ключевые решения, важные детали, изменённые файлы, незавершённые шаги.",
  "Пиши на языке диалога. Не вызывай инструменты. Выведи только выжимку.",
].join(" ")

const REF = /(?<![\w`])@/g

function debug(line) {
  if (!DEBUG) return
  try {
    appendFileSync(DEBUG_LOG, `${new Date().toISOString()} ${line}\n`)
  } catch {}
}

function withTimeout(promise, ms) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
    if (typeof timer.unref === "function") timer.unref()
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function unwrap(value) {
  if (value && typeof value === "object" && "data" in value) return value.data
  return value
}

function sanitize(text) {
  return String(text).replace(REF, "@\ufeff")
}

function partLine(part) {
  if (part?.type === "text") {
    if (part.synthetic || part.ignored) return ""
    return String(part.text ?? "").trim()
  }
  if (part?.type === "tool") {
    const name = part.name ?? part.tool ?? "tool"
    const input = part.input ?? part.state?.input ?? {}
    const detail =
      part.metadata?.title ||
      input.description ||
      input.path ||
      input.filePath ||
      input.pattern ||
      input.command ||
      ""
    const oneLine = String(detail).replace(/\s+/g, " ").trim().slice(0, 200)
    return oneLine ? `[tool ${name}] ${oneLine}` : `[tool ${name}]`
  }
  return ""
}

function buildTranscript(messages, maxChars, maxMessages) {
  const sorted = [...messages].sort((a, b) => (a?.time?.created ?? 0) - (b?.time?.created ?? 0))
  const recent = maxMessages > 0 && sorted.length > maxMessages ? sorted.slice(-maxMessages) : sorted
  const lines = []
  for (const entry of recent) {
    if (entry?.type === "user") {
      const body = String(entry.text ?? "").trim()
      if (body) lines.push(`User:\n${body}`)
      continue
    }
    if (entry?.type === "assistant") {
      const body = (entry.content ?? []).map(partLine).filter(Boolean).join("\n").trim()
      if (body) lines.push(`Assistant:\n${body}`)
    }
  }
  let text = lines.join("\n\n")
  if (maxChars > 0 && text.length > maxChars) text = text.slice(text.length - maxChars)
  return text
}

function lastModel(messages) {
  for (let index = messages.length - 1; index >= 0; index--) {
    const model = messages[index]?.model
    if (messages[index]?.type === "assistant" && model?.providerID && model?.id) return model
  }
  return undefined
}

function parseModel(value) {
  if (!value) return undefined
  const index = value.indexOf("/")
  if (index < 1 || index === value.length - 1) return undefined
  return { providerID: value.slice(0, index), id: value.slice(index + 1) }
}

async function summarize(ctx, transcript, model) {
  const prompt = `${SUMMARY_SYSTEM}\n\nТранскрипт:\n\n${transcript}`
  const input = model ? { prompt, model } : { prompt }
  const res = unwrap(await withTimeout(ctx.generate.text(input), SUMMARY_TIMEOUT_MS))
  const text = String(res?.text ?? "").trim()
  if (!text) throw new Error("empty summary")
  return text
}

async function hasMarker(event) {
  const text = event?.prompt?.text
  return typeof text === "string" && text.includes(MARKER)
}

export default {
  id: "btw-context",
  setup(ctx) {
    void ctx.session.hook("prompt", async (event) => {
      try {
        if (!event?.sessionID || (await hasMarker(event))) return

        const session = unwrap(await withTimeout(ctx.session.get({ sessionID: event.sessionID }), 10000))
        if (!session?.parentID) return
        if (!ALL_CHILDREN && session.agent !== AGENT) return

        const listed = await withTimeout(
          ctx.session.context({ sessionID: session.parentID }),
          10000,
        )
        const messages = unwrap(listed)
        if (!Array.isArray(messages) || messages.length === 0) return

        const transcript = buildTranscript(messages, MAX_CHARS, MAX_MESSAGES)
        if (!transcript.trim()) return

        let summary = transcript
        if (!SUMMARY_DISABLED) {
          try {
            summary = await summarize(ctx, transcript, parseModel(SUMMARY_MODEL) ?? lastModel(messages) ?? session.model)
          } catch (error) {
            debug(`summarize failed, using truncated transcript: ${error.message}`)
          }
        }

        event.prompt.text = `${HEADER}${sanitize(summary)}\n\n---\n\n${event.prompt.text}`
        debug(`injected context into session=${event.sessionID} agent=${session.agent} chars=${summary.length}`)
      } catch (error) {
        debug(`hook failed: ${error?.stack || error?.message || error}`)
      }
    })
  },
}
