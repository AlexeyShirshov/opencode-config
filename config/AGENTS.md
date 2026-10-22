# Global rules

## Git: never commit/push to other repos without explicit request

- Commit/push only in the current workspace repo, and only when the user explicitly asks.
- Never commit, push, or write in any other repo (e.g. a user's project) unless the user names it and asks; touching docs/config there "because it seemed related" is forbidden.

## Source of truth: never edit the live host config

- `~/.config/opencode/**` is a **deploy target**, not a source. Do not edit skills, plugins, agents, profiles or this file there — not even "to try it quickly". Verify in a sandbox or a separate `OPENCODE_CONFIG` instead.
- Skills and plugins are edited **only** in the skills repo (`github.com/AlexeyShirshov/skills`, local clone `/home/alex/sources/skills`, `../skills` from `opencode-config`), then tested, committed and pushed there. They reach the config snapshot (`config/skills`, `config/plugins`) only via `bun config/tools/vendor-skills.mjs --fix` (refuses a dirty or unpushed source), and the host only through an explicit deploy.
- Always the same direction: `skills` → `opencode-config` → host. Nothing rolls out to the host automatically, and an edit found in the host is never "legalised" by copying it back. Full workflow: `AGENTS.md` in the `opencode-config` repo.

## C# symbols: Roslyn only

- For any C# symbol question (definitions, references, call sites, implementations, overloads, members, renames, impact) never use `rg`/`grep`/`glob` or other text search — use the `roslyn` tool, always, as the very first step.
- `rg`/`grep` are only for non-symbol text: string literals, comments, docs/markdown, configs, non-`.cs` files, or as a last resort when `roslyn` cannot load a solution / there is no `.cs`. If you fall back, say so and never present it as a resolved symbol.
- Discover with `roslyn structure`/`types`/`members`, answer with `refs`/`callers`/`implementations`, edit with `roslyn rename`; never rename via `sed` or infer a symbol from text search.
- `roslyn` is daemon-backed (first call loads the solution, later calls are ms); "rg is faster" is never a valid reason.
- **In V2 there is no top-level `roslyn` tool — call it inside `execute`:** `const r = await tools.roslyn({ action: "refs", target: "Ns.Type.Member" }); return r`. "I don't see a `roslyn` tool" is never a reason to fall back to `rg`/`grep`. If it is missing from the Code Mode catalog, run `search({ query: "roslyn" })` first — the catalog is partial while MCP servers reconnect, but the tool itself is always registered.
- Batch several `tools.roslyn(...)` calls in ONE `execute` (`Promise.all([...])`): one round-trip instead of many, the daemon keeps the solution loaded.
- Pass `solution: "/abs/path/to/X.slnx"` when the session directory has no `.sln`/`.slnx` (e.g. you are in a docs/config repo and the solution lives elsewhere).

## Issues: search for duplicates before filing

- Before creating **any** issue (`gh issue create` on any repo, and the built-in `report` skill), first search for existing tickets — that search is step 0 of the workflow and the `report` skill does **not** contain it, so add it yourself.
- Search several keyword variants over `--state open` and closed: the symptom, the component/area name, and the likely underlying cause (e.g. for a TUI audio bug: `attention sound`, `alsa`, `stderr corrupt tui`). Also check `gh search issues --author @me` and the "related issues" list of the closest match.
- If a matching issue exists, **do not open a new one** — post the new evidence (repro, versions, environment, workarounds) as a comment on the existing ticket and link the related ones. Open a new issue only when nothing covers it, and then link the neighbours explicitly.
- Applies equally to PRs linked from issue text: cite the tracking issue, not a duplicate.

## Skills: spine and triggers

- superpowers is installed but curated to the single skill `brainstorming`, exposed **only to `architect`** (switch agents with `shift+tab` or the agent list `<leader>a`); its `using-superpowers` bootstrap still fires in every **primary** session, sub-agents get none.
- **Grilling / brainstorming runs only under the `architect` agent.** Before starting a grilling, switch to `architect` — `shift+tab` (next agent, the `agent.cycle` command) or the agent list `<leader>a` (`ctrl+x`, then `a`/`ф`). In V2 a bare `tab` does NOT switch agents: it triggers autocomplete (`prompt.autocomplete.complete`). In `build`/`plan` and any other agent the skill is denied by permissions (`opencode.jsonc`: global `skill: brainstorming → deny`), and `skill brainstorming` returns `permission denied` — do not start a grilling from another agent and do not substitute hand-rolled questions for it.
- Invoke skills **by name** via the `skill` tool; a bare Russian phrase depends on the model matching the English description.
- **Universal cycle (`pdca`)** — the domain-neutral PDCA contract for tasks with a verifiable result — is invoked **explicitly by name**: `skill pdca` / `@pdca`. The family entry point is `pdca-entry`: it is the only skill advertised for automatic selection; the other contracts load only by explicit ID (`@pdca-dotnet`) or through its handoff. Its roles/tiers: `pdca-planner`/`pdca-check` — **medium**, `pdca-escalate` — **strong**, `pdca-executor` — **cheap**, а автономный драйвер — общий `pdca-orchestrator` (**cheap**); fact-gathering reuses `scout` (**cheap**). Role→model ids live only in the profile `agent` block (§Tier routing below).

| Want | Say |
| --- | --- |
| Pre-feature interview | switch to `architect` (`shift+tab` / `<leader>a`), then say: «используй скилл `brainstorming`: <тема>» |
| Install check | «расскажи про свои superpowers» |

### Tier routing: decisions on medium, facts on cheap

- **Decisions** (requirements, design, decomposition, specs, plans, tradeoffs) → primary `architect` (medium; switch with `shift+tab`); run it from `oc-ds`, where the medium/strong providers are configured (`oc-gp` falls back to its default).
- **PDCA-цикл ведёт cheap-оркестратор** — по **эффективному тиру профиля**, не по имени агента. В autonomous-режиме cheap-primary **делегирует** одиночный цикл cheap-`pdca-orchestrator` через субагента, а normal-режим сохраняет интерактивный апрув плана (пользователь знакомится с планом и
утверждает его); при недоступности `pdca-orchestrator` (нет агента / `subagent_depth` < 2 / делегирование запрещено) в autonomous применяется flat primary fallback (cheap-primary ведёт цикл сам) с пометкой `Notice:` и записанным summary, а в normal — сообщение пользователю. Medium/strong primary (в т.ч. `architect`) цикл не диспетчеризует; вне цикла решения остаются за `architect`. Внутри цикла решения PLAN/replan — `pdca-planner`, вердикт CHECK — `pdca-check`, эскалация — `pdca-escalate` (её **решение** оркестратор только **роутит**: revised plan → `pdca-planner`, реализация/STOP → `coder`; семантически не перевыбирает, гейты/no-4th/scope/security не отменяет). Права дорогих ролей не расширяются. Вариант цикла называет диспетчеризующий скилл (`pdca-entry` / `pdca-collection` / `pdca-incremental`) и передаёт драйверу как `selected_variant`; сам драйвер задачу не классифицирует.
- **Facts** (code search, reading for discovery, web, library/MS docs, repo wikis) → `scout` (cheap, read-only, `file:line`/URLs only, no recommendations). This is enforced by permissions, not advice: `architect` denies read/grep/glob/webfetch/websearch, all MCP and shell/edit, and limits subagent launches to scout/coder; `plan` denies the same tools and forbids subagent launches of `general`/`explore`; `pdca-escalate` likewise denies search/MCP, limits subagent launches to `scout`, and narrows `bash` to read-only inspection (no build/test — `coder`/`pdca-check` run them).
- **Implementation** (code, tests, config) → `coder` (cheap).
- **Never dispatch `general`/`explore` from an expensive primary** (they inherit its model); map a superpowers "general-purpose subagent" to `coder` (code) or `scout` (research). Cheap primaries (`oc-ds build`) may surf directly.
- **Tiers, not model ids:** `agents/*.md` carry only `# tier: cheap|medium|strong`; the profile binds ids in its `agent` block (`profiles/*.jsonc`), and projects can override. Never put `model:` back into `agents/*.md`, prose, skills or docs.
