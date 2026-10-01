# PDCA Contract Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.
> **Authoring/execution note:** this plan is dictated by the `architect` primary, which **cannot run `subagent-driven-development` natively** (`read`/`edit`/`bash` are denied). Implementation is delegated to `coder` Tasks; the orchestrator only composes briefs and calls `todowrite`. Do not attempt inline edits from the decision primary.

**Goal:** Resolve the seven audit findings in the `pdca-dotnet` contract without restructuring the 1484-line skill or touching unrelated work.

**Architecture:** Keep the existing PLAN → DO → CHECK → ACT state machine. Add a plan-revision counter `r` orthogonal to cycle `<N>` and attempt `n/3`; keep unfinished `D` work through rejected candidates and accepted prerequisites; make the todo one aggregate per active phase with per-unit truth in the status file; make autonomous mode question-free and keep model binding in the host profile `agent` block with `# tier` labels in published roles.

**Tech Stack:** Markdown contracts (EN skill + EN assets, RU `config/agents`), YAML frontmatter, Python stdlib `unittest` for static rule-presence regression guards, diagram generation via `assets/diagram/gen_pdca.py` and `archify validate workflow ... --json`.

**Spec:** `docs/superpowers/specs/2026-10-01-pdca-consistency-design.md`

## Global Constraints

- Preserve all pre-existing worktree edits and untracked diagram outputs; do not reset/stash/commit/push.
- No behavioral implementation in this artifact; the `writing-plans` gate reviews it first.
- Scope only: `config/skills/pdca-dotnet/SKILL.md`, `config/skills/pdca-dotnet/assets/agents/*.md`, `config/skills/pdca-dotnet/assets/diagram/*`, `config/agents/*.md`, `README.md`, and the new test file below. No `pdca-collection`/`lane`/profile-binding changes.
- Do not reintroduce `model:` into role markdown; do not edit `config/profiles/*.jsonc` to choose model ids.
- Keep no new arbitrary cap on plan revisions or resource budget.
- Static assertions prove rule presence only; behavior is validated by an independent fresh-agent scenario review.
- Never present a Chrome/visual blocker as a pass. No commit step exists in this plan by explicit prohibition.

## Review Focus

1. A DO blocker report is mistaken for completed `D`, so gate 2 opens with unfinished work; checked by Task 1 Step 5 and scenario A/B.
2. The attempt counter leaks across plan revisions or a rejected candidate resets retries; checked by Task 1 Step 2 and scenarios A/C/D.
3. Same-defect history is erased by a replan, so escalation fires late; checked by Task 1 Step 5 and scenario C.
4. Autonomous mode asks a question or implies auto-commit; checked by Task 2 Step 5 and scenario F.
5. A `model:` field returns to published assets or profiles are edited; checked by Task 2 Step 4 and scenario H.

---

## File Structure

- `config/skills/pdca-dotnet/SKILL.md` — main contract: counters, state machine, todo tracker, gates, escalation, autonomous mode, host requirements/setup, orchestrator-role wording, `:757` heading reference, four CHECK streams.
- `config/skills/pdca-dotnet/assets/agents/{planner,coder,check,escalate,scout,security-auditor}.md` — published EN role briefs; `# tier` labels + counter/blocker/classification wording.
- `config/agents/{architect,planner,coder,check,escalate}.md` — RU actor briefs; mirror the same rules.
- `config/skills/pdca-dotnet/assets/diagram/{gen_pdca.py,workflow.json}` and regenerated `pdca-hand*.{svg,html}`, `pdca-hand-dark.*` (and `pdca-dotnet.html` only if the workflow change is structural).
- `README.md` — concise summary: counters, one-active-phase todo, host-profile binding, no `model:` in assets.
- `config/skills/pdca-dotnet/tests/test_contract_consistency.py` — new stdlib-only rule-presence regression guard (created in Task 1, extended in Task 2).

---

### Task 1: Status, counters/revisions, one-active-phase tracking, blockers

**Files:**
- Modify: `config/skills/pdca-dotnet/SKILL.md` (§State machine, §Phase todo tracker, §Autonomous mode stop path, §Escalation, §Cycle status file, §PLAN → "PLAN owns the quality of the plan" reference, §CHECK streams)
- Modify: `config/skills/pdca-dotnet/assets/agents/{planner,coder,check,escalate}.md`
- Modify: `config/agents/{planner,coder,check,escalate}.md`
- Test: `config/skills/pdca-dotnet/tests/test_contract_consistency.py` (new)

