# Enforce the PDCA inner-loop test gate — cycle 1, revision r1, attempt 1/3

- status: **PLAN complete — awaiting go**
- cycle: 1, revision r1, attempt 1/3 (normal mode)
- scope: this workspace only (config/skills repo; NOT .NET)
- source: planner r1 plan; evidence: nextorm #148-B unit D3 (~151 s of 692 s spent on repeated full solution build + full core/sqlite suites)

## Goal

Make affected-subset testing a required, verifiable DO contract — not merely advice: `coder` runs only the affected filtered subset during the inner loop; the full sweep runs once at the DO→CHECK boundary.

## Acceptance criteria

| Criterion | Positive acceptance | Negative acceptance |
|---|---|---|
| Complete DO brief | Every active implementation unit has a validated `test scope` (projects/files, exact filtered commands, rebuild policy, boundary sweep point). | Missing scope, empty selector, or unspecified boundary blocks dispatch to `coder`. |
| Enforced CHECK gate | CHECK requires scope/report validation and evaluates command evidence. | Missing commands/filters/exit codes, stale-artifact testing, silent widening, or whole-project/solution inner-loop testing → FAIL, not a warning. |
| Honest command history | Report lists actual build/test invocations incl. failures, phase, source/artifact revision, exit codes. | Only the final successful commands → insufficient. |
| Correct build lifecycle | Changed compiled inputs trigger an affected rebuild before `--no-build` tests. | "Build once" must not authorize testing stale binaries after another code edit. |
| Boundary discipline | One comprehensive sweep per actual DO→CHECK transition; CHECK may consume its fresh evidence. | A micro-edit or D-unit completion is not automatically a boundary; repeated broad runs cannot be relabelled "boundary". |
| Contract consistency | Both RU and EN coder bodies carry equivalent obligations; existing scoped tokens/headings intact. | One body updated, durable-state sections disturbed, or relying on `sync-roles` for body text → fail. |
| Regression protection | Existing tests green; new gate scenarios and contract-wiring tests pass. | A gate helper that is optional or disconnected from dispatch/CHECK → fail. |
| Scope safety | No nextorm changes without permission; no excluded-path or installation changes. | "Related cleanup" outside scope → fail. |

Enforcement boundary: this is mandatory dispatch/report validation plus CHECK rejection — not an OS-level interceptor; it cannot prove deliberate concealment.

## Minimal solution

- Essential goal: eliminate unjustified broad inner-loop runs while keeping correct, fresh coverage.
- Constraints: preserve PDCA gates, No-TDD ordering, unfinished-work semantics, role routing, project build requirements; avoid stale `--no-build` execution.
- Chosen solution: mandatory structured scope/evidence + a small executable validator + blocking instructions at dispatch and CHECK.

### Alternatives

| Approach | Benefit | Cost/risk |
|---|---|---|
| Stronger prose only | Smallest edit | Repeats the mechanism that already failed |
| Mandatory gates + small validator (chosen) | Deterministic rejection of malformed scope/prohibited commands; scenario-testable | Adds one standard-library helper + structured evidence |
| Command interception/wrapper | Prevent before execution | Larger rollout, bypass/compat risks; unnecessary |

### Executable policy

Affected subset:
1. Identify changed behavior/contracts and their direct regression tests.
2. Declare explicit projects/test files and nonempty selectors.
3. Record why the selection covers the affected behavior, with changed-path/test references.
4. Use selection/collection evidence to guard against empty matches and selectors that select the entire project.

Legal widening: allowed when a shared contract/dependency demonstrably affects additional tests; update+validate the scope BEFORE running; record dependency reason and additional selectors; widening stays filtered; whole-project/solution is boundary-only; if a focused subset is unsafe, enter the real boundary — not a disguised per-edit sweep.

Build reconciliation: on compiled-input change build the affected project/dependency closure, then `dotnet test <project> --no-build --filter <selector>`; do not repeat a full solution build after micro-edits; at the boundary do the required full solution build + comprehensive sweep; CHECK need not rerun a fresh boundary build for duplicate evidence; independent project requirements remain authoritative.

Validator: add `config/skills/pdca-dotnet/scripts/validate_inner_loop.py` (stdlib only):
- `brief <scope.json>` validates the mandatory scope before dispatch;
- `report <evidence.json>` validates scope conformance and execution evidence before CHECK passes;
- exit 0 valid, nonzero invalid/unreadable; never executes supplied commands; rejects unexpanded wrappers/compound commands whose scope cannot be verified; distinguishes intermediate failing tests from missing final success (retain failures in history; require applicable final checks green).
Schema records: exact argument arrays, selectors, projects/files, phase, source/artifact identity, exit codes, scope amendments, boundary identifier. Gates fail closed if the helper is missing/cannot run.

## Open prerequisites (targeted scout before implementation)

- Existing test entry points / filtered invocation syntax, Python requirements, coverage config (do not discover the runner by broad execution).
- Numeric coverage threshold (preserve if configured; else record "not configured").
- CHECK's authorized validation execution path and gate-1/dispatch hooks (bind to the existing runner; do not expand permissions).
- Installed-vs-source: this task changes source only.

## DO decomposition

