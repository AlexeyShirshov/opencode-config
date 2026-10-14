/** @jsxImportSource @opentui/solid */
import { createMemo, createSignal, For, Show } from "solid-js"
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"

type Todo = { content: string; status: string }

function Row(props: { theme: () => TuiPluginApi["theme"]["current"]; status: string; content: string }) {
  const color = () => (props.status === "in_progress" ? props.theme().warning : props.theme().textMuted)
  return (
    <box flexDirection="row" gap={0}>
      <text flexShrink={0} style={{ fg: color() }}>
        [{props.status === "completed" ? "✓" : props.status === "in_progress" ? "•" : " "}]{" "}
      </text>
      <text flexGrow={1} wrapMode="word" style={{ fg: color() }}>
        {props.content}
      </text>
    </box>
  )
}

function View(props: { api: TuiPluginApi; todos: () => Todo[] }) {
  const theme = () => props.api.theme.current
  const [open, setOpen] = createSignal(true)
  const list = createMemo(() => props.todos())
  const show = createMemo(() => list().length > 0 && list().some((item) => item.status !== "completed"))

  return (
    <Show when={show()}>
      <box>
        <box flexDirection="row" gap={1} onMouseDown={() => list().length > 2 && setOpen((value) => !value)}>
          <Show when={list().length > 2}>
            <text fg={theme().text}>{open() ? "▼" : "▶"}</text>
          </Show>
          <text fg={theme().text}>
            <b>Todo</b>
          </text>
        </box>
        <Show when={list().length <= 2 || open()}>
          <For each={list()}>{(item) => <Row theme={theme} status={item.status} content={item.content} />}</For>
        </Show>
      </box>
    </Show>
  )
}

const tui: TuiPlugin = async (api, options) => {
  if (options?.enabled === false) return

  const configured = typeof options?.interval === "number" ? options.interval : 0
  const interval = configured >= 500 ? configured : 2000

  const [byId, setById] = createSignal<Record<string, Todo[]>>({})
  let pending = false

  const activeSession = () => {
    const route = api.route.current
    if (route.name !== "session") return undefined
    const id = (route as { params?: { sessionID?: unknown } }).params?.sessionID
    return typeof id === "string" && id ? id : undefined
  }

  const refresh = () => {
    const sessionID = activeSession()
    if (!sessionID || pending) return
    pending = true
    Promise.resolve(api.client.session.todo({ sessionID }))
      .then((res) => {
        const data = (res as { data?: unknown })?.data
        if (!Array.isArray(data)) return
        setById((prev) => ({ ...prev, [sessionID]: data as Todo[] }))
      })
      .catch(() => {})
      .finally(() => {
        pending = false
      })
  }

  refresh()
  const timer = setInterval(refresh, interval)
  api.lifecycle.onDispose(() => clearInterval(timer))

  const offs: (() => void)[] = []
  for (const type of ["todo.updated", "session.idle", "session.status"] as const) {
    try {
      offs.push(api.event.on(type, refresh))
    } catch {
      // Event type unavailable on this host version; polling still covers it.
    }
  }
  api.lifecycle.onDispose(() => {
    for (const off of offs) off()
  })

  const todosFor = (sessionID: string) => () => byId()[sessionID] ?? (api.state.session.todo(sessionID) as Todo[])

  api.slots.register({
    order: 400,
    slots: {
      sidebar_content: (_ctx, props) => <View api={api} todos={todosFor(props.session_id)} />,
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: "sandbox.sidebar-todo",
  tui,
}

export default plugin
