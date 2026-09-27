export const ClearSessionPlugin = async ({ client }) => {
  return {
    "command.execute.before": async (input) => {
      if (input.command !== "clear") return
      const sessionID = input.sessionID
      await client.session
        .update({ path: { id: sessionID }, body: { time: { archived: Date.now() } } })
        .catch(() => {})
      throw new Error(`Session ${sessionID} archived`)
    },
  }
}
