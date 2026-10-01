# Global rules

## Git: never commit/push to other repos without explicit request

- Only commit/push in the current workspace repo when the user explicitly asks.
- Never commit, push, or otherwise write to any other repository (e.g. a user's project repo) unless the user explicitly names it and asks for it. Committing docs/config there "because it seemed related" is forbidden.

## C# symbols: Roslyn only

- Never use `rg`, `grep`, `glob` or any text search for C# symbol questions — type/member definitions, references, call sites, implementations, overloads, members, renames, impact analysis. Use the `roslyn` tool for these, always, including as the very first step.
- `rg`/`grep` are allowed only for non-symbol text: string literals, comments, docs/markdown, config files, non-`.cs` files, or as a last-resort pre-filter when `roslyn` cannot load a solution or has no C# file. If you fall back to text search, say so explicitly and do not present it as a resolved symbol.
- Do not infer a symbol, its references or its call sites from text search, and never rename via `sed`. Discover names with `roslyn structure` / `types` / `members`, then answer with `refs` / `callers` / `implementations`, then change code with `roslyn rename`.
- The `roslyn` CLI is daemon-backed: the first call loads the solution (a few seconds), later calls are milliseconds. "rg is faster" is never a valid reason to use it for symbols.
- If you notice yourself reaching for `rg` on a symbol, stop and call `roslyn` instead. A text-only answer to a symbol question is a bug.

## Skills: spine and Russian triggers

- Installed: **superpowers** (opencode plugin; 15 skills — `brainstorming`, `writing-plans`, `executing-plans`, `systematic-debugging`, `test-driven-development`, `using-git-worktrees`, …). Its bootstrap (`using-superpowers`) is injected into every **primary** session and demands "invoke the relevant skill before any response". Sub-agent sessions (`planner`/`coder`/`check`/`escalate`) do not get it.
- **Priority:** when the user asks for work "по циклу" / "через PDCA" / "по pdca-dotnet", the spine is `pdca-dotnet`, and the superpowers bootstrap does **not** override it: do not run `brainstorming`/`systematic-debugging` as a mandatory first step, the cycle starts with PLAN per the contract. Superpowers skills plug in inside the cycle only where the contract itself says so (e.g. debugging = loop-back CHECK → DO) or when the user asks explicitly.
- Outside the cycle, superpowers is a normal available set: `brainstorming` before any new feature/idea, `systematic-debugging` on a bug, `writing-plans`/`executing-plans` for plans, etc.
- **Invoke by skill name** — that makes the `skill` tool call deterministic; a bare Russian phrase without the name depends on the model matching the English skill description.

| Want | Say (Russian works; name the skill for determinism) |
| --- | --- |
| Interview me before a feature (grilling-style) | «используй скилл `brainstorming`: <тема>» / «побрейншторми со мной <фича>» |
| Plan of work | «используй скилл `writing-plans` по <спека>» |
| Execute a plan | «используй скилл `executing-plans`» |
| PDCA cycle | «по циклу» / «через PDCA» |
| Install check | «расскажи про свои superpowers» |

### Model routing: decisions on Sol, facts on DeepSeek

- **Decisions** — requirements, design, decomposition, specs, plans, tradeoffs — go to the primary agent `architect` (`opencode/gpt-6.1-sol`, variant `high`, switch with Tab). Run it from `oc-ds`: both providers are configured there (zen proxy for Sol, direct key for DeepSeek); `oc-gp` has no `provider.opencode` block, so Sol fails there.
- **Facts** — codebase search, reading for discovery, web, library docs (context7), Microsoft/Azure docs (mslearn), repo wikis (deepwiki/gitmcp) — go to `scout` (`deepseek/deepseek-flash`, read-only, no recommendations, facts with `file:line`/URLs only). `architect` and the built-in `plan` primary have `read`/`grep`/`glob`/`webfetch`/`websearch`, every MCP search tool, `bash` **and** `edit` denied, so this is enforced by permissions, not advisory; `task` is limited to `scout`/`coder`/`planner`/`check`/`escalate`/`lane` (`general`/`explore` denied). `escalate` is the same discipline: `grep`/`glob`/`webfetch`/`websearch` and every MCP search tool denied, `task` limited to `scout`, `bash` narrowed to read-only + build/test — it reasons over a pre-gathered scout pack in its brief and only dispatches `scout` for a missing fact.
- **Implementation** — code, tests, config edits — goes to `coder` (`deepseek/deepseek-flash`).
- **Never dispatch `general`/`explore` from an expensive primary** — they inherit the expensive model. When a superpowers skill says "Subagent (general-purpose):", use `coder` (implementation) or `scout` (research).
- Cheap primaries (`oc-ds` `build` = flash) may surf directly; the rule bites only when the primary is expensive.
- **Concrete model ids live in the host, not in the roles.** `agents/*.md` carry only a `# tier: cheap|medium|strong` label; the profile binds ids in its `agent` block (`profiles/*.jsonc`), and a project can override any role in its own `.opencode/opencode.jsonc`. Do not put `model:` back into `agents/*.md` — it would override the profile binding.