**Interfaces:**
- Consumes: existing `docs/specs/status/<task>-<N>.md` contract, gate 1–4 wording, `iteration n/3` journal template.
- Produces: revision counter `r` semantics; unfinished-`D` retention; explicit superseded→replacement mapping; aggregate phase todo; documented `DO → PLAN` classification boundaries.

- [x] **Step 1: Create the failing static regression guard (red before edit)**

  Create `config/skills/pdca-dotnet/tests/test_contract_consistency.py` with `unittest` cases that read the contracts as text and assert this task's rules are present (revision `r` definition; `PLAN(r) → DO` starts at 1; rejected candidate does not reset attempts; same-defect history not erased by replan; unfinished `D` retained after a blocker; superseded→replacement mapping; exactly one active phase item; parallel D units tracked in the status file).
  Run: `python3 -m unittest discover -s config/skills/pdca-dotnet/tests -p 'test_*.py' -v`
  Expected before edit: failures (rules absent). Record the failing test names and exit code. This is a rule-presence guard, not behavioral proof.

- [x] **Step 2: Retire those assertions green by editing the SKILL state machine and counters**

  In `config/skills/pdca-dotnet/SKILL.md`:
  - §State machine "Two counters" → three concepts: cycle `<N>` (ACT only), explicit plan revision `r` (starts at 1, increments only when `planner` issues a revised plan), attempt `iteration n/3` scoped to the current revision; `PLAN(r) → DO` starts at 1; `CHECK → DO` increments; third failed CHECK of the same revision → `escalate` before a fourth; `DO → PLAN`/`CHECK → PLAN` do not consume the next revision's attempts and a new revision resets to 1; a rejected candidate/clarification with unchanged plan is not a new revision and does not reset attempts; record the outgoing failed attempt before replacing the plan.
  - §Autonomous mode gate-3 escalation paragraph and §Escalation trigger 2 → same revision wording; keep "same defect after one fix ⇒ escalate before the second fix" across revisions; no global `iteration n/3` on every loop-back.
  - §Cycle status file log template and events → carry `r` alongside `iteration n/3`; note the outgoing failed attempt line.
  - §State machine `DO → PLAN` and gates 1–4 → unfinished work stays in the status file; a blocker report is not `done`; rejected candidate resumes the original `D`; accepted prerequisite keeps the original remainder with an explicit superseded→replacement mapping; pending/blocked unresolved work prevents gate 2.
  - §Phase todo tracker → exactly one active phase item (`P/D/C/A`); one aggregate `D:`; parallel D units/streams live in the status file; aggregate `D:` closes only when all units and DO streams satisfy gate 2; replan moves the aggregate phase marker without falsely completing units.

- [x] **Step 3: Apply the same-scope cleanup**

  In `SKILL.md`: replace the numeric `(:757)` reference with the heading reference
  `§PLAN → "PLAN owns the quality of the plan (a weak task statement is not an excuse)"`; in §"Parallel CHECK streams" and gate 3/line ~1129 wording fix "Three unconditional streams" → **four** (code audit + test + doc + perf) plus triggered security, enumerating the full gate consistently.

- [x] **Step 4: Mirror the rules into the brief sets**

  Update the counter/blocker/tracking wording in `config/skills/pdca-dotnet/assets/agents/{planner,coder,check,escalate}.md` and `config/agents/{planner,coder,check,escalate}.md` so both sets agree with Step 2 (journal template, DO-candidate retention, escalation revision semantics). Do not touch `model:`/tier lines here (Task 2 owns them).

- [x] **Step 5: Green + behavior scenarios for this task**

  > Completion note (appended at finalization): the static green was reached; the A/B/C/D/G/I walk was folded into the **final independent A–I static review** (SPEC PASS / QUALITY APPROVED; static reasoning, no runtime cycle proof) — see `progress.md` "Final verification + approved selective install sync".

  Run: `python3 -m unittest discover -s config/skills/pdca-dotnet/tests -p 'test_*.py' -v` (expect all green; record passed/failed) and `git diff --check` (expect zero exit; inspect `git diff` to separate changes from pre-existing worktree edits).
  Then dispatch a fresh independent `escalate` Task (the read-capable independent role; `check`/`planner` have `read` denied) with the full contract files and have it walk scenarios **A, B, C, D, G, I** plus "rejected candidate cannot reset retries". Record its recommendation and any correction; on a gap, fix in Step 2/3 and rerun this step.

---

### Task 2: Autonomy, PLAN authority, DO-candidate classification, host-profile install