| Unit | Footprint | Work |
|---|---|---|
| D1 — gate mechanism | new `config/skills/pdca-dotnet/scripts/validate_inner_loop.py`; new `config/skills/pdca-dotnet/tests/test_inner_loop_gate.py` | Implement brief/report validation + scenario fixtures (prohibited broad execution, widening, build freshness, boundary counting). Fix now. |
| D2 — wire the contract | `SKILL.md:276-300,387-417,476-480,502-511,738-796,862-903,928-934`; `tests/test_contract_consistency.py`; new gate tests | PLAN supplies scope; delegation refuses an incomplete brief; DO preserves evidence; CHECK requires validation and FAILs violations; keep immediate-stop semantics. Fix now. |
| D3 — sync executor instructions | `config/agents/coder.md:27-54`; `config/skills/pdca-dotnet/assets/agents/coder.md:21-47`; contract tests | Equivalent standalone inner-loop bullets in both languages, preferably after Evidence and before Git; preserve heading boundaries + durable-state/unfinished-work tokens. Fix now. |
| D4 — boundary verification | relevant tests; this status file | Run the single boundary sweep; verify gate wiring and scope safety; record commands/results/risks for CHECK. Fix now. |
| D5 — nextorm overlay | `/home/alex/sources/nextorm/.opencode/skills/nextorm-pdca/SKILL.md:109-125,186` | Deferred. Trigger: explicit user permission naming nextorm, then scout its build/test contract. No cross-repo write now. |

Execution mode: sequential in one tree, D1→D2→D3→D4.

## Test strategy

Repository is a config/skills repo — do NOT run `dotnet` here (.NET commands are fixture data). Use stdlib `unittest`; planned classes: BriefGateTests, ReportGateTests, ContractWiringTests (+ existing contract-consistency cases). New-suite command shape:
`python3 -m unittest discover -s config/skills/pdca-dotnet/tests -p test_inner_loop_gate.py -k <declared-class>` (prerequisite scout must confirm `-k` and the exact filtered/boundary commands).

## Variant matrix (each row = test or explicit guard)

Valid filtered .NET command → PASS; valid filtered Python command → PASS; missing/null scope, default/empty selector, zero selected tests → reject; whole project, whole solution, all-selecting filter, repeated solution build in inner loop → reject; shared-contract widening with prior validated amendment → PASS; silent widening / amendment after execution → reject; fresh affected build then `--no-build` → PASS; compiled edit after build then stale `--no-build` → reject; docs-only edit → no fictitious rebuild, run affected contract tests; Debug/Release/framework/provider options preserved, mismatch rejects; intermediate failure then applicable green → retain history + accept final; missing exit code / omitted selector / missing final green → reject; one real boundary sweep consumed by CHECK → PASS; multiple broad sweeps, fabricated boundaries, stale boundary evidence → reject; malformed JSON / unexpanded command / helper failure → fail closed; RU/EN drift or removed dispatch/CHECK gate → negative tests; real nextorm execution → deferred (D5).

## Priority matrix (P1 by construction; CHECK may not downgrade)

Incomplete scope dispatched; broad inner-loop accepted by CHECK; missing/incomplete evidence accepted; stale binaries tested; invalid widening/boundary relabelling accepted; validator optional/fail-open/disconnected; RU/EN obligations diverge or durable-state invariants break; unauthorized cross-repo/excluded-path/installation/git changes. P2: wording/example quality not affecting enforceability.

## Documentation plan

Update only: the listed SKILL sections; both coder bodies; `tests/scenarios.md` (valid/invalid scope, widening, stale-build, boundary); this status file. Document validator usage, evidence format, deployment limitation.

## Performance measurement

No application benchmark needed: affected paths are phase boundaries, not per-row; validator runs once per gate over small local files. Record validator elapsed time as a sanity check. The nextorm ~151/692 s figure is motivation, not a verified savings claim; before/after nextorm measurement deferred until authorization.

## Reconnaissance decision

Required targeted scout (see Open prerequisites); no solution-selection spike. If no authorized validation path or compatible Python runtime exists, return a concrete DO→PLAN candidate before implementation.

## Risks

Gate bypassed at dispatch/CHECK (mitigate: mandatory wiring + negative tests); overbroad/empty filters masquerade as affected (require selection evidence); literal "build once" produces stale tests (mandatory rebuild of changed inputs); source-vs-installed confusion; evidence incompleteness (CHECK rejects). Confidence: high in targets/decomposition; execution details contingent on the narrow scout.

## Constraints

No commits/push/install unless the user asks. Do not edit `config/skills/pdca-collection/**`. No model ids (roles only). D5 (nextorm) is another repo — needs explicit permission. This changes the contract, so acceptance requires mechanical enforcement (CHECK gate + brief requirement), both coder bodies in sync, existing tests green + new gate scenario tests.

## Progress log

2026-10-02T23:36Z | PLAN | revision r1 | iteration 1/3 | plan recorded (goal/A1-A8 test-scope gate/minimal solution+alternatives/executable policy/validator/D1-D5/variant+priority matrices/perf+recon decisions/risks) | docs/specs/status/enforce-pdca-inner-loop-1.md
- durable state (PLAN): cycle 1, plan revision r1, attempt 1/3; no replan; no rejected candidate; awaiting go.
- defect history: none observed.
