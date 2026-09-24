export const ClearSessionPlugin = async ({ client }) => {
  return {
    "command.execute.before": async (input) => {
      if (input.command !== "clear") return
      const sessionID = input.sessionID
      await client.session.delete({ path: { id: sessionID } }).catch(() => {})
      throw new Error(`Session ${sessionID} cleared`)
    },
  }
}
