# Global rules

## Git: never commit/push to other repos without explicit request

- Commit/push only in the current workspace repo, and only when the user explicitly asks.
- Never commit, push, or write in any other repo (e.g. a user's project) unless the user names it and asks; touching docs/config there "because it seemed related" is forbidden.

## C# symbols: Roslyn only

- For any C# symbol question (definitions, references, call sites, implementations, overloads, members, renames, impact) never use `rg`/`grep`/`glob` or other text search — use the `roslyn` tool, always, as the very first step.
- `rg`/`grep` are only for non-symbol text: string literals, comments, docs/markdown, configs, non-`.cs` files, or as a last resort when `roslyn` cannot load a solution / there is no `.cs`. If you fall back, say so and never present it as a resolved symbol.
- Discover with `roslyn structure`/`types`/`members`, answer with `refs`/`callers`/`implementations`, edit with `roslyn rename`; never rename via `sed` or infer a symbol from text search.
- `roslyn` is daemon-backed (first call loads the solution, later calls are ms); "rg is faster" is never a valid reason.

## Skills: spine and triggers

- superpowers is installed but curated to the single skill `brainstorming`, exposed **only to `architect`** (Tab); its `using-superpowers` bootstrap still fires in every **primary** session, sub-agents get none.
- "по циклу"/"через PDCA"/"по pdca-dotnet" → the spine is `pdca-dotnet`; the bootstrap does **not** override it (no mandatory `brainstorming`/debug first step) — the cycle starts with PLAN per the contract. Outside the cycle, use `brainstorming` (from `architect`) before new features/ideas.
- Invoke skills **by name** via the `skill` tool; a bare Russian phrase depends on the model matching the English description.

| Want | Say |
| --- | --- |
| Pre-feature interview | из `architect`: «используй скилл `brainstorming`: <тема>» |
| PDCA cycle | «по циклу» / «через PDCA» |
| Install check | «расскажи про свои superpowers» |

### Tier routing: decisions on medium, facts on cheap

- **Decisions** (requirements, design, decomposition, specs, plans, tradeoffs) → primary `architect` (medium, Tab); run it from `oc-ds`, where the medium/strong providers are configured (`oc-gp` falls back to its default).
- **PDCA-цикл ведёт cheap-оркестратор** — по **эффективному тиру профиля**, не по имени агента. В autonomous-режиме cheap-primary **делегирует** одиночный цикл cheap-`pdca-orchestrator` через `Task`, а normal-режим сохраняет интерактивный `go`; при недоступности `pdca-orchestrator` (нет агента / `subagent_depth` < 2 / `Task` запрещён) в autonomous применяется flat primary fallback (cheap-primary ведёт цикл сам) с пометкой `Notice:` и записанным summary, а в normal — сообщение пользователю. Medium/strong primary (в т.ч. `architect`) цикл не диспетчеризует; вне цикла решения остаются за `architect`. Внутри цикла решения PLAN/replan — `planner`, вердикт CHECK — `check`, эскалация — `escalate` (её **решение** оркестратор только **роутит**: revised plan → `planner`, реализация/STOP → `coder`; семантически не перевыбирает, гейты/no-4th/scope/security не отменяет). Права дорогих ролей не расширяются.
- **Facts** (code search, reading for discovery, web, library/MS docs, repo wikis) → `scout` (cheap, read-only, `file:line`/URLs only, no recommendations). This is enforced by permissions, not advice: `architect` denies read/grep/glob/webfetch/websearch, all MCP and bash/edit, and limits `task` to scout/coder; `plan` denies the same tools and forbids `task` to `general`/`explore`; `escalate` likewise denies search/MCP, limits `task` to `scout`, and narrows `bash` to read-only inspection (no build/test — `coder`/`check` run them).
- **Implementation** (code, tests, config) → `coder` (cheap).
- **Never dispatch `general`/`explore` from an expensive primary** (they inherit its model); map a superpowers "general-purpose subagent" to `coder` (code) or `scout` (research). Cheap primaries (`oc-ds build`) may surf directly.
- **Tiers, not model ids:** `agents/*.md` carry only `# tier: cheap|medium|strong`; the profile binds ids in its `agent` block (`profiles/*.jsonc`), and projects can override. Never put `model:` back into `agents/*.md`, prose, skills or docs.
