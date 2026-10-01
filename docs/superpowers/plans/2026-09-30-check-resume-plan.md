# CHECK Session Reuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse a Sol `check` session only when rechecking the same unchanged PLAN after a DO fix, without weakening CHECK.

**Architecture:** The PDCA orchestrator keeps a temporary `task_id` for the active task and approved PLAN. It resends a complete current gather report to a resumed `check` session after CHECK → DO, but starts fresh after CHECK → PLAN, ACT, task change or lost ID.

**Tech Stack:** OpenCode agent instructions in Markdown; `Task` with optional `task_id`; existing PDCA cycle contract.

**Spec:** `docs/superpowers/specs/2026-09-30-sol-check-architect-cost-design.md`

## Global Constraints

- Change only `config/skills/pdca-dotnet/SKILL.md` for this plan; preserve existing in-progress edits elsewhere in the working tree.
- Keep Sol, all existing CHECK streams, pass/fail gates, security trigger and iteration limit unchanged.
- Do not persist `task_id` in a status file during DO/CHECK; do not reuse it across tasks, changed PLANs or orchestrator sessions.
- Do not commit or push without a separate explicit user request. No edits to OpenCode sources, proxy, profiles or `check.md`.

## Review Focus

- A full updated report follows an earlier failed CHECK: only the current report supports pass/fail; test in Task 1 Step 4.
- CHECK → PLAN changes the acceptance criteria: the next CHECK starts a new session; test in Task 1 Step 4.
- A separate task begins in the same collection lane: its CHECK starts a new session; test in Task 1 Step 4.
- Compaction loses `task_id` or resume fails: CHECK still runs with a full report; test in Task 1 Step 4.
- A mandatory lens or triggered security verdict is missing: resume does not waive the normal gate; test in Task 1 Step 4.

---

## File Structure

- Modify `config/skills/pdca-dotnet/SKILL.md` near CHECK beat 2 (currently lines 904–911): owns the runtime dispatch and per-plan session lifecycle. Do not duplicate the rule in the state-machine gate or status-file contract.
- No new test file or script: this is a prompt contract, with a static assertion and an explicit scenario review. Provider cost requires a subsequent live measurement, not a Markdown assertion.

### Task 1: Keep CHECK session within one approved PLAN

**Files:**
- Modify: `config/skills/pdca-dotnet/SKILL.md` (CHECK beat 2)
- Test: static command and scenario matrix below; no new file

**Interfaces:**
- Consumes: `Task` returns `task_id`; a resumed call accepts `task_id`; the existing CHECK gather supplies the complete current report.
- Produces: instruction to retain `task_id` only for the active task and unchanged PLAN; all existing CHECK outputs remain unchanged.

- [ ] **Step 1: Write the failing contract assertion (run without modifying files)**

  Run: `python3 -c 'from pathlib import Path; s=Path("config/skills/pdca-dotnet/SKILL.md").read_text(); assert "task_id" in s'`
  Expected before edit: `AssertionError` because the skill has no `task_id` rule. This checks presence only; Step 4 checks semantics. (`CHECK → DO` was dropped from the assertion: it already occurs 3× in the skill, so it never fails.)

- [ ] **Step 2: Edit the CHECK beat-2 dispatch rule**

  Specify: first CHECK saves `Task`'s `task_id`; recheck after CHECK → DO for the same task and unchanged approved PLAN resumes it and supplies the full latest gather report; only that report is evidence. Reset after wrong-plan CHECK → PLAN, ACT, task/session boundary or lost ID; on failed resume call CHECK anew. Do not touch the existing CHECK gate or suppress any required lens. Define unchanged PLAN by unchanged acceptance criteria and design decision, not by iteration number alone.

- [ ] **Step 3: Run static and diff checks**

  Run: `python3 -c 'from pathlib import Path; s=Path("config/skills/pdca-dotnet/SKILL.md").read_text(); assert "task_id" in s' && git diff --check -- config/skills/pdca-dotnet/SKILL.md`
  Expected: zero exit status; inspect `git diff -- config/skills/pdca-dotnet/SKILL.md` to distinguish this change from pre-existing edits.

- [ ] **Step 4: Review five behavior scenarios against the new prose and the existing gates**

  Verify explicitly: (1) first failed CHECK → implementation fix → full updated green report uses the same ID and may pass on current evidence; (2) changed PLAN → new ID; (3) next task in a collection → new ID; (4) lost ID or failed resume → new full CHECK, not implicit pass; (5) resumed call with missing required test/doc/perf or triggered security conclusion → fail as before. Record any ambiguity as a correction in the same CHECK-beat-2 paragraph, then rerun Step 3. A live prompt-cache hit and decision-quality comparison are follow-up measurements, not claims of this static review.

## Deferred measurement

After installation in a fresh OpenCode process and with consent for paid calls, compare first and repeated CHECK on one unchanged PLAN using Zen cacheRead/cacheWrite and cost. Record how many real repeated calls occurred; if the provider does not return a cache hit or an old finding contaminates the new verdict, do not claim savings and revert the reuse instruction.