**Files:**
- Modify: `config/skills/pdca-dotnet/SKILL.md` (§Orchestrator role wording, §Autonomous mode, §Host requirements/setup, §Escalation trigger 5, orchestrator-name wording)
- Modify: `config/skills/pdca-dotnet/assets/agents/{planner,coder,check,escalate,scout,security-auditor}.md` (tier labels)
- Modify: `config/agents/{architect,planner,escalate}.md` (actor mirrors)
- Test: extend `config/skills/pdca-dotnet/tests/test_contract_consistency.py`

**Interfaces:**
- Consumes: Task 1 revision/blocker wording; existing `config/profiles/deepseek.jsonc` `agent` bindings (must stay untouched).
- Produces: question-free autonomous path; `planner` classification including low-confidence escalation; primary-as-dispatcher authority; host-profile binding with `# tier` labels and no setup `model:` step.

- [x] **Step 1: Extend the failing static guard (red before edit)**

  Add cases asserting: autonomous mode contains no user-question instruction (including missing acceptance criteria and unavailable resource) and routes blockers through `planner`/`escalate` to a recorded STOP; normal mode retains questions/`go`; `planner` classification includes low-confidence `escalate` under trigger 5 without proven externalness; published assets carry `# tier:` labels and no `# model:` line; no primary inspects files itself.
  Run: `python3 -m unittest discover -s config/skills/pdca-dotnet/tests -p 'test_*.py' -v`
  Expected before edit: new cases fail. Record names/exit code.

- [x] **Step 2: Make autonomous mode question-free and close the authority contradiction**

  In `SKILL.md`:
  - §Autonomous mode → remove/replace the "ask a question if the cycle cannot be performed" path; autonomous = no questions at all (including the examples **missing acceptance criteria** and **unavailable resource**); a blocked/ambiguous unresolvable issue goes through `planner`/`escalate`, then STOP with the recorded summary (closed/remaining/blockers), no user question; `Notice:` and final summary stay allowed; user-supplied stop still obeyed; autonomy is not auto-commit permission. Scenario **F** stays as written.
  - §Orchestrator role and gate-3 return wording → PLAN (initial and replan) belongs to `planner`; every primary including `architect` is only a dispatcher inside PDCA; a primary never starts to read files or run commands itself. Generalize overly `build`-specific wording to "the orchestrator/primary" where it blocks a non-`build` primary (lines ~148, ~202, ~230, ~1330).
  - §Escalation trigger 5 → allow low-confidence escalation after a targeted `scout` gather even without established externalness.

- [x] **Step 3: Extend planner classification and autonomy mirrors**

  In `config/skills/pdca-dotnet/assets/agents/planner.md` and `config/agents/planner.md`: extend item 10/§What you do with the four-way classification (prerequisite / acceptable assumption-risk / true outside-authority-or-resource blocker → escalate / insufficient evidence → targeted `scout`, persistent low confidence → `escalate` trigger 5); state DO cannot issue the final verdict or STOP; add the useful candidate input format (original `D`/criterion, probe/error/`file:line`, plan invalidation, unknowns and checks/alternatives tried).
  In `config/agents/architect.md`: replace "PLAN сам" with PLAN delegated to `planner` inside PDCA (initial and replan), keeping `architect` as decision primary outside PDCA; keep fact-gathering in `scout` and edits in `coder`.
  In `assets/agents/{coder,check,escalate}.md` and `config/agents/{coder,check,escalate}.md`: align only where their brief text asserts counters/autonomy conflicting with Task 1/Task 2.

- [x] **Step 4: Host-profile install and tier labels**

  In `SKILL.md` §"Host requirements (roles → agents)": state that model bindings come from the host profile `agent` block (or project config), not `model:` in role markdown; remove setup step 2 ("uncomment and fill in `model:`") and renumber; keep the fallback/portability note limited to actual host permissions and never bypass `general`/`explore` denials.
  In `config/skills/pdca-dotnet/assets/agents/*.md`: replace each `# model: <bind ...>` line with the RU-matching `# tier:` label (`coder`/`scout` = cheap; `planner`/`check`/`security-auditor` = medium; `escalate` = strong). Do not add `model:` anywhere and do not edit `config/profiles/*.jsonc`.

- [x] **Step 5: Green + behavior scenarios for this task**

  > Completion note (appended at finalization): the static green was reached; the E/F/H walk was folded into the **final independent A–I static review** (SPEC PASS / QUALITY APPROVED; static reasoning, no runtime cycle proof) — see `progress.md` "Final verification + approved selective install sync".

  Run `python3 -m unittest discover -s config/skills/pdca-dotnet/tests -p 'test_*.py' -v` (expect green) and `git diff --check`.
  Dispatch a fresh independent `escalate` Task with the full contracts for scenarios **E, F, H**; record its recommendation and fix any gap, then rerun.

---

