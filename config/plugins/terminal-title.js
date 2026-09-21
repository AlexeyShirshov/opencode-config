import { appendFileSync, openSync, writeSync } from "node:fs"

const STATE = { busy: "⏳", question: "❓", permission: "🔔", idle: "✅" }
const FILL = ["○", "◔", "◑", "◕", "●"]
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const MAX_TITLE = 40
const RENDER_MS = 150
const REASSERT_MS = 1000
const DEBUG_LOG = "/tmp/opencode/terminal-title.log"
const DEBUG = process.env.OPENCODE_TERMINAL_TITLE_DEBUG === "1"

function debug(line) {
  if (!DEBUG) return
  try {
    appendFileSync(DEBUG_LOG, `${new Date().toISOString()} ${line}\n`)
  } catch {}
}

const prompts = new Map()
const titles = new Map()
const roles = new Map()
const partText = new Map()
const states = new Map()
const used = new Map()
const frames = new Map()
const renderedAt = new Map()
const limits = new Map()

let tty
let limitsPromise
let activeSession

function setTerminalTitle(text) {
  const sequence = `\u001b]2;${text}\u0007`
  if (tty === undefined) {
    try {
      tty = openSync("/dev/tty", "w")
      debug("opened /dev/tty")
    } catch (error) {
      tty = null
      debug(`open /dev/tty failed: ${error.message}`)
    }
  }
  try {
    if (tty !== null) {
      writeSync(tty, sequence)
      return
    }
  } catch (error) {
    tty = null
    debug(`write /dev/tty failed: ${error.message}`)
  }
  try {
    process.stdout.write(sequence)
  } catch (error) {
    debug(`write stdout failed: ${error.message}`)
  }
}

function label(sessionID) {
  const source = prompts.get(sessionID) ?? titles.get(sessionID)
  if (!source) return ""
  const oneLine = source.replace(/\s+/g, " ").trim()
  if (!oneLine) return ""
  return oneLine.length > MAX_TITLE ? `${oneLine.slice(0, MAX_TITLE - 1)}…` : oneLine
}

function limitFor(providerID, modelID) {
  return limits.get(`${providerID}/${modelID}`) ?? limits.get(modelID)
}

function pctFor(sessionID) {
  const entry = used.get(sessionID)
  if (!entry) return undefined
  const limit = limitFor(entry.providerID, entry.modelID)
  if (!limit) return undefined
  return Math.max(0, Math.round((entry.used / limit) * 100))
}

function fillFor(pct) {
  const index = Math.min(FILL.length - 1, Math.max(0, Math.floor(pct / 25)))
  return FILL[index]
}

function compose(sessionID) {
  const state = states.get(sessionID) ?? "idle"
  const pct = pctFor(sessionID)
  let lead
  if (state === "busy") {
    lead = `${pct === undefined ? STATE.busy : fillFor(pct)}${SPINNER[frames.get(sessionID) ?? 0]}`
  } else {
    lead = STATE[state]
  }
  const badge = pct === undefined ? "" : ` ${pct}%`
  const text = label(sessionID)
  return `${lead}${badge}${text ? ` | ${text}` : ""}`
}

function render(sessionID, advance = false) {
  if (!sessionID || !states.has(sessionID)) return
  const now = Date.now()
  if (advance) {
    if (now - (renderedAt.get(sessionID) ?? 0) < RENDER_MS) return
    frames.set(sessionID, ((frames.get(sessionID) ?? 0) + 1) % SPINNER.length)
  }
  renderedAt.set(sessionID, now)
  const title = compose(sessionID)
  debug(`render ${sessionID} -> ${title}`)
  setTerminalTitle(title)
}

function setState(sessionID, state) {
  if (!sessionID) return
  states.set(sessionID, state)
  if (state === "busy") frames.set(sessionID, 0)
  render(sessionID)
}

async function loadLimits(getClient) {
  if (limitsPromise) return limitsPromise
  limitsPromise = (async () => {
    try {
      const client = getClient()
      const res = await client.config.providers()
      const providers = res?.providers ?? res?.data?.providers ?? []
      for (const provider of providers) {
        for (const [modelID, model] of Object.entries(provider.models ?? {})) {
          const context = model?.limit?.context
          if (!context) continue
          limits.set(`${provider.id}/${modelID}`, context)
          if (!limits.has(modelID)) limits.set(modelID, context)
        }
      }
      debug(`limits loaded: ${limits.size}`)
      for (const sessionID of states.keys()) render(sessionID)
    } catch (error) {
      debug(`limits failed: ${error.message}`)
    }
    return limits
  })()
  return limitsPromise
}

debug("plugin loaded")

export const TerminalTitlePlugin = async ({ client }) => {
  void loadLimits(() => client)

  const timer = setInterval(() => {
    if (activeSession && states.has(activeSession)) setTerminalTitle(compose(activeSession))
  }, REASSERT_MS)
  if (typeof timer.unref === "function") timer.unref()

  return {
    dispose: async () => clearInterval(timer),
    event: async ({ event }) => {
      const properties = event.properties ?? {}
      const sessionID = properties.sessionID ?? properties.part?.sessionID ?? properties.info?.sessionID
      if (sessionID) activeSession = sessionID
      debug(`event ${event.type} session=${sessionID ?? "-"}`)

      switch (event.type) {
        case "session.created":
        case "session.updated":
          if (sessionID && properties.info?.title) {
            titles.set(sessionID, properties.info.title)
            if (!prompts.has(sessionID) && states.has(sessionID)) render(sessionID)
          }
          return

        case "message.updated": {
          const info = properties.info
          if (!info?.id) return
          roles.set(info.id, info.role)
          if (info.role === "user") {
            if (partText.has(info.id)) prompts.set(info.sessionID ?? sessionID, partText.get(info.id))
            return
          }
          if (info.role === "assistant" && info.tokens?.output > 0) {
            const t = info.tokens
            const total =
              (t.input ?? 0) + (t.output ?? 0) + (t.reasoning ?? 0) + (t.cache?.read ?? 0) + (t.cache?.write ?? 0)
            if (total > 0) {
              used.set(info.sessionID ?? sessionID, {
                used: total,
                providerID: info.providerID,
                modelID: info.modelID,
              })
              render(info.sessionID ?? sessionID)
            }
          }
          return
        }

        case "message.part.updated": {
          const part = properties.part
          if (!part) return
          if (part.type === "text" && !part.synthetic && !part.ignored) {
            partText.set(part.messageID, part.text)
            if (roles.get(part.messageID) === "user") prompts.set(part.sessionID ?? sessionID, part.text)
          }
          const target = part.sessionID ?? sessionID
          if (states.get(target) === "busy") render(target, true)
          return
        }

        case "session.status":
          if (properties.status?.type === "idle") setState(sessionID, "idle")
          else if (properties.status?.type === "busy") setState(sessionID, "busy")
          return

        case "session.idle":
          setState(sessionID, "idle")
          return

        case "question.asked":
          setState(sessionID, "question")
          return

        case "permission.asked":
          setState(sessionID, "permission")
          return

        case "question.replied":
        case "question.rejected":
        case "permission.replied":
          setState(sessionID, "busy")
          return
      }
    },
  }
}
