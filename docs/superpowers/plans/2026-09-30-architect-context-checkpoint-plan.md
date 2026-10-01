# Architect Context Checkpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce repeated reading of a long `architect` conversation without losing decisions or interrupting unfinished design work.

**Architecture:** Add a semantic checkpoint rule to the `architect` agent instructions. At a completed decision or task transition it produces a short handoff; if the context is long it offers the user manual compaction or a new session, then verifies the handoff before further decisions.

**Tech Stack:** OpenCode agent instructions in Markdown; existing manual TUI session compaction.

**Spec:** `docs/superpowers/specs/2026-09-30-sol-check-architect-cost-design.md`

## Global Constraints

- Change only `config/agents/architect.md` for this plan; preserve pre-existing worktree edits.
- Keep Sol, scout-only fact gathering, coder-only implementation and the autonomous PDCA contract unchanged.
- No arbitrary turn cap, forced mid-decision compaction, automatic compaction claim or unrequested persistent handoff file; do not include secrets in a handoff.
- Do not commit or push without a separate explicit user request.

## Review Focus

- A decision is still in progress: no forced checkpoint or session switch; test in Task 1 Step 4.
- A task boundary has been reached: handoff includes decisions, reasons, constraints, open questions, pointers and next step; test in Task 1 Step 4.
- Context is long but the user does not compact it: no agent-initiated automatic compaction claim; test in Task 1 Step 4.
- A restored summary disagrees with the handoff: re-establish facts before new design; test in Task 1 Step 4.
- A handoff might expose credentials or overwrite the autonomous PDCA flow: exclude secrets and leave that contract intact; test in Task 1 Step 4.

---

## File Structure

- Modify `config/agents/architect.md` under `## Как тратить себя` (currently lines 35–40): owns the interaction and handoff rules. Do not change profile bindings, TUI keybinds or the PDCA skill.
- No new test file or script: use a static heading assertion and a focused scenario review of the Markdown contract.

### Task 1: Add decision-preserving context checkpoints

**Files:**
- Modify: `config/agents/architect.md` (`## Как тратить себя`)
- Test: static command and scenario matrix below; no new file

**Interfaces:**
- Consumes: completed decision or task transition; existing `scout` pointers and user-visible manual compact/new-session choice.
- Produces: brief handoff with decisions, rationale, constraints, open questions, pointers and next step; no changed model/tool routing.

- [ ] **Step 1: Write the failing contract assertion (run without modifying files)**

  Run: `python3 -c 'from pathlib import Path; s=Path("config/agents/architect.md").read_text(); assert "## Контрольная точка контекста" in s'`
  Expected before edit: `AssertionError` because no such section exists.

- [ ] **Step 2: Add a small `## Контрольная точка контекста` section**

  Specify triggers (completed decision or task transition), handoff fields (decisions, why, constraints, open questions, document/scout pointers, next step), no secrets or verbose transcript; when long, *suggest* manual compaction or a new session; never interrupt an unresolved decision or claim to compact automatically; after continuation reconcile restored context before deciding further. Keep the existing scout/coder delegation intact.

- [ ] **Step 3: Run static and diff checks**

  Run: `python3 -c 'from pathlib import Path; s=Path("config/agents/architect.md").read_text(); assert "## Контрольная точка контекста" in s' && git diff --check -- config/agents/architect.md`
  Expected: zero exit status; inspect `git diff -- config/agents/architect.md` to distinguish this addition from pre-existing edits.

- [ ] **Step 4: Review five behavior scenarios against the new instructions**

  Verify explicitly: (1) unresolved choice → no checkpoint; (2) finished decision/task boundary → all handoff fields present without a transcript; (3) user continues same long session → suggestion only, no forced compact; (4) restored summary disagrees → fact recovery before new design; (5) secret in source or autonomous PDCA cycle → exclude secret and do not alter PDCA rules. Correct ambiguity in the same section and rerun Step 3.

## Deferred measurement

After installation in a fresh OpenCode process, compare Zen cacheRead/cost for comparable completed decisions rather than total per day; check that decisions survive a manual handoff. Do not promise a saving or initiate compaction on behalf of the user.
