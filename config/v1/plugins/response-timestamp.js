import { appendFileSync } from "node:fs"

const DEBUG_LOG = "/tmp/opencode/response-timestamp.log"
const DEBUG = process.env.RESPONSE_TIMESTAMP_DEBUG === "1"
const SHOW_DURATION = process.env.RESPONSE_TIMESTAMP_DURATION === "1"
const STAMP_TOOLS = process.env.RESPONSE_TIMESTAMP_TOOLS !== "0"
const STAMP_BASH = process.env.RESPONSE_TIMESTAMP_BASH !== "0"
const ICON = process.env.RESPONSE_TIMESTAMP_SUFFIX ?? ""
const BRACKETS = process.env.RESPONSE_TIMESTAMP_BRACKETS !== "0"
const LINK = process.env.RESPONSE_TIMESTAMP_LINK === "1"
const LINK_URL = process.env.RESPONSE_TIMESTAMP_LINK_URL ?? "#"
const TEXT_STYLE = (process.env.RESPONSE_TIMESTAMP_TEXT ?? "narrow").toLowerCase()
const SEP = process.env.RESPONSE_TIMESTAMP_SEP ?? " "
const POSITION = (process.env.RESPONSE_TIMESTAMP_POSITION ?? "start").toLowerCase() === "end" ? "end" : "start"

const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const TIME = "\\d{2}:\\d{2}:\\d{2}"
const CORE = `(?:\\[${TIME}\\]\\([^)\\s]*\\)|［${TIME}］|⟦${TIME}⟧|\\x60\\[${TIME}\\]\\x60|\\\\?\\[${TIME}\\\\?\\]|${TIME})`
const TOKEN = `${ICON ? `${escapeRe(ICON)} ` : ""}${CORE}`
const TOKEN_DUR = `${TOKEN}(?: \\([0-9hms ]+\\))?`
const LEADERS = [
  new RegExp(`^(?:${TOKEN}${escapeRe(SEP)})+`, "u"),
  new RegExp(`^(?:[ \\t]*${TOKEN_DUR}[ \\t]*\\n+)+`, "u"),
]
const TRAILERS = [
  new RegExp(`(?:${escapeRe(SEP)}${TOKEN_DUR})+\\s*$`, "u"),
  new RegExp(`(?:\\n+[ \\t]*${TOKEN_DUR}[ \\t]*)+\\s*$`, "u"),
]
const HAS_MARKER = new RegExp(TOKEN, "u")
const BASH_LINE = /^(?:# (?:\[\d{2}:\d{2}:\d{2}\]|\d{2}:\d{2}:\d{2})(?: \([0-9hms ]+\))?\n)+/

const messageStart = new Map()
const partStart = new Map()
const toolStart = new Map()

function debug(line) {
  if (!DEBUG) return
  try {
    appendFileSync(DEBUG_LOG, `${new Date().toISOString()} ${line}\n`)
  } catch {}
}

function strip(text) {
  let out = String(text)
  let prev
  do {
    prev = out
    for (const re of LEADERS) out = out.replace(re, "")
    for (const re of TRAILERS) out = out.replace(re, "")
  } while (out !== prev)
  return out
}

function stripLeading(text) {
  let out = String(text)
  let prev
  do {
    prev = out
    for (const re of LEADERS) out = out.replace(re, "")
  } while (out !== prev)
  return out
}

function pad(value) {
  return String(value).padStart(2, "0")
}

function clock(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function timeMark(date) {
  const value = clock(date)
  if (LINK) return `[${value}](${LINK_URL})`
  return BRACKETS ? `[${value}]` : value
}

function textMark(date) {
  const value = clock(date)
  if (LINK) return `[${value}](${LINK_URL})`
  if (!BRACKETS) return value
  if (TEXT_STYLE === "ascii") return `[${value}]`
  if (TEXT_STYLE === "code") return `\`[${value}]\``
  if (TEXT_STYLE === "wide") return `［${value}］`
  return `⟦${value}⟧`
}

function stamp(date) {
  return `${ICON ? `${ICON} ` : ""}${textMark(date)}`
}

function stampPlain(date) {
  return `${ICON ? `${ICON} ` : ""}${timeMark(date)}`
}


function human(ms) {
  if (!Number.isFinite(ms) || ms < 0) return ""
  const total = Math.round(ms / 1000)
  if (total < 60) return `${total}s`
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  if (minutes < 60) return `${minutes}m ${pad(seconds)}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${pad(minutes % 60)}m`
}

export const ResponseTimestampPlugin = async () => {
  return {
    event: async ({ event }) => {
      if (event.type === "message.updated") {
        const info = event.properties?.info
        if (info?.role === "assistant" && info.time?.created && !messageStart.has(info.id)) {
          messageStart.set(info.id, info.time.created)
        }
        return
      }
      if (event.type === "message.removed") {
        const id = event.properties?.messageID
        if (id) messageStart.delete(id)
        return
      }
      if (event.type === "message.part.updated") {
        const part = event.properties?.part
        if (part?.type === "text" && part.time?.start && !partStart.has(part.id)) {
          partStart.set(part.id, part.time.start)
        }
      }
    },
    "tool.execute.before": async (input, output) => {
      if (!STAMP_TOOLS) return
      if (input?.callID) toolStart.set(input.callID, Date.now())
      if (!STAMP_BASH || input?.tool !== "bash") return
      const args = output?.args
      if (!args || typeof args.command !== "string" || !args.command.trim()) return
      args.command = `# ${timeMark(new Date())}\n${args.command.replace(BASH_LINE, "")}`
    },
    "tool.execute.after": async (input, output) => {
      if (!STAMP_TOOLS || !output) return
      const start = toolStart.get(input.callID)
      toolStart.delete(input.callID)
      if (typeof output.title !== "string" || !output.title.trim()) return
      const now = Date.now()
      let marker = stampPlain(new Date(start ?? now))
      if (SHOW_DURATION && start) {
        const elapsed = human(now - start)
        if (elapsed) marker += ` (${elapsed})`
      }
      output.title = `${marker}${SEP}${stripLeading(output.title).replace(/^\s+/, "")}`
      debug(`tool=${input.tool} call=${input.callID} -> ${output.title}`)
    },
    "experimental.chat.messages.transform": async (_input, output) => {
      for (const message of output.messages ?? []) {
        for (const part of message?.parts ?? []) {
          if (part?.type === "text" && typeof part.text === "string" && HAS_MARKER.test(part.text)) {
            const cleaned = strip(part.text)
            if (cleaned !== part.text) part.text = cleaned
          }
        }
      }
    },
    "experimental.text.complete": async (input, output) => {
      const text = output.text ?? ""
      if (!text.trim()) return
      const start = partStart.get(input.partID) ?? messageStart.get(input.messageID)
      partStart.delete(input.partID)
      const stripped = strip(text)
      if (!stripped.trim()) {
        output.text = ""
        return
      }
      const now = Date.now()
      if (POSITION === "start") {
        const at = start ?? now
        output.text = `${stamp(new Date(at))}${SEP}${stripped.replace(/^\s+/, "")}`
        debug(`stamped-start message=${input.messageID} part=${input.partID} at=${clock(new Date(at))}`)
        return
      }
      let marker = stamp(new Date(now))
      if (SHOW_DURATION && start) {
        const elapsed = human(now - start)
        if (elapsed) marker += ` (${elapsed})`
      }
      output.text = `${stripped.replace(/\s+$/, "")}${SEP}${marker}`
      debug(`stamped-end message=${input.messageID} part=${input.partID} -> ${marker}`)
    },
  }
}
