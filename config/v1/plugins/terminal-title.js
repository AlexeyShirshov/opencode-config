import { appendFileSync, openSync, writeSync } from "node:fs"

const STATE = { busy: "⏳", question: "❓", permission: "🔔", idle: "✅" }
const FILL = ["○", "◔", "◑", "◕", "●"]
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const MAX_TITLE = 40
const RENDER_MS = 150
const REASSERT_MS = 1000
const RECONCILE_MS = 2000
const FETCH_TIMEOUT_MS = 4000
const DEBUG_LOG = "/tmp/opencode/terminal-title.log"
const DEBUG = process.env.OPENCODE_TERMINAL_TITLE_DEBUG === "1"

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

const prompts = new Map()
const titles = new Map()
const roles = new Map()
const partText = new Map()
const states = new Map()
const used = new Map()
const frames = new Map()
const renderedAt = new Map()
const limits = new Map()
const todoLists = new Map()
const todoRevision = new Map()
const todoInflight = new Set()
const usageInflight = new Set()

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
  const clamped = Math.min(100, Math.max(0, pct))
  const index = Math.round((clamped / 100) * (FILL.length - 1))
  return FILL[index]
}

function usageTotal(tokens) {
  if (!tokens) return 0
  return (
    (tokens.input ?? 0) +
    (tokens.output ?? 0) +
    (tokens.reasoning ?? 0) +
    (tokens.cache?.read ?? 0) +
    (tokens.cache?.write ?? 0)
  )
}

function rememberUsage(sessionID, info) {
  const total = usageTotal(info?.tokens)
  if (!sessionID || total <= 0) return false
  used.set(sessionID, { used: total, providerID: info.providerID, modelID: info.modelID })
  return true
}

function todoPctFor(sessionID) {
  const todos = todoLists.get(sessionID)
  if (!todos || todos.length === 0) return undefined
  const done = todos.filter((todo) => todo.status === "completed").length
  return Math.round((done / todos.length) * 100)
}

function compose(sessionID) {
  const state = states.get(sessionID) ?? "idle"
  const todoPct = todoPctFor(sessionID)
  const ctxPct = pctFor(sessionID)
  const lead = state === "busy" ? SPINNER[frames.get(sessionID) ?? 0] : STATE[state]
  const progress = todoPct === undefined ? undefined : fillFor(todoPct)
  const context = ctxPct === undefined ? undefined : `(${ctxPct}%)`
  const text = label(sessionID)
  const parts = [lead, "|"]
  if (progress) parts.push(progress)
  if (context) parts.push(context)
  if (text) parts.push(text)
  return parts.join(" ")
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

// The todo list is normally pushed via todo.updated, but events can be missed
// or a fetch can race the event. Re-read on demand (session entry, periodic
// reconcile) and drop a response that a newer todo.updated already superseded.
async function refreshTodos(getClient, sessionID) {
  if (!sessionID || todoInflight.has(sessionID)) return
  todoInflight.add(sessionID)
  const revision = todoRevision.get(sessionID) ?? 0
  try {
    const res = await withTimeout(getClient().session.todo({ path: { id: sessionID } }), FETCH_TIMEOUT_MS)
    if ((todoRevision.get(sessionID) ?? 0) !== revision) return
    const todos = res?.data ?? res?.todos
    if (!Array.isArray(todos)) {
      debug("todo fetch: unexpected response shape")
      return
    }
    todoLists.set(sessionID, todos)
    render(sessionID)
  } catch (error) {
    debug(`todo fetch failed: ${error.message}`)
  } finally {
    todoInflight.delete(sessionID)
  }
}

// Token usage is only pushed via message.updated, so a resumed session has no
// context percentage until the next reply. Read the tail of the history; keep
// retrying on failure until some usage is known.
async function refreshUsage(getClient, sessionID) {
  if (!sessionID || usageInflight.has(sessionID) || used.has(sessionID)) return
  usageInflight.add(sessionID)
  try {
    const res = await withTimeout(
      getClient().session.messages({ path: { id: sessionID }, query: { limit: 10 } }),
      FETCH_TIMEOUT_MS,
    )
    if (used.has(sessionID)) return
    const messages = res?.data ?? res
    if (!Array.isArray(messages)) {
      debug("usage fetch: unexpected response shape")
      return
    }
    const assistant = [...messages].reverse().find((entry) => entry?.info?.role === "assistant")
    if (!assistant || !rememberUsage(sessionID, assistant.info)) return
    render(sessionID)
  } catch (error) {
    debug(`usage fetch failed: ${error.message}`)
  } finally {
    usageInflight.delete(sessionID)
  }
}

async function resumeLatest(getClient) {
  try {
    const res = await getClient().session.list()
    const sessions = res?.data ?? res
    if (!Array.isArray(sessions) || sessions.length === 0) return
    const latest = [...sessions].sort((a, b) => (b?.time?.updated ?? 0) - (a?.time?.updated ?? 0))[0]
    if (!latest?.id) return
    activeSession = latest.id
    if (latest.title) titles.set(latest.id, latest.title)
    if (!states.has(latest.id)) states.set(latest.id, "idle")
    await refreshTodos(getClient, latest.id)
    await refreshUsage(getClient, latest.id)
    render(latest.id)
  } catch (error) {
    debug(`resume failed: ${error.message}`)
  }
}

debug("plugin loaded")

export const TerminalTitlePlugin = async ({ client }) => {
  void loadLimits(() => client)
  void resumeLatest(() => client)

  const timer = setInterval(() => {
    if (activeSession && states.has(activeSession)) setTerminalTitle(compose(activeSession))
  }, REASSERT_MS)
  if (typeof timer.unref === "function") timer.unref()

  const reconcile = setInterval(() => {
    if (!activeSession) return
    void refreshTodos(() => client, activeSession)
    void refreshUsage(() => client, activeSession)
  }, RECONCILE_MS)
  if (typeof reconcile.unref === "function") reconcile.unref()

  return {
    dispose: async () => {
      clearInterval(timer)
      clearInterval(reconcile)
    },
    event: async ({ event }) => {
      const properties = event.properties ?? {}
      const sessionID = properties.sessionID ?? properties.part?.sessionID ?? properties.info?.sessionID
      if (sessionID && sessionID !== activeSession) {
        activeSession = sessionID
        void refreshTodos(() => client, sessionID)
        void refreshUsage(() => client, sessionID)
      }
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
          if (info.role === "assistant" && rememberUsage(info.sessionID ?? sessionID, info)) {
            render(info.sessionID ?? sessionID)
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

        case "todo.updated":
          if (sessionID && Array.isArray(properties.todos)) {
            todoRevision.set(sessionID, (todoRevision.get(sessionID) ?? 0) + 1)
            todoLists.set(sessionID, properties.todos)
            render(sessionID)
          }
          return

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
