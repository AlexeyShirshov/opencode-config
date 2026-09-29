import { appendFileSync } from "node:fs"
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"

const DEBUG = "/tmp/opencode/clear-debug.log"
const dbg = (s: string) => {
  try {
    appendFileSync(DEBUG, `${new Date().toISOString()} ${s}\n`)
  } catch {}
}

const tui: TuiPlugin = async (api) => {
  dbg(`LOAD apiKeys=[${Object.keys(api).join(",")}] command=${typeof api.command}`)
  try {
    const names = api.keymap.getCommands({ visibility: "registered" }).map((c) => c.name)
    dbg(`registered(${names.length}) has_session.archive=${names.includes("session.archive")}`)
    dbg(`registered_names=${names.join(",")}`)
  } catch (e) {
    dbg(`getCommands ERR ${String(e)}`)
  }
  try {
    api.event.on("session.updated", (e: any) =>
      dbg(`EVT session.updated id=${e?.properties?.info?.id} archived=${e?.properties?.info?.time?.archived}`),
    )
    api.event.on("session.deleted", (e: any) => dbg(`EVT session.deleted id=${e?.properties?.info?.id}`))
  } catch (e) {
    dbg(`event.on ERR ${String(e)}`)
  }

  api.command?.register(() => [
    {
      title: "Archive session",
      description: "Archive the current session",
      value: "session.clear",
      slash: { name: "clear" },
      onSelect: () => {
        const route = api.route.current
        const sessionID = route.name === "session" ? route.params.sessionID : undefined
        dbg(`ONSELECT route=${JSON.stringify(route)} sid=${sessionID}`)
        const r = api.keymap.dispatchCommand("session.archive")
        dbg(`DISPATCH=${JSON.stringify(r)}`)
        if (sessionID) {
          void api.client.session
            .update({ sessionID, time: { archived: Date.now() } })
            .then(() => dbg("API archive ok"))
            .catch((e) => dbg(`API archive ERR ${String(e)}`))
        }
      },
    },
  ])
}

const plugin: TuiPluginModule & { id: string } = {
  id: "config.clear-session",
  tui,
}

export default plugin
