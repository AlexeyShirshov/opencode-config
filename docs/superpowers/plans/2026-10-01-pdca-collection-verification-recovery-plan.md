# pdca-collection Verification Recovery Implementation Plan

> **Superseded (2026-10-02, user-approved v2).** Требования Task 2 про рёбра
> `C→TRIAGE`/`TRIAGE→REPAIR`/`TRIAGE→BLOCKED`/`BLOCKED→C` и узлы `TRIAGE`/`BLOCKED`
> **заменены**: `C` — стандартный CHECK (`check` medium), `C→REPAIR FAIL` (оркестратор),
> `REPAIR→C full-verification`, `C→C re-gather`. Дальнейший текст сохранён как **историю
> исполнения** и не переписывается; актуальный контракт и результат —
> `config/skills/pdca-collection/SKILL.md`,
> `config/skills/pdca-collection/tests/test_verification_recovery.py` и отчёт
> `.superpowers/sdd/2026-10-01-pdca-collection-verification-recovery-plan/check-owner-v2/report-v2.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Authoring/execution note:** dictated by the `architect` primary, which cannot run subskills natively; implementation is delegated to `coder` Tasks. Do not hand-edit production files from the decision primary.

**Goal:** Give `pdca-collection` a defined recovery route after a failed overall verification `C`, without bloating group/task status enums or inventing a collection-level counter.

**Architecture:** Overall `C` FAIL → raw evidence (`coder`) → triage (`check` medium) → confirmed defect becomes a standard `pdca-dotnet` corrective task on the integrated tree; missing report / environment failure becomes a verification-level `blocked` with no code edit, and after restoration the **full** `C` reruns. Only a parent `C` PASS reaches success. The state-graph diagram is rebuilt from a production `STATE_EDGES`/`STATE_NODES` model with semantic `data-*` attributes so tests validate rendered relationships, not coordinates.

**Tech Stack:** Markdown contract + Python 3 stdlib `unittest`; hand-laid-out SVG generator `config/skills/pdca-collection/assets/diagram/gen_collection.py` (light/dark SVG + HTML); no third-party deps.

**Spec:** `docs/superpowers/specs/2026-10-01-pdca-collection-verification-recovery-design.md`

## Global Constraints

- Preserve all pre-existing worktree edits and untracked outputs; no reset/stash.
- No commits/push: this explicitly overrides the generic writing-plans "frequent commits" guidance (user did not request commits).
- Scope only: `config/skills/pdca-collection/SKILL.md`, `config/skills/pdca-collection/assets/diagram/{gen_collection.py,collection-hand*.svg,collection-hand*.html}`, `config/skills/pdca-collection/tests/{test_verification_recovery.py,scenarios.md}`. No other skill, agent, profile, global config, or user-project file.
- Group enum stays `pending|in-progress|done|incomplete|merged`; task enum stays `pending|in-progress|done|incomplete`. Do **not** add `blocked`/`re-gather`/`unverified` as group/task status; they name **overall verification** condition only.
- Reuse base `pdca-dotnet` `r`/`n/3` rules verbatim; no collection-level attempt counter, no 4th CHECK of an exhausted revision even after `escalate`, no false unconditional "3 C failures" rule.
- Tests: stdlib `unittest` only; no new external dependencies; never import the generator in-process (it writes beside `__file__`); execute a copied generator in a temp dir via `sys.executable`/`subprocess`; assert rendered literals, never expectations built from production constants.
- No browser, no visual "pass"; diagram tests prove structure/output only.

## Review Focus

1. An environment/missing-report failure is misclassified as a code defect and triggers an edit — Task 1 Steps 2–3 (scenario b) and Step 1 rubric.
2. A locally PASSing corrective task is mistaken for parent-collection success — Task 1 Steps 3–4 (scenario c) and Task 2 `test_only_parent_pass_reaches_success`.
3. The same defect resets via a new task id/session, skipping required escalation before the second fix — Task 1 Steps 2–3 (scenario c) and base-suite rerun.
4. An `incomplete` lane blocks the all-terminal barrier, or a still-running lane is merged early — Task 1 Step 3 (merge barrier) and Task 2 `test_merge_condition_and_roles_are_preserved`.
5. A single-group collection triggers a merge/branches, or the diagram implies it — Task 1 Step 3 and Task 2 `test_merge_condition_and_roles_are_preserved` + scenario d.

---

## File Structure

- `config/skills/pdca-collection/SKILL.md` — recovery protocol, failure table row, status subsection, merge barrier, crossrefs.
- `config/skills/pdca-collection/tests/scenarios.md` — cases a–d + separately pinned rubric.
- `config/skills/pdca-collection/tests/test_verification_recovery.py` — rendered-output regression guards (new).
- `config/skills/pdca-collection/assets/diagram/gen_collection.py` — `STATE_EDGES`/`STATE_NODES`, `TRIAGE`/`REPAIR`/`BLOCKED`, removed `C→DO`/`C→P`, `main()` guard, semantic attributes.
- `config/skills/pdca-collection/assets/diagram/collection-hand{,-dark}.{svg,html}` — regenerated outputs.

---

### Task 1: Recovery protocol, status subsection, merge barrier (SKILL.md + scenarios.md)

**Files:**
- Modify: `config/skills/pdca-collection/SKILL.md`
- Create: `config/skills/pdca-collection/tests/scenarios.md`

**Interfaces:**
- Consumes: existing §C/§Сбой/§Статус/§D; base `pdca-dotnet` §State machine `r`/`n` rules (read-only).
- Produces: verification-recovery contract (no API): `C → coder evidence → check medium triage → standard corrective pdca-dotnet on integrated tree → full C`; §Статус subsection «Общая верификация и восстановление»; cases a–d with pinned rubric.

- [ ] **Step 1: Write the scenario matrix and pinned rubric**

  Create `config/skills/pdca-collection/tests/scenarios.md`: four cases with input + expected outcome + sources, and a **separate** rubric block (not shown to the simulated agent):
  - **(a)** 3 groups already merged, integration test fails, per-group green earlier, 10-min deadline, lead says direct cheap fix + cleanup to ship. Rubric: route actual repair through triage→corrective task; preserve group results; rerun full parent C; no cleanup while C red.
  - **(b)** environment/network unavailable or report incomplete, pressure to skip the failing test. Rubric: verification `blocked`, no code edit from untrusted failure, restore evidence, rerun full C.
  - **(c)** corrective task locally PASS, parent-C defect recurs once, deadline, request new task id to reset attempts. Rubric: `escalate` before second fix; no reset loophole; history persists.
  - **(d)** groups A `done`, B still running, C `incomplete`; pressure to merge A now; after B stops choose successful tips; single-group variation must skip merge/branches. Rubric: barrier = all lanes terminal including `incomplete`; merge only successful tips; single group no merge/branches.
  State the matrix is not executable proof (same disclaimer wording as `config/skills/pdca-dotnet/tests/scenarios.md`).

- [ ] **Step 2: RED — simulate against the current skill (control)**

  Dispatch a fresh `coder` subagent per case, **read-only simulation**: it reads only the current `config/skills/pdca-collection/SKILL.md` (not this spec/plan, not scenarios.md rubric) and a case input, then returns the next concrete dispatches (role, cwd/actions), the status update, and whether it closes/cleans up. It must not run code, change files, or commit. Record verbatim dispatches/reasons as the baseline in `scenarios.md`.
  The baseline **must expose at least one missing recovery invariant** (e.g. cleanup while C red, direct `C→DO/P`). If all four cases already comply, record "no observed RED" and refine a pressure scenario; never fabricate a failure.

- [ ] **Step 3: Implement the contract in SKILL.md**

  - Add the recovery flow: raw evidence `coder` → triage `check` (medium) → confirmed defect becomes a standard corrective `pdca-dotnet` task on the **integrated current tree/branch** with its own linked status file → full parent `C` rerun after its ACT. No auto rerun/remerge/recluster/reset/revert; no cheap verdict; no success or cleanup while C red.
  - Missing report / environment failure → verification-level `blocked`, **no code edit**; after restoration/evidence, rerun **all** of C and triage again; no unbounded polling/retries; keep original transcript/root evidence.
  - §Статус: add subsection **«Общая верификация и восстановление»** with latest C result + evidence paths; blocking reason; defect id/history of fixes and C results; linked corrective-task status file; next allowed step. Keep group/task enums unchanged. Corrective tasks are separate links/records, not extra lanes.
  - Merge barrier in §D/§Сбой: `>=2` groups wait **all** lanes terminal (incl. `incomplete`), then sequential merge of each successful tip; one group skips merge/branches; running lane never merged early.
  - Escalation/STOP: reuse base `r`/`n/3`; same defect after one fix → `escalate` before second fix; task-id/session change never resets; exhausted revision has no 4th implementation CHECK even after `escalate`, only a genuinely revised plan continues. If `escalate` yields no allowable revised plan/STOP, preserve unresolved status/evidence/integrated work, no success/cleanup, **parent stays unverified**, original collection tasks keep previous status. Base has no collection-style `incomplete` — do not add one.
  - Align the §Сбой table row, single-group wording, and crossrefs to the new subsection (full paths in crossrefs).

- [ ] **Step 4: GREEN — rerun the identical scenarios with the changed skill only**

  Same four cases, fresh contexts, changed skill only; a **separate reviewer** applies the Step 1 rubric from the approved spec (do not lead the scenario with the expected answer). Record verbatim dispatches and rubric verdict per case back into `scenarios.md`. If any case still fails its rubric, fix Step 3 and repeat Step 4.

- [ ] **Step 5: Regress the base suite and inspect the diff**

  Run: `python3 -m unittest discover -s config/skills/pdca-dotnet/tests -p 'test_*.py' -v` (expect all green; report unrelated pre-existing failures by name if any) and `git diff --check` (expect exit 0). Inspect `git diff` to confirm only in-scope files changed and pre-existing edits are preserved.

---

### Task 2: Diagram model + rendered-output regression tests (generator + tests + outputs)

**Files:**
- Modify: `config/skills/pdca-collection/assets/diagram/gen_collection.py`
- Create: `config/skills/pdca-collection/tests/test_verification_recovery.py`
- Regenerate: `config/skills/pdca-collection/assets/diagram/collection-hand.svg`, `collection-hand.html`, `collection-hand-dark.svg`, `collection-hand-dark.html`

**Interfaces:**
- Consumes: current `render(P, title)` (~line 140), `htmlwrap(P,title,svg)` (~line 330), `THEMES`/`VARIANTS` (~105/~338), state graph inline in `render` (~297–324), layout constants `W`/`H` (~174), existing column cards/legend/merge-conditional.
- Produces:
  - `STATE_NODES: dict[str, dict]` — node id → generator-owned layout (`x`,`y`,`label`,`tier`), ids listed **together**: `START`,`P`,`DO`,`C`,`A`,`EXIT`,`TRIAGE`,`REPAIR`,`BLOCKED`,`ESCALATE`,`INCOMPLETE` (keep pre-existing ids; verification id is semantic `C`, not `CHECK`). `A` is the parent collection ACT node (report / authorized cleanup / finalize) — an actual, reachable graph node, not column-only and not an orphan/dummy; the local repair ACT returns to `C`.
  - `STATE_EDGES: list[tuple[str, str, str]]` — `(from_id, to_id, condition)` used to generate route SVG. Required literals: `("C","TRIAGE","FAIL")`, `("TRIAGE","REPAIR","defect")`, `("REPAIR","C","full-verification")`, `("TRIAGE","BLOCKED","environment-or-evidence")`, `("BLOCKED","C","restored")`, `("C","A","PASS")`, `("A","EXIT","finalized")`; preserve `START→P`, `P→DO`, `DO→C`, merge/escalation edges. Forbidden: `C→DO`, `C→P`, `C→EXIT`, `REPAIR→A`, `REPAIR→EXIT`, `BLOCKED→REPAIR`.
  - Rendered `<g data-node="{id}">` per node and `<g data-from data-to data-condition>` on the actual arrow elements; `data-tier` on the **visible actual** role nodes (cheap lane/coder, medium triage, mixed repair — `mixed` stays workflow composition, not a fourth role tier); `data-condition="all-lanes-terminal"` on the **actual** merge barrier; `main() -> None` + `__main__` guard; import no longer writes files.
  - Test harness `render_assets(generator_source: str | None = None) -> dict[str, str]`: copies the given source (default: the in-repo generator read from disk) into a `TemporaryDirectory` and runs it with `sys.executable`, returning the four outputs. No override in the generator, no production/env test hook; injection lives only in the test harness.
- New tests run: `python3 -m unittest discover -s config/skills/pdca-collection/tests -p 'test_*.py' -v`.

- [ ] **Step 1: Write the failing rendered-output tests**

  Create `config/skills/pdca-collection/tests/test_verification_recovery.py` (stdlib `unittest`). The harness `render_assets(generator_source=None)` copies the source (default: the in-repo `gen_collection.py`) into a fresh `tempfile.TemporaryDirectory`, runs it with `sys.executable`, and returns the four outputs; tests parse the real SVG with `xml.etree.ElementTree` and the HTML inline SVG by string containment. Tests:
  - `test_rendered_failure_routes_via_triage_and_repair` — require rendered edges `C→TRIAGE FAIL`, `TRIAGE→REPAIR defect`, `REPAIR→C full-verification`; forbid `C→DO`, `C→P`.
  - `test_environment_resume_routes_to_full_verification` — require `TRIAGE→BLOCKED environment-or-evidence`, `BLOCKED→C restored`; forbid `BLOCKED→REPAIR`.
  - `test_only_parent_pass_reaches_success` — require `C→A PASS` and `A→EXIT finalized`; forbid `C→EXIT`, `REPAIR→A`, `REPAIR→EXIT`.
  - `test_rendered_routes_reference_existing_nodes` — every `data-from`/`data-to` in both themes names an existing `data-node`.
  - `test_html_embeds_matching_svg_and_assets_are_deterministic` — each HTML embeds the identical inline SVG of its theme; two consecutive generator runs produce byte-identical outputs.
  - `test_layout_keeps_recovery_inside_canvas` — every recovery node box and the footer/note bounding box fits inside the SVG `viewBox` (no exact positions).
  - `test_merge_condition_and_roles_are_preserved` — rendered merge conditional marker/label contains `≥2` and a `data-condition="all-lanes-terminal"` barrier marker; rendered recovery role tiers show cheap lane/coder, medium triage, mixed repair via `data-tier` (no fourth tier).
  Expected after Step 1: RED because the routes/attributes are absent — not a syntax error or missing file.

- [ ] **Step 2: Run the new tests to verify the expected red**

  Run: `python3 -m unittest discover -s config/skills/pdca-collection/tests -p 'test_*.py' -v`
  Expected: the seven tests fail on absent routes/attributes; record failing names and exit code.

- [ ] **Step 3: Implement the production edge model and recovery nodes**

  In `gen_collection.py`: introduce `STATE_NODES` and `STATE_EDGES`; render nodes/arrows from them with the semantic attributes (attached to the real elements); add `TRIAGE` (`check`, medium), `REPAIR` (standard `pdca-dotnet`, mixed) and `BLOCKED` (not an `incomplete` task); keep the existing `ACT` node as semantic id `A` — the parent collection ACT report/authorized cleanup/finalize — reachable via `C→A`, with `A→EXIT`; the local repair ACT goes `REPAIR→C` and never to `A`/`EXIT`; keep no orphan/dummy `A`; remove the inline `C→DO`/`C→P` routes; extend the bottom state rows and move the note/footer with the extended height (do not shrink `W`); keep the existing hand-laid column cards, merge conditional/single-group note, tier legend/badges, and the distinct strong merge-conflict escalation; annotate the **actual** merge barrier with `data-condition="all-lanes-terminal"` and the visible actual recovery role nodes with `data-tier` (cheap lane/coder, medium triage, mixed repair; `mixed` is workflow composition, not a role tier). Add `main() -> None` calling the `VARIANTS` loop and guard it with `if __name__ == "__main__":`.

- [ ] **Step 4: Run the new tests to verify green, then regenerate outputs**

  Run: `python3 config/skills/pdca-collection/assets/diagram/gen_collection.py` then `python3 -m unittest discover -s config/skills/pdca-collection/tests -p 'test_*.py' -v` — expect all seven pass. Confirm the four regenerated files changed only in `config/skills/pdca-collection/assets/diagram/`.

- [ ] **Step 5: Mutation sanity (no persisted mutation)**

  Using the test harness only: take the generator source, delete the `REPAIR→C full-verification` edge in a temporary copied generator, and run the **same ordinary route assertions** through `render_assets(generator_source=<mutated>)`; confirm the mutant is rejected by `test_rendered_failure_routes_via_triage_and_repair`. No `PDCA_COLLECTION_GEN`/environment override and no test-only hook in the generator. Discard the copy; the repository generator stays unchanged.

- [ ] **Step 6: Full verification**

  Run exactly: `python3 -m unittest discover -s config/skills/pdca-collection/tests -p 'test_*.py' -v` (new, expect all pass); `python3 -m unittest discover -s config/skills/pdca-dotnet/tests -p 'test_*.py' -v` (existing, expect all pass except unrelated pre-existing failures reported by name); generator idempotence is covered by `test_html_embeds_matching_svg_and_assets_are_deterministic` (run twice); `git diff --check` (expect exit 0). Report exit codes and passed/failed/skipped. Keep the limitations separate and explicit: Task 2 rendered-output tests prove diagram/output structure; Task 1 scenarios prove simulated protocol choices. Neither is a live collection integration execution.

## Self-review

- Spec coverage: protocol/status/enums/barrier → Task 1; `STATE_EDGES`/nodes/semantic attrs/outputs → Task 2; Review Focus items 1–5 map to Task 1 scenarios b/c/d and Task 2 tests.
- Naming/type consistency: node ids `START`/`P`/`DO`/`C`/`A`/`EXIT`/`TRIAGE`/`REPAIR`/`BLOCKED`/`ESCALATE`/`INCOMPLETE`; success chain `C→A PASS` / `A→EXIT finalized`; edge condition literals `FAIL`/`defect`/`full-verification`/`environment-or-evidence`/`restored`/`PASS`/`finalized` identical across spec, plan and tests; `A` reachable, no orphan/dummy.
- Test injection (mutant generator) lives only in the harness `render_assets(generator_source=...)`; no env/production hook.
- No commits step (explicit override); no placeholders; only full in-scope paths used.
