import { appendFileSync } from "node:fs"

const DEBUG_LOG = "/tmp/opencode/btw-context.log"
const DEBUG = process.env.BTW_CONTEXT_DEBUG === "1"
const COMMAND = process.env.BTW_COMMAND ?? "btw"
const ALL_TASKS = process.env.BTW_ALL_TASKS === "1"
const MAX_MESSAGES = Number(process.env.BTW_MAX_MESSAGES ?? 80)
const MAX_CHARS = Number(process.env.BTW_MAX_CHARS ?? 16000)
const SUMMARY_TIMEOUT_MS = Number(process.env.BTW_SUMMARY_TIMEOUT_MS ?? 45000)
const SUMMARY_MODEL = process.env.BTW_SUMMARY_MODEL
const SUMMARY_DISABLED = process.env.BTW_SUMMARY_DISABLED === "1"

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

function unwrap(res) {
  return res?.data ?? res
}

function sanitize(text) {
  return String(text).replace(REF, "@\ufeff")
}

function partLine(part) {
  if (part?.type === "text") {
    if (part.synthetic || part.ignored) return ""
    return (part.text ?? "").trim()
  }
  if (part?.type === "tool") {
    const state = part.state ?? {}
    const detail =
      state.title ||
      state.input?.description ||
      state.input?.filePath ||
      state.input?.pattern ||
      state.input?.command ||
      ""
    const oneLine = String(detail).replace(/\s+/g, " ").trim().slice(0, 200)
    return oneLine ? `[tool ${part.tool}] ${oneLine}` : `[tool ${part.tool}]`
  }
  return ""
}

function buildTranscript(messages, maxChars) {
  const sorted = [...messages].sort(
    (a, b) => (a?.info?.time?.created ?? 0) - (b?.info?.time?.created ?? 0),
  )
  const lines = []
  for (const entry of sorted) {
    const role = entry?.info?.role
    if (role !== "user" && role !== "assistant") continue
    const body = (entry.parts ?? []).map(partLine).filter(Boolean).join("\n").trim()
    if (!body) continue
    lines.push(`${role === "user" ? "User" : "Assistant"}:\n${body}`)
  }
  let text = lines.join("\n\n")
  if (maxChars > 0 && text.length > maxChars) text = text.slice(text.length - maxChars)
  return text
}

function lastModel(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const info = messages[i]?.info
    if (info?.role === "assistant" && info.providerID && info.modelID) {
      return { providerID: info.providerID, modelID: info.modelID }
    }
  }
  return undefined
}

function parseModel(value) {
  if (!value) return undefined
  const index = value.indexOf("/")
  if (index < 1 || index === value.length - 1) return undefined
  return { providerID: value.slice(0, index), modelID: value.slice(index + 1) }
}

async function summarize(client, parentID, transcript, model) {
  const created = await client.session.create({
    body: { parentID, title: "btw: сжатие контекста" },
  })
  const session = unwrap(created)
  const id = session?.id
  if (!id) throw new Error("failed to create summary session")
  try {
    const body = {
      system: SUMMARY_SYSTEM,
      tools: { "*": false },
      parts: [{ type: "text", text: `Транскрипт:\n\n${transcript}` }],
    }
    if (model) body.model = model
    const res = await withTimeout(client.session.prompt({ path: { id }, body }), SUMMARY_TIMEOUT_MS)
    const out = unwrap(res)
    const text = (out?.parts ?? [])
      .filter((part) => part?.type === "text" && !part.synthetic)
      .map((part) => part.text)
      .join("\n")
      .trim()
    if (!text) throw new Error("empty summary")
    return text
  } finally {
    try {
      await client.session.delete({ path: { id } })
    } catch (error) {
      debug(`delete summary session failed: ${error.message}`)
    }
  }
}

debug("plugin loaded")

export const BtwContextPlugin = async ({ client }) => {
  return {
    "tool.execute.before": async (input, output) => {
      try {
        if (input.tool !== "task") return
        const args = output?.args
        if (!args || typeof args.prompt !== "string" || !args.prompt.trim()) return
        if (!ALL_TASKS && args.command !== COMMAND) return

        const listed = await withTimeout(
          client.session.messages({ path: { id: input.sessionID }, query: { limit: MAX_MESSAGES } }),
          10000,
        )
        const messages = unwrap(listed)
        if (!Array.isArray(messages) || messages.length === 0) return

        const transcript = buildTranscript(messages, MAX_CHARS)
        if (!transcript.trim()) return

        let summary = transcript
        if (!SUMMARY_DISABLED) {
          try {
            summary = await summarize(client, input.sessionID, transcript, parseModel(SUMMARY_MODEL) ?? lastModel(messages))
          } catch (error) {
            debug(`summarize failed, using truncated transcript: ${error.message}`)
          }
        }

        const header = "## Контекст основной сессии (сжато автоматически)\n"
        args.prompt = `${header}${sanitize(summary)}\n\n---\n\n${args.prompt}`
        debug(`injected context into task command=${args.command ?? "-"} chars=${summary.length}`)
      } catch (error) {
        debug(`hook failed: ${error.stack || error.message}`)
      }
    },
  }
}
