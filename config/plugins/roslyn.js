// roslyn — семантический анализ C# через CLI `roslynq` (Roslyn + MSBuildWorkspace).
//
// V2-порт V1-инструмента `tools/roslyn.ts` (архив: `v1/tools/roslyn.ts`).
// V2 не загружает custom tools из `tools/*.ts`, поэтому тот же инструмент
// регистрируется серверным плагином через `ctx.tool.transform`. Сам CLI
// (`tools/roslyn-cli/`, глобальный dotnet tool `roslynq`) не менялся.
//
// Права: инструмент регистрируется как action `roslyn` (имя тула). Роли с
// top-level `"*": deny` (architect/plan/check/planner/escalate/security-auditor)
// должны разрешить его явно — остальным достаточно базовой `"*": allow`.

import { execFile } from "node:child_process"
import { readdirSync } from "node:fs"
import { homedir } from "node:os"
import { join, resolve } from "node:path"

const BIN = join(homedir(), ".dotnet", "tools", "roslynq")

const ACTIONS = [
  "structure",
  "types",
  "symbols",
  "members",
  "refs",
  "callers",
  "implementations",
  "rename",
]

// Ответ `refs`/`callers` по большому решению не влезает в дефолтные 1 MiB.
const MAX_BUFFER = 64 * 1024 * 1024

function findSolution(root) {
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return null
  }
  const hit = entries.find((entry) => entry.isFile() && /\.slnx?$/i.test(entry.name))
  return hit ? join(root, hit.name) : null
}

function runRoslynq(args, cwd, signal) {
  return new Promise((done) => {
    execFile(BIN, args, { cwd, signal, maxBuffer: MAX_BUFFER }, (error, stdout, stderr) => {
      const text = [String(stdout ?? "").trim(), String(stderr ?? "").trim()]
        .filter(Boolean)
        .join("\n")
        .trim()
      if (error?.name === "AbortError") return done({ aborted: true, code: 0, text })
      const code = error ? (typeof error.code === "number" ? error.code : 1) : 0
      done({ aborted: false, code, text })
    })
  })
}

export default {
  id: "roslyn",
  async setup(ctx) {
    // Локация плагина = рабочий каталог сессии; там же ищем решение.
    const root = ctx.location?.directory ?? process.cwd()

    await ctx.tool.transform((editor) => {
      editor.add({
        name: "roslyn",
        description: [
          "Roslyn semantic analysis of a C# solution via the `roslynq` tool.",
          "Use this INSTEAD of rg/sed when you need types, symbols, members, references, call sites, implementations or a rename.",
          "actions: structure | types | symbols | members | refs | callers | implementations | rename.",
          "Pass symbols by full name, e.g. NextORM.Core.SqlBuilder.MakeSelect.",
          "`rename` is a dry-run by default; set apply=true to write files.",
          "The first call loads the solution and starts a background daemon (may take seconds); later calls reuse it.",
        ].join(" "),
        input: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ACTIONS,
              description: "Analysis action",
            },
            target: {
              type: "string",
              description: "Type/member full name, or a type-name substring for `types`",
            },
            newName: {
              type: "string",
              description: "New name (required for action=rename)",
            },
            apply: {
              type: "boolean",
              description: "For rename: write changes to disk (default is dry-run)",
            },
            solution: {
              type: "string",
              description: "Path to .sln/.slnx; defaults to the first solution in the worktree",
            },
          },
          required: ["action"],
          additionalProperties: false,
        },
        async execute(input, context) {
          const sln = input.solution ? resolve(root, input.solution) : findSolution(root)
          if (!sln) return { content: "No .sln/.slnx found in the project root; pass `solution`." }

          const args = [sln, input.action]
          if (input.target) args.push(input.target)
          if (input.action === "rename") {
            if (!input.newName) return { content: "action=rename requires `newName`." }
            args.push(input.newName)
            if (input.apply) args.push("--apply")
          }

          const { aborted, code, text } = await runRoslynq(args, root, context.signal)
          if (aborted) return { content: "roslynq cancelled." }
          if (code !== 0 && !text) return { content: `roslynq exited with code ${code}` }
          return { content: text || "(no output)" }
        },
      })
    })
  },
}
