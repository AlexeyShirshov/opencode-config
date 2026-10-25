# Global rules

## Git: never commit/push to other repos without explicit request

- Commit/push only in the current workspace repo, and only when the user explicitly asks.
- Never commit, push, or write in any other repo (e.g. a user's project) unless the user names it and asks; touching docs/config there "because it seemed related" is forbidden.

## Source of truth: never edit the live host config

- `~/.config/opencode/**` is a **deploy target**, not a source. Do not edit skills, plugins, agents, profiles or this file there — not even "to try it quickly". Verify in a sandbox or a separate `OPENCODE_CONFIG` instead.
- Skills and plugins are edited **only** in the skills repo (`github.com/AlexeyShirshov/skills`, local clone `/home/alex/sources/skills`, `../skills` from `opencode-config`), then tested, committed and pushed there. They reach the config snapshot (`config/skills`, `config/plugins`) only via `bun config/tools/vendor-skills.mjs --fix` (it refuses a dirty or unpushed source), and the host only through an explicit deploy.
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
- Invoke skills **by name** via the `skill` tool; a bare phrase in another language relies on the model matching the English description.
- **Universal cycle (`pdca`)** — the domain-neutral PDCA contract for tasks with a verifiable result — is the **single entry** of the family and is invoked **explicitly by name**: `skill pdca` / `@pdca`. Its one PLAN classifies the goal into the form (ordinary cycle / incremental campaign / collection), picks the overlay when the work is code (`pdca-coder`, plus `pdca-dotnet` for .NET), and drives PLAN → DO → CHECK → ACT; `pdca-collection` and `pdca-incremental` are loaded by that PLAN, the overlays load when the user names them explicitly (`@pdca-dotnet`). Its roles and tiers: `pdca-planner`/`pdca-check` — **medium**, `pdca-escalate` — **strong**, `pdca-executor` — **cheap**, and the autonomous driver is the shared `pdca-orchestrator` (**cheap**); fact-gathering reuses `pdca-scout` (**cheap**). Role→model ids live only in the profile `agent` block (§Tier routing below).

| Want | Say |
| --- | --- |
| Pre-feature interview | switch to `architect` (`shift+tab` / `<leader>a`), then say: "use the `brainstorming` skill: <topic>" (in Russian: «используй скилл `brainstorming`: <тема>») |
| Install check | "tell me about your superpowers" (in Russian: «расскажи про свои superpowers») |

### Install slot for new skills: the pack, not `skills/`

- A new skill — especially a third-party one from skills.sh — goes into the **full pack** `~/.config/opencode/skills-deepseek/<name>/` (snapshot: `config/skills-deepseek/<name>/`) and stays **unregistered**. The pack is not scanned, so its description costs no context; the skill is read on demand as `~/.config/opencode/skills-deepseek/<name>/SKILL.md` when the user names it.
- `~/.config/opencode/skills/` (snapshot `config/skills/`) is scanned **always**, for every profile and every subagent, so each description there is permanent context for all of them. Put a skill there only on an explicit request or when it must be picked automatically without being named (today: `pdca*`, `habr-article`).
- To advertise a pack skill in context, add its name to `skills-keep.txt` and run `bun tools/curate-skills.mjs --fix`; to retire it — drop the name and re-run. Writing skills live in the pack on demand: `humanizer`, `humanizer-ru`, `writing-guru`.

### Tier routing: decisions on medium, facts on cheap

- **Decisions** (requirements, design, decomposition, specs, plans, tradeoffs) → primary `architect` (medium; switch with `shift+tab`); run it from `oc-ds`, where the medium/strong providers are configured (`oc-gp` falls back to its default).
- **The PDCA cycle is driven by the cheap orchestrator** — by the profile's **effective tier**, not by the agent name. In autonomous mode the cheap primary **delegates** a single cycle to the cheap `pdca-orchestrator` as a subagent, while normal mode keeps the interactive plan approval (the user reads the plan and approves it); when `pdca-orchestrator` is unavailable (no agent / `subagent_depth` < 2 / delegation forbidden), autonomous mode falls back to flat primary (the cheap primary runs the cycle itself) with a `Notice:` marker and a recorded summary, and normal mode reports it to the user. A medium/strong primary (including `architect`) does not dispatch the cycle; outside the cycle, decisions stay with `architect`. Inside the cycle, PLAN/replan decisions belong to `pdca-planner`, the CHECK verdict to `pdca-check`, escalation to `pdca-escalate` (the orchestrator only **routes** its **decision**: revised plan → `pdca-planner`, implementation/STOP → `pdca-executor`; it does not re-decide semantically and does not waive gates, the no-4th-pass rule, scope or security). The rights of expensive roles are never widened. The dispatch names the loaded contract by exact ID (`pdca` plus the `coder`/`coder+.NET` overlay, or `pdca-incremental` for campaign preparation) and its form; the driver itself never classifies the task and never picks the form or the overlay — the single configured planner decides.
- **Facts** (code search, reading for discovery, web, library/MS docs, repo wikis) → `scout` (cheap, read-only, `file:line`/URLs only, no recommendations). This is enforced by permissions, not advice: `architect` denies read/grep/glob/webfetch/websearch, all MCP and shell/edit, and limits subagent launches to scout/coder; `plan` denies the same tools and forbids subagent launches of `general`/`explore`; `pdca-escalate` likewise denies search/MCP, limits subagent launches to `scout`, and narrows `bash` to read-only inspection (no build/test — `coder`/`pdca-check` run them).
- **Implementation** (code, tests, config) → `coder` (cheap).
- **Never dispatch `general`/`explore` from an expensive primary** (they inherit its model); map a superpowers "general-purpose subagent" to `coder` (code) or `scout` (research). Cheap primaries (`oc-ds build`) may surf directly.
- **Tiers, not model ids:** `agents/*.md` carry only `# tier: cheap|medium|strong`; the profile binds ids in its `agent` block (`profiles/*.jsonc`), and projects can override. Never put `model:` back into `agents/*.md`, prose, skills or docs.
