import { openSync, writeSync } from "node:fs"

const ICONS = { busy: "⏳", question: "❓", permission: "🔔", idle: "✅" }
const MAX_TITLE = 40

const prompts = new Map()
const titles = new Map()
const roles = new Map()
const partText = new Map()
const icons = new Map()

let tty

function setTerminalTitle(text) {
  const sequence = `\u001b]2;${text}\u0007`
  if (tty === undefined) {
    try {
      tty = openSync("/dev/tty", "w")
    } catch {
      tty = null
    }
  }
  try {
    if (tty !== null) {
      writeSync(tty, sequence)
      return
    }
  } catch {
    tty = null
  }
  try {
    process.stdout.write(sequence)
  } catch {}
}

function label(sessionID) {
  const source = prompts.get(sessionID) ?? titles.get(sessionID)
  if (!source) return "OC"
  const oneLine = source.replace(/\s+/g, " ").trim()
  if (!oneLine) return "OC"
  const clipped = oneLine.length > MAX_TITLE ? `${oneLine.slice(0, MAX_TITLE - 1)}…` : oneLine
  return `OC | ${clipped}`
}

function apply(icon, sessionID) {
  if (!sessionID) return
  icons.set(sessionID, icon)
  setTerminalTitle(`${icon} ${label(sessionID)}`)
}

function setPrompt(sessionID, text) {
  if (!sessionID || !text) return
  prompts.set(sessionID, text)
  const icon = icons.get(sessionID)
  if (icon) apply(icon, sessionID)
}

export const TerminalTitlePlugin = async () => {
  return {
    event: async ({ event }) => {
      const properties = event.properties ?? {}
      const sessionID = properties.sessionID

      switch (event.type) {
        case "session.created":
        case "session.updated":
          if (sessionID && properties.info?.title) {
            titles.set(sessionID, properties.info.title)
            const icon = icons.get(sessionID)
            if (icon && !prompts.has(sessionID)) apply(icon, sessionID)
          }
          return

        case "message.updated": {
          const info = properties.info
          if (!info?.id) return
          roles.set(info.id, info.role)
          if (info.role === "user" && partText.has(info.id)) {
            setPrompt(info.sessionID ?? sessionID, partText.get(info.id))
          }
          return
        }

        case "message.part.updated": {
          const part = properties.part
          if (part?.type !== "text" || part.synthetic || part.ignored) return
          partText.set(part.messageID, part.text)
          if (roles.get(part.messageID) === "user") {
            setPrompt(part.sessionID ?? sessionID, part.text)
          }
          return
        }

        case "session.status":
          if (properties.status?.type === "idle") apply(ICONS.idle, sessionID)
          else if (properties.status?.type === "busy") apply(ICONS.busy, sessionID)
          return

        case "session.idle":
          apply(ICONS.idle, sessionID)
          return

        case "question.asked":
          apply(ICONS.question, sessionID)
          return

        case "permission.asked":
          apply(ICONS.permission, sessionID)
          return

        case "question.replied":
        case "question.rejected":
        case "permission.replied":
          apply(ICONS.busy, sessionID)
          return
      }
    },
  }
}