### Task 3: Scenario/static regression validation, labels/rendered artifacts, README, gated sync

**Files:**
- Modify: `config/skills/pdca-dotnet/assets/diagram/gen_pdca.py`, `config/skills/pdca-dotnet/assets/diagram/workflow.json`
- Regenerate: `config/skills/pdca-dotnet/assets/diagram/pdca-hand*.{svg,html}`, `pdca-hand-dark.*`; `pdca-dotnet.html` only if the workflow change is structural
- Modify: `README.md` (concise summary)
- Test: `config/skills/pdca-dotnet/tests/test_contract_consistency.py`

**Interfaces:**
- Consumes: Task 1/Task 2 contract states; `gen_pdca.py` (writes files next to itself); `workflow.json` label sources.
- Produces: consistent diagram labels, updated README, full-suite green, independent A–I scenario verdict, byte-compared install copies.

- [x] **Step 1: Full static suite + scenario review**

  > Completion note (appended at finalization): the A–I walk was performed by the **final independent `escalate` review** (SPEC PASS / QUALITY APPROVED, static reasoning only, no runtime cycle proof) — see `progress.md`.

  Run `python3 -m unittest discover -s config/skills/pdca-dotnet/tests -p 'test_*.py' -v` (record passed/failed/skipped) and `git diff --check` (record exit). Then dispatch a fresh independent `escalate` Task reading the full relevant contracts and walking **all** scenarios A–I; attach its verdict to the task report. Do not use a broad grep-of-a-word as claimed semantic proof. If a gap is found, loop back to the owning task, fix, and rerun Steps 1–2 of this task.

- [x] **Step 2: Align diagram label sources and regenerate**

  In `gen_pdca.py` and `workflow.json`, update the escalation/counter labels so they match the final `r`/`n/3` rule (keep the existing "same defect after one fix / different defects by the 3rd failed attempt" semantics; no broad redesign). Run:
  `python3 config/skills/pdca-dotnet/assets/diagram/gen_pdca.py`
  Expected: zero exit; regenerated `pdca-hand*.{svg,html}` and `pdca-hand-dark.*` present. **Whenever the workflow source (`workflow.json`) changes — including a label-only change — regenerating `pdca-dotnet.html` via `archify deliver workflow ... --quality showcase` is allowed; the approved spec supersedes the stale structure-only wording.** When the source is unchanged, leave the rendered HTML and record why.

- [x] **Step 3: Validate the workflow structure**

  Run:
  `node /home/alex/.agents/skills/archify/bin/archify.mjs validate workflow "$(pwd)/config/skills/pdca-dotnet/assets/diagram/workflow.json" --json`
  Expected: zero exit with a valid `--json` verdict. A **`workflow.json` source change (including a label-only one)** is a legitimate render/deliver trigger per the approved spec. If a render/deliver is needed and Chrome is unavailable, report the visual blocker explicitly; do **not** call it passing. Do not run the unrelated incomplete archify npm suite.

- [x] **Step 4: Update the README concise summary**

  In `README.md`, correct the summary to the final rules: cycle `<N>` (ACT only) plus plan revision `r` and attempt `n/3` scoped to the revision; one aggregate active phase todo with per-unit truth in the status file; autonomous = no questions; model binding via the host profile `agent` block with `# tier` labels (no `model:` in `assets/agents/*.md`). Keep it as a concise summary, not a copy of the contract.

- [x] **Step 5: Gated install sync with byte comparison**

  > Completion note (appended at finalization): performed after the final review agreed — **21/21 SYNC-OK, 0 failed, `CMP-OK=21`**; evidence `logs/final-sync-manifest.json`, `logs/final-sync.log`, `logs/final-sync-verify.log`. Host must be restarted to load synced copies.

  Only after Steps 1–4 are green and the independent review agreed, copy **exact** changed files to the documented host install root (`config/agents/<file>.md` → `~/.config/opencode/agents/<file>.md`; `config/skills/pdca-dotnet/<path>` → `~/.config/opencode/skills/pdca-dotnet/<path>`), using restricted per-file copies — never `rsync --delete`. Then prove identity, e.g. `cmp config/skills/pdca-dotnet/SKILL.md ~/.config/opencode/skills/pdca-dotnet/SKILL.md` for each changed file. Expected: zero exit per `cmp`. If the actual install root differs on this host, stop and report it rather than guessing. No commit or push.

---

## Deferred / follow-up

- Run the independent scenario review again after install in a fresh OpenCode process and confirm the installed copies are the reviewed ones.
- If a diagram re-render needs Chrome and it is unavailable, the visual blocker is reported and the render is retried after Chrome is provided.
