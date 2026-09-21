import { tool } from "@opencode-ai/plugin"
import os from "os"
import path from "path"
import fs from "fs"

const BIN = path.join(os.homedir(), ".dotnet", "tools", "roslynq")

function findSolution(root: string): string | null {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(root, { withFileTypes: true })
  } catch {
    return null
  }
  const hit = entries.find((e) => e.isFile() && /\.slnx?$/i.test(e.name))
  return hit ? path.join(root, hit.name) : null
}

export default tool({
  description: [
    "Roslyn semantic analysis of a C# solution via the `roslynq` tool.",
    "Use this INSTEAD of rg/sed when you need types, symbols, members, references, call sites, implementations or a rename.",
    "actions: structure | types | symbols | members | refs | callers | implementations | rename.",
    "Pass symbols by full name, e.g. NextORM.Core.SqlBuilder.MakeSelect.",
    "`rename` is a dry-run by default; set apply=true to write files.",
  ].join(" "),
  args: {
    action: tool.schema
      .enum(["structure", "types", "symbols", "members", "refs", "callers", "implementations", "rename"])
      .describe("Analysis action"),
    target: tool.schema.string().optional().describe("Type/member full name, or a type-name substring for `types`"),
    newName: tool.schema.string().optional().describe("New name (required for action=rename)"),
    apply: tool.schema.boolean().optional().describe("For rename: write changes to disk (default is dry-run)"),
    solution: tool.schema.string().optional().describe("Path to .sln/.slnx; defaults to the first solution in the worktree"),
  },
  async execute(args, ctx) {
    const root = ctx.worktree ?? ctx.directory
    const sln = args.solution ? path.resolve(root, args.solution) : findSolution(root)
    if (!sln) return "No .sln/.slnx found in the project root; pass `solution`."

    const cmd = [BIN, sln, args.action]
    if (args.target) cmd.push(args.target)
    if (args.action === "rename") {
      if (!args.newName) return "action=rename requires `newName`."
      cmd.push(args.newName)
      if (args.apply) cmd.push("--apply")
    }

    const proc = Bun.spawn(cmd, { cwd: root, stdout: "pipe", stderr: "pipe" })
    const [out, err] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    const code = await proc.exited
    const text = [out.trim(), err.trim()].filter(Boolean).join("\n").trim()
    if (code !== 0 && !text) return `roslynq exited with code ${code}`
    return text || "(no output)"
  },
})
