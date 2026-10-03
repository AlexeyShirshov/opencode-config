# Status — universal-pdca-diagram

- Goal: make the universal `pdca` skill ship its own stack-neutral hand diagram and canonical `workflow.json` under `config/skills/pdca/assets/diagram/`, without touching the `pdca-dotnet` artifacts.
- Current cycle N: 1
- Plan revision r: 3 (via escalate option B; r2 exhausted after 3 failed CHECKs, no 4th)
- Attempt n: 1/3
- Task: universal-pdca-diagram
- Notice: todowrite unavailable in this host; status file is source of truth.

## Acceptance criteria

- **AC1** — `config/skills/pdca/assets/diagram/` has `gen_pdca.py` + `pdca-hand.svg` + `pdca-hand.html` + `pdca-hand-dark.svg` + `pdca-hand-dark.html` (+ `pdca.html` only if archify ran); exactly ONE `workflow.json` canonical copy (moved); no dangling old-path refs.
  - Negative: missing hand file / duplicate `workflow.json` / stale `assets/workflow.json` reference.
- **AC2** — grep over ENTIRE `config/skills/pdca` tree for forbidden tokens (`dotnet-`/`dotnet`, `docfx`, `xunit`, `tunit`, `CS1591`, `TreatWarningsAsErrors`, `Testcontainers`, `EF Core`, `csharp`, case-insensitive) = 0 matches.
  - Negative: any hit (especially SVG line 41/120).
- **AC3** — re-running `python3 gen_pdca.py` is byte-identical (idempotent); the SVGs parse as well-formed XML.
  - Negative: parse error / nondeterminism.
- **AC4** — HTML/SVG valid, generic labels, HTML `<title>` is `pdca`, not `pdca-dotnet`.
  - Negative: stale title / broken markup.
- **AC5** — `diff -r config/skills/pdca ~/.config/opencode/skills/pdca` empty.
  - Negative: divergence.
- **AC6** — `pdca-dotnet` diagram files byte-unchanged.
  - Negative: modified.
- **AC7** — no commit/push; tree uncommitted.
  - Negative: staged/committed change.

## Task list

- D1 — MOVE canonical `workflow.json` into `assets/diagram/` (single copy) + fix path references; grep to confirm no remaining `assets/workflow.json` ref under `config/skills/pdca`.
- D2 — copy + generalize `gen_pdca.py` (exactly five label/comment strings changed).
- D3 — run generator; expect 4 hand files.
- D4 — add stdlib `unittest` guard `tests/test_diagram_artifacts.py` (no forbidden-token literal).
- D5 — conditional Archify viewer (`pdca.html`) or deferred Notice.
- D6 — minimal README update (universal skill rebuild path).
- D7 — verification: idempotency, XML parse (SVG + embedded HTML SVG), token grep, full suite, dotnet baseline unchanged.
- D8 — mirror LAST via rsync + `diff -r`, then finalize this status file.

## Plan revision 2 (reconciliation=b — neutralize embedded viewer fonts)

CHECK of r1 returned failure. Replan kind = **reconciliation=b**: the goal and acceptance
criteria are unchanged; the only change is *how* the Archify viewer is integrated — instead
of dropping `pdca.html` (r1 Notice), keep the viewer and remove only its embedded font
resources with a generic, deterministic post-processor. D1–D8 remain **active**, not
superseded; their criteria and remaining work carry over unchanged.

### Priority matrix

- **P1 (must hold this revision):**
  - AC1 retained viewer: ship `pdca.html` in `config/skills/pdca/assets/diagram/` (r1 omitted it — unauthorized).
  - Whole-tree AC2 = **0** forbidden-token matches (the embedded `data:font/…;base64` blob was the only hit).
  - AC4 title / validity: `pdca.html` `<title>` starts with `pdca` and never the forbidden contiguous title; embedded `<svg>` well-formed.
  - Original invariants: idempotent generator, `pdca-dotnet` baseline byte-unchanged, no commit/push.
- **P2 (non-contractual):** typography/visual fidelity of the viewer after font removal — best-effort, not gated.

### Defect history

| defect key | revisions / attempts observed | fixes applied | evidence | last outcome |
| --- | --- | --- | --- | --- |
| `viewer-deferred-on-forbidden-font` | r1 n1 | 0 (viewer dropped) | `docs/specs/status/universal-pdca-diagram-1.md` Notice; `/tmp/pdca-universal-diagram/archify.log` | r1 CHECK failed: AC1 viewer omission unauthorized; AC4 title evidence & evidence gaps |
| `viewer-deferred-on-forbidden-font` | r2 n1 | 1 (reconciliation=b: generic `@font-face`/`data:font` removal) | `config/skills/pdca/assets/diagram/neutralize_viewer.py`; `/tmp/pdca-universal-diagram/r2/*.log` | **resolved**: `pdca.html` shipped (723137 B), whole-tree token grep exit 1 / 0 matches; DEFER=none |
| `neutralizer-not-fail-closed` | r2 n1–n3 (3 failed CHECKs) → escalate r=3 n1 | 1 (escalate option B: fail-closed postcondition guard + regression tests) | `config/skills/pdca/assets/diagram/neutralize_viewer.py`; `config/skills/pdca/tests/test_neutralize_viewer.py`; `/tmp/pdca-universal-diagram/r3/*.log` | **resolved (r3 n1)**: guard returns 3 without writing when `out` still has `data:font/` or a `@font-face` block still has `;base64,`; regen byte-identical; suite exit 0 Ran 83 OK |

## Plan revision 3 (escalate option B: fail-closed guard + regression tests)

CHECK of r2 exhausted all 3 attempts without a 4th allowed; `escalate` authorized r=3 n=1.
Scope is additive/hardening only — the goal, AC1–AC7, D1–D12 and their evidence carry over
unchanged. Changes: (1) `main` computes `out = neutralize(data)` before any write and
refuses (stderr `unsupported font placement — STOP→PLAN`, `return 3`, output untouched) when
the result still contains `data:font/` or a surviving `@font-face` block still contains
`;base64,`; success path stays byte-identical. (2) new regression suite
`tests/test_neutralize_viewer.py` (stdlib `unittest`, synthetic, offline). (3) extend
`tests/test_diagram_artifacts.py` with viewer font-free/payload/`<script>`-count/re-neutralize
assertions. Existing artifacts are NOT rebaselined: `pdca.html` sha256 prefix must stay
`1e71edfb`.

## Notice: Archify viewer DEFERRED

`node /home/alex/.agents/skills/archify/bin/archify.mjs deliver workflow config/skills/pdca/assets/diagram/workflow.json config/skills/pdca/assets/diagram/pdca.html --quality showcase --json` **succeeded** (exit 0, ok=true, 9/9 validation checks passed, log `/tmp/pdca-universal-diagram/archify.log`). The produced `pdca.html` was **not kept**: archify inlines an embedded base64 `woff2` font whose payload coincidentally contains the forbidden substring `tunit` (case-insensitive; 1 hit), which would break AC2 and `test_contract_consistency.ForbiddenTokenGuardTest`. The same payload contains `tunit` at `--quality standard` too, and archify exposes no flag to disable font embedding, so a clean viewer is not achievable with the mandated command. Kept the 4 stack-neutral hand files only.

Trigger to retry: archify/`node` available **and** an archify build that does not inline font data (or a documented scan exclusion for the genuine base64 payload); then re-run the deliver command above and re-check the token grep.

> **r2 update (reconciliation=b):** this Notice is addressed without an archify change — the viewer is rebuilt and the embedded `@font-face`/`data:font` resources are removed by a generic deterministic post-processor (`assets/diagram/neutralize_viewer.py`), keeping the viewer and its non-font bytes.

## Done / Verified

- D1 MOVE canonical workflow (one copy): `mv` exit 0; `find config/skills/pdca -name workflow.json` → only `assets/diagram/workflow.json`; no `assets/workflow.json` ref remains (grep exit 1); refs updated in `tests/test_routing_consistency.py:22` and `tests/scenarios.md:12,41`.
- D2 generalized generator: `diff -u pdca-dotnet/gen_pdca.py pdca/gen_pdca.py` shows exactly the five intended label/comment changes, nothing else.
- D3 generate: `python3 gen_pdca.py` exit 0; 4 files written (`pdca-hand.svg`, `pdca-hand.html`, `pdca-hand-dark.svg`, `pdca-hand-dark.html`).
- D4 new guard `tests/test_diagram_artifacts.py` (stdlib `unittest`, no forbidden-token literal, no subprocess); standalone run exit 0, 6 tests OK.
- D5 Archify: built exit 0 (9/9 validation) but viewer deferred — see Notice above.
- D6 README updated minimally (universal `pdca` diagram rebuild path under `config/skills/pdca/assets/diagram/`; viewer only if archify available).
- D7 verification (logs in `/tmp/pdca-universal-diagram/`):
  1. Idempotency: `gen_pdca.py` re-run exit 0; `diff -u hand.first hand.second` empty (0 lines, exit 0). Hashes: svg `d061de5a…`, html `e37b9602…`, dark svg `0a3b4cc6…`, dark html `86820532…`.
  2. XML: bare `pdca-hand*.svg` parse exit 0; embedded `<svg>` in both `pdca-hand*.html` parse exit 0.
  3. Token grep over entire `config/skills/pdca` (excl. `__pycache__`): exit **1**, 0 matches.
  4. Full suite `python3 -m unittest discover -s config/skills/pdca/tests -p 'test_*.py' -v`: exit 0, **69 tests OK, 0 failures/errors**.
  5. `pdca-dotnet` baseline: `diff -u dotnet.before dotnet.after` empty (0 lines, exit 0).
- D8 mirror: `rsync -a --delete config/skills/pdca/ ~/.config/opencode/skills/pdca/` exit 0; `diff -r` exit 0, empty.
- AC7: no commit/push performed; `config/skills/pdca/` remains untracked (`??`), nothing staged (0 staged paths).

## Done / Verified (r2, reconciliation=b)

- **D9 facts recovered** (log dir `/tmp/pdca-universal-diagram/r2/`):
  - AC2 matcher: `tests/test_contract_consistency.py:28-47` `forbidden_tokens()` assembles the 9 patterns at runtime via `_cat(*fragments)` → `"".join(fragments)` (fragment concatenation prevents compile-time folding into the `.pyc`); `scan_tree()` at `:84-95` recurses `root.rglob("*")`, skips `__pycache__`, reads every file as UTF-8 and lowercases before `p.lower() in low`. `PDCA_DIR = REPO/"config/skills/pdca"` (`:24`). Confirmed whole-tree recursion.
  - `/tmp/pdca-universal-diagram/dotnet.before` (mtime 09:11:26, before the 09:12 edits) is the ORIGINAL pre-edit baseline; copied to `r2/dotnet.baseline.sha256` (860 B, 7 files).
  - `git rev-parse HEAD` = `1a37b3c6d0ca8766d4465ea66a6afc70dc064a9a`; `config/skills/pdca/` untracked (`??`), `git ls-files` empty.
  - `assets/diagram/workflow.json:6` = `"output": "pdca.html"`.
  - Validators probe: `node` `/usr/bin/node`, `python3` `/usr/bin/python3` present; `tidy`, `html5validator`, `xmllint` MISSING (so validity is proven with stdlib `xml.etree` parse only).
- **D10 viewer rebuilt + neutralized:**
  - `archify deliver … --quality showcase --json` exit **0**, ok=true, **9/9** checks, 0 errors/warnings; artifact 813198 B, sha256 `f6b49823…`; log `r2/archify-showcase.log`.
  - `assets/diagram/neutralize_viewer.py` added: generic brace-aware removal of `@font-face` rules containing `data:font/` + `;base64,`; no token literal, no hardcoded token list; preserves all other bytes; idempotent.
  - Removed 6 embedded JetBrains-Mono font rules (~90 KB). `pdca.html` = **723137 B** (>300 KB), contains 0 `@font-face`, 0 `data:font/`, 1 `<svg`, 4 `<script>`.
  - Whole-tree token grep immediately after (excl. `__pycache__`) exit **1**, **0** matches (`r2/tokens-early.log`).
- **D11 test extended:** `tests/test_diagram_artifacts.py` now also asserts `pdca.html` exists/non-empty, title starts with `pdca` and lacks the runtime-assembled bad title (`"pdca-" + "dot" + "net"`), embedded `<svg>` well-formed, and prints titles for both hand HTML files and the viewer; no forbidden literal.
- **D12 evidence:**
  1. `gen_pdca.py` twice → exit 0/0; `sha256sum pdca-hand*.{svg,html}` before/after `diff` **0 lines** (`r2/hand.diff`).
  2. Neutralizer on its own output → byte-identical (`cmp` exit **0**), sha256 `1e71edfb…` (`r2/neutralize.hashes`).
  3. XML: both standalone SVGs parse (root `{http://www.w3.org/2000/svg}svg`); embedded `<svg>` in both hand HTML + `pdca.html` parse (exit **0**); `r2/xml-titles.log`.
  4. Whole-tree token grep: exit **1**, **0** matches (`r2/tokens.log`).
  5. Suite `python3 -m unittest discover … -v`: exit **0**, `Ran 73 tests`, **OK** (0 failures/errors), `r2/unittest.log`.
  6. `sha256sum -c r2/dotnet.baseline.sha256`: exit **0**, all **7 OK** (`r2/dotnet.check.log`).
  7. Mirror `rsync -a --delete config/skills/pdca/ ~/.config/opencode/skills/pdca/` exit **0**; `git diff --no-index --stat` exit **0**, **0 lines** — identical.
  8. `git status --short`: `?? config/skills/pdca/` only; nothing staged; HEAD unchanged.
- **DEFER=none.** No commit/push performed.
- Emitted titles: light = `pdca — ручная раскладка`; dark = `pdca — ручная раскладка (тёмная тема)`; viewer = `pdca: оркестратор и фазы цикла Diagram`.

## Done / Verified (r3, escalate option B)

- **T1 fail-closed guard** — `config/skills/pdca/assets/diagram/neutralize_viewer.py`:
  `main` now computes `out = neutralize(data)` before writing and refuses (stderr
  `unsupported font placement — STOP→PLAN`, `return 3`, no create/replace) when `out`
  still contains `data:font/` or a surviving `@font-face` block still contains `;base64,`
  (`_has_unsupported_font`). Success path writes `out` verbatim (brace rule unchanged).
  - Regeneration from the raw archify output `r2/pdca-showcase.html` → `r3/pdca.regenerated.html`,
    `cmp` exit **0**, byte-identical (`r3/regen.cmp.log`).
  - `pdca.html` sha256 before = after = `1e71edfb608ab575d2bf93e19c827d206fbde69cd5ed8ffcc3da4b0b00d011ca`
    (`r3/pdca.sha.before`, `r3/pdca.sha.after`, `r3/pdca.sha.final`). Not rebaselined.
  - Failure path sanity: unsupported input → exit **3**, no output file (`r3/unsupported.*`).
  - `py_compile` exit 0; no forbidden-token literal, no hardcoded token list (only the
    three generic constants).
- **T2 new regression suite** `config/skills/pdca/tests/test_neutralize_viewer.py`
  (stdlib `unittest`, synthetic temp dirs, offline, module loaded by file path): **7 tests OK**
  (`r3/suite.log`). Covers font present (exact removal + byte preservation), payload
  preservation + re-insertion reconstruction, nested braces/adjacent bytes, font absent,
  idempotency, and fail-closed `main` (exit non-zero, no output; existing output untouched).
- **T3 extended** `config/skills/pdca/tests/test_diagram_artifacts.py`: viewer has no
  `@font-face`/`data:font`, retains `<svg` + exactly 4 `<script` + `edges: edges, nodes: nodes`,
  and re-neutralizing the real `pdca.html` via `main` is byte-identical (exit 0). Existing
  title check kept (`startswith("pdca")` + runtime-assembled bad title; exact equality NOT
  required). File now 13 tests OK.
- **T4 N/A rows** recorded in `r3/MATRICES.md`: provider/value-vs-reference = **N/A**
  (static artifact, no runtime variants); browser smoke = **accepted documented limitation**
  (no `tidy`/`html5validator`/`xmllint`/headless; only `node` + `python3`; validity via
  stdlib `xml.etree`). Variant matrix updated with proving test names.
- **T5 re-verify + mirror** (all logs+exit under `/tmp/pdca-universal-diagram/r3/`):
  1. `python3 -m unittest discover -s config/skills/pdca/tests -p 'test_*.py' -v` → exit **0**,
     `Ran 83 tests`, **OK** (0 failures/errors); includes the new file (`r3/suite.log`, `r3/suite.exit`).
  2. Whole-tree `grep -RInaEi --exclude-dir=__pycache__ '<9 tokens>' config/skills/pdca` → exit **1**,
     **0** matches, no other exclusions, new tests included (`r3/ac2.log`, `r3/ac2.exit`).
  3. `python3 gen_pdca.py` ×2 → exit 0/0; hand-file sha `diff` **0 lines**; both standalone SVGs
     well-formed XML; `pdca.html` sha256 unchanged `1e71edfb…` (`r3/gen.log`, `r3/gen.exit`,
     `r3/gen.hand.diff`, `r3/xml.log`).
  4. `rsync -a --delete config/skills/pdca/ ~/.config/opencode/skills/pdca/` exit 0;
     `git diff --no-index --stat` exit 0, **0 lines** — identical (`r3/mirror.log`, `r3/mirror.exit`).
  5. `sha256sum -c /tmp/pdca-universal-diagram/r2/dotnet.baseline.sha256` → exit **0**, **7/7 OK**
     (`r3/dotnet-baseline.log`, `r3/dotnet-baseline.exit`).
  6. `git rev-parse HEAD` = `1a37b3c6d0ca8766d4465ea66a6afc70dc064a9a`; `git status --short` shows
     `?? config/skills/pdca/`; nothing staged; no commit/push (`r3/git.log`, `r3/git.exit`).
- **DEFER=none.** **No commit/push performed.**

## Progress log

2026-10-03T04:11:36Z | DO | r1 | n1/3 | DO started | status file created; baseline grep over config/skills/pdca = clean (exit 1); dotnet baseline -> /tmp/pdca-universal-diagram/dotnet.before
2026-10-03T04:11:43Z | DO | r1 | n1/3 | D1 moved workflow.json | single copy at assets/diagram/workflow.json; refs fixed; stale-ref grep exit 1
2026-10-03T04:12:06Z | DO | r1 | n1/3 | D2 generator generalized | diff vs dotnet = exactly 5 lines; D3 gen exit 0, 4 hand files
2026-10-03T04:12:22Z | DO | r1 | n1/3 | D4 guard test added | test_diagram_artifacts.py 6 tests OK; token grep exit 1
2026-10-03T04:12:30Z | DO | r1 | n1/3 | D5 archify built but viewer deferred | exit 0, 9/9 checks; pdca.html dropped due to forbidden substring `tunit` in embedded base64 font (would break AC2); see Notice
2026-10-03T04:13:07Z | DO | r1 | n1/3 | D6 README updated | D7.1 idempotency diff empty; D7.2 XML parse exit 0
2026-10-03T04:13:17Z | DO | r1 | n1/3 | D7 verification | token grep exit 1 (0 hits); suite exit 0, 69 tests OK; dotnet baseline diff empty
2026-10-03T04:13:25Z | DO | r1 | n1/3 | D8 mirror | rsync exit 0; diff -r exit 0 empty
2026-10-03T04:13:32Z | DO | r1 | n1/3 | DO complete pending CHECK | no commit/push; tree uncommitted (AC7)
2026-10-03T09:19Z | DO | r2 | n1/3 | Replanned: CHECK→PLAN (r1 failed: AC1 viewer omission unauthorized, AC4 title evidence, evidence gaps) — reconciliation=b: neutralize embedded viewer fonts | D1–D8 remain active, not superseded; P1 = AC1 retained viewer, whole-tree AC2 = 0 tokens, AC4 title/validity, original invariants; P2 = non-contractual typography; defect key `viewer-deferred-on-forbidden-font` fixes applied=1
2026-10-03T09:19Z | DO | r2 | n1/3 | D9 facts recovered | matcher test_contract_consistency.py:28-47 (_cat) + scan_tree :84-95 whole-tree; dotnet.before is original (mtime 09:11:26); HEAD 1a37b3c6; pdca untracked; workflow.json:6 output=pdca.html; validators: node/python3 only (no tidy/html5validator/xmllint)
2026-10-03T09:20Z | DO | r2 | n1/3 | D10 viewer rebuilt + neutralized | archify exit 0, 9/9 checks, 813198 B; neutralize_viewer.py added; 6 font rules removed, pdca.html 723137 B, 0 @font-face / 0 data:font; early token grep exit 1, 0 matches
2026-10-03T09:20Z | DO | r2 | n1/3 | D11 test extended | pdca.html existence/title/embedded-svg + title print; file free of forbidden literal
2026-10-03T09:20Z | DO | r2 | n1/3 | D12 evidence | gen idempotent diff 0; neutralizer byte-identical cmp 0; XML all parse; token grep exit 1/0; suite exit 0 Ran 73 OK; dotnet baseline 7 OK; mirror diff 0 lines; nothing staged
2026-10-03T09:20Z | DO | r2 | n1/3 | DO complete pending CHECK | AC1 viewer shipped; AC2 0 tokens; AC4 titles generic; DEFER=none; no commit/push
2026-10-03T04:22:59Z | DO | r2 | n2/3 | Replanned/loop-back: CHECK r2 fail = evidence-only (reference audit, generator comparison log, git-state evidence, docs disposition); no code defect | defect history unchanged; no D-unit superseded
2026-10-03T04:22:59Z | DO | r2 | n2/3 | E1 dangling-ref audit | stale `assets/workflow.json` grep exit 1/0 hits; old full path 1 hit = `docs/specs/status/universal-pdca-skill-1.md:170` (historical, out-of-scope); shipped refs 0 to fix; canonical refs test_routing_consistency.py:22 + scenarios.md:12,41; exactly 1 workflow.json (`r2/e1.*`)
2026-10-03T04:22:59Z | DO | r2 | n2/3 | E2 generator comparison | `git diff --no-index` exit 1, 5 changed line-pairs (40-line diff, only intended labels); idempotency gen exit 0, `hand.first`==`hand.second` diff 0 lines exit 0; neutralizer cmp exit 0 byte-identical (1e71edfb…) (`r2/e2.*`, `hand.*`, `pdca.cmp.*`)
2026-10-03T04:22:59Z | DO | r2 | n2/3 | E3 git-state (AC7) | HEAD `1a37b3c6` unchanged; `?? config/skills/pdca/` untracked; `git diff --cached --stat` empty exit 0; log -1 `1a37b3c`; no commit, no push (`r2/e3.*`)
2026-10-03T04:22:59Z | DO | r2 | n2/3 | E4 docs disposition | README diff 1 hunk (D6, pre-existing); scenarios.md:12,41 already new path (untracked, no git diff); only scenarios.md refs diagram under skill; SKILL.md diagram refs = 0 (mention optional); no required change (`r2/e4.*`)
2026-10-03T04:22:59Z | DO | r2 | n2/3 | tokens freshness + evidence summary | whole-tree token grep exit 1, 0 matches (`r2/tokens.n2.log`); summary `/tmp/pdca-universal-diagram/r2/EVIDENCE.r2n2.md`; no code/asset edits, no commit/push
2026-10-03T04:25:08Z | DO | r2 | n3/3 | iteration n=3/3 | EVIDENCE-ONLY; no code/asset edits, no commit/push
2026-10-03T04:25:08Z | DO | r2 | n3/3 | loop-back: CHECK r2 n2 fail = evidence packaging only (traceable exit logs for suite + .NET baseline; relay PLAN matrices); no code change | no code/asset edits
2026-10-03T04:26:00Z | DO | r2 | n3/3 | n3 evidence artifacts packaged | suite exit 0 Ran 73 OK; dotnet baseline exit 0 7/7 OK; token-grep exit 1 0 lines; matrices relayed; `pdca-dotnet/assets/diagram/` unchanged; HEAD still `1a37b3c`; nothing staged

## r2 n3 evidence pointers (EVIDENCE-ONLY)

- `/tmp/pdca-universal-diagram/r2/suite.log` (+ `suite.exit` = **0**) — `Ran 73 tests`, `OK`, 0 failures/errors.
- `/tmp/pdca-universal-diagram/r2/dotnet-baseline.log` (+ `dotnet-baseline.exit` = **0**) — 7/7 `OK` against the ORIGINAL pre-edit baseline `r2/dotnet.baseline.sha256`.
- `/tmp/pdca-universal-diagram/r2/token-grep.log` (+ `token-grep.exit` = **1**) — 0 lines / 0 forbidden-token matches over `config/skills/pdca`.
- `/tmp/pdca-universal-diagram/r2/MATRICES.md` — FROZEN r2 PLAN priority + variant matrices, per-row test/line and log references.
- `pdca-dotnet/assets/diagram/` byte-unchanged; HEAD `1a37b3c`; nothing staged; no commit/push.

2026-10-03T04:32:17Z | DO | r3 | n1/3 | Replanned via escalate: fail-closed guard + regression tests for neutralize_viewer.py | status header r=3 n=1/3; defect key `neutralizer-not-fail-closed` fixes applied=1; evidence `/tmp/pdca-universal-diagram/r3/`
2026-10-03T04:32:17Z | DO | r3 | n1/3 | T1 fail-closed guard added | `neutralize_viewer.py` `_has_unsupported_font` + `main` computes `out` before write; regen `cmp` exit 0 byte-identical; `pdca.html` sha `1e71edfb…` unchanged; guard failure exit 3 (`r3/regen.cmp.log`, `r3/pdca.sha.*`, `r3/unsupported.*`)
2026-10-03T04:32:17Z | DO | r3 | n1/3 | T2 regression suite added | `test_neutralize_viewer.py` 7 tests OK (`r3/suite.log`)
2026-10-03T04:32:17Z | DO | r3 | n1/3 | T3 diagram guard extended | `test_diagram_artifacts.py` viewer font-free/payload/script-count/re-neutralize; 13 tests OK
2026-10-03T04:32:17Z | DO | r3 | n1/3 | T5 re-verify | suite exit 0 `Ran 83 tests` OK; ac2 grep exit 1 / 0 matches; gen ×2 byte-identical + XML OK + sha `1e71edfb…`; mirror diff 0 lines; dotnet baseline 7/7 OK; HEAD `1a37b3c`, `?? config/skills/pdca/`, nothing staged (`r3/*`)
2026-10-03T04:32:17Z | DO | r3 | n1/3 | DO complete pending CHECK | T4 N/A rows + updated matrices in `r3/MATRICES.md`; no commit/push

## CHECK-gather: docs surface & limitations (r=3)

Evidence gathered 2026-10-03T04:34:51Z (read-only; no code/asset changes, no commit/push). All paths relative to repo root `/home/alex/sources/opencode-config`.

### 1. Docs surfaces for the deliverable

- `README.md:76` — universal `pdca` diagram rebuild path: canonical `workflow.json` + same `gen_pdca.py` → `pdca-hand.{svg,html}` / `pdca-hand-dark.{svg,html}` (`python3 gen_pdca.py`), viewer `pdca.html` (`archify deliver workflow … --quality showcase`) only if archify available.
- `README.md:77` — install-copy row for `config/skills/pdca/**` → `~/.config/opencode/skills/pdca/**` (`cp -a`).
- `config/skills/pdca/tests/scenarios.md:12` — canonical workflow path `config/skills/pdca/assets/diagram/workflow.json` (diagram source).
- `config/skills/pdca/tests/scenarios.md:41` — diagram labels ref to the same `config/skills/pdca/assets/diagram/workflow.json`.
- `config/skills/pdca/SKILL.md` — **0** diagram-surface refs (`assets/diagram`=0, `gen_pdca`=0, `archify`=0, `pdca.html`=0). The only `workflow` hits are generic prose (`:622` "CI workflows", `:841` "the CI workflow", `:972` "**Workflow (code-audit stream …)**") — not diagram refs. SKILL.md mention was optional and intentionally omitted.

### 2. Accepted limitation (durable reference)

No browser/headless HTML validator is available on this host: `tidy`, `html5validator`, `xmllint` are all **MISSING**; only `node` (`/usr/bin/node`) and `python3` (`/usr/bin/python3`) are present. Viewer validation is therefore **structural** — SVG / `<script>`s / payload preserved, asserted by `config/skills/pdca/tests/test_diagram_artifacts.py:111–140` — plus stdlib `xml.etree` well-formedness. Full browser/HTML+CSS validation is explicitly marked **accepted N/A** (also recorded the same in `r3/MATRICES.md`, browser-smoke row).

### 3. AC1 mapping to current evidence

- `config/skills/pdca/assets/diagram/` inventory: `gen_pdca.py`, `neutralize_viewer.py`, `pdca-hand.svg`, `pdca-hand.html`, `pdca-hand-dark.svg`, `pdca-hand-dark.html`, `pdca.html`, `workflow.json` (+ `__pycache__`).
- Exactly one canonical `workflow.json`: `find config/skills/pdca -name workflow.json` → 1 hit = `config/skills/pdca/assets/diagram/workflow.json`.
- Canonical refs: `config/skills/pdca/tests/test_routing_consistency.py:22` (`WORKFLOW = PDCA_DIR / "assets/diagram/workflow.json"`), `config/skills/pdca/tests/scenarios.md:12,41`.
- **0 stale refs in shipped tree**: `grep -RIna 'assets/workflow.json' config/skills/pdca --exclude-dir=__pycache__` → exit 1, 0 hits. 1 historical hit `docs/specs/status/universal-pdca-skill-1.md:170` (outside shipped tree).

### 4. AC4 mapping

- Viewer title `config/skills/pdca/assets/diagram/pdca.html:7` = `pdca: оркестратор и фазы цикла Diagram`.
- Hand titles: `config/skills/pdca/assets/diagram/pdca-hand.html:1` = `pdca — ручная раскладка`; `config/skills/pdca/assets/diagram/pdca-hand-dark.html:1` = `pdca — ручная раскладка (тёмная тема)`.
- Generic labels: `config/skills/pdca/assets/diagram/gen_pdca.py:38` = `scout + доменные линзы`; `config/skills/pdca/assets/diagram/gen_pdca.py:51` = `README · документация`.
- Tests: `config/skills/pdca/tests/test_diagram_artifacts.py:111–118` (`test_viewer_title_is_generic` asserts `startswith("pdca")` + no runtime bad title, `:111–114`; `test_viewer_embedded_svg_is_wellformed_xml`, `:116–118`).

### 5. Existing evidence pointers — re-confirmed accurate

- `/tmp/pdca-universal-diagram/r3/suite.log` (+ `suite.exit` = **0**) — `Ran 83 tests`, `OK`.
- `/tmp/pdca-universal-diagram/r3/ac2.exit` = **1** (`ac2.log` 0 lines / 0 matches).
- `/tmp/pdca-universal-diagram/r3/dotnet-baseline.exit` = **0** — 7/7 `OK`.
- Mirror identical: `diff -r config/skills/pdca ~/.config/opencode/skills/pdca` exit **0** (live re-check; `r3/mirror.exit` = 0).
- `pdca.html` sha256 = `1e71edfb608ab575d2bf93e19c827d206fbde69cd5ed8ffcc3da4b0b00d011ca` (live re-check; matches `r3/pdca.sha.final` / `pdca.sha.before` / `pdca.sha.after`).
- HEAD `1a37b3c6d0ca8766d4465ea66a6afc70dc064a9a`; `?? config/skills/pdca/`; nothing staged; no commit/push.

2026-10-03T04:34:51Z | CHECK | r3 | n1/3 | CHECK-gather (docs surface & limitations) appended | read-only evidence with file:line refs; existing pointers re-confirmed (suite 0 / Ran 83, ac2 exit 1, dotnet-baseline 0, mirror diff 0, pdca.html sha 1e71edfb…); no other files changed, nothing staged
2026-10-03T04:38:41Z | CHECK | r3 | n1/3 | CHECK-gather (per-row anchors + mechanical docs-lens) appended | read-only; `r3/matrix-anchors.md` created; `r3/docs-lens.log`/`r3/docs-lens.exit`=0; `r3/stale-ref.exit`=1 (0 hits); no code/asset edits, nothing staged, HEAD `1a37b3c`

## CHECK-gather: per-AC anchors & docs-lens (r=3)

Evidence gathered 2026-10-03T04:38:41Z (read-only; only this status file + `/tmp/pdca-universal-diagram/r3/` written;
no code/asset changes, no commit/push). Full table: `/tmp/pdca-universal-diagram/r3/matrix-anchors.md`.

- **AC1** inventory `config/skills/pdca/assets/diagram/` (8 artifacts, one `workflow.json`); refs
  `tests/test_routing_consistency.py:22`, `tests/scenarios.md:12,41`; stale-ref
  `grep "assets/workflow.json"` → `r3/stale-ref.log`, `r3/stale-ref.exit`=**1** (0 hits).
- **AC2** `tests/test_contract_consistency.py:84–95` (recursive `scan_tree`) + `:276–291`
  (`ForbiddenTokenGuardTest`); `tests/test_diagram_artifacts.py:120–123`; `r3/ac2.log` / `r3/ac2.exit`=**1** (0 matches, no exclusions).
- **AC3** `gen_pdca.py:363–368` (write loop); `r3/gen.log` / `r3/gen.exit`=**0**; `r3/xml.log` (both SVGs parse); `pdca.html` sha `1e71edfb…` unchanged.
- **AC4** `pdca.html:7`; `pdca-hand.html:1`; `pdca-hand-dark.html:1`; `gen_pdca.py:359,360`; `tests/test_diagram_artifacts.py:111–118`; suite `r3/suite.log` / `r3/suite.exit`=**0** (`Ran 83 tests`, `OK`).
- **AC5** `README.md:77` (install/mirror row; rebuild path at `:76`); `r3/mirror.log` / `r3/mirror.exit`=**0** (diff empty).
- **AC6** `r3/dotnet-baseline.log` / `r3/dotnet-baseline.exit`=**0** (7/7 `OK` vs `r2/dotnet.baseline.sha256`).
- **AC7** `r3/git.log` / `r3/git.exit`=**0** (HEAD `1a37b3c`, `?? config/skills/pdca/`, 0 staged).
- **Variants** `tests/test_neutralize_viewer.py:61,73,89,108,114,142,150` + `tests/test_diagram_artifacts.py:111–140`
  (all `OK` in `r3/suite.log`; guard failure `r3/guard.failure.log` exit 3, no output); provider/value-vs-reference
  and browser-smoke rows **N/A** (`r3/MATRICES.md`).
- **Docs-lens** (`r3/docs-lens.sh`, run from repo root): (a) `workflow.json` exists; (b) no stale
  `assets/workflow.json`; (c) `tests/scenarios.md:12,41` carry `assets/diagram/workflow.json`;
  (d) `README.md` mentions `config/skills/pdca/assets/diagram/`; (e) `SKILL.md` has no
  `pdca.html`/`gen_pdca`/`archify`. All PASS — `r3/docs-lens.log`, `r3/docs-lens.exit`=**0**.

2026-10-03T09:41:00Z | DO | r3 | n1/3 | iteration n=1 (test-only addition closing variant row empty/default; no behavior change) | `config/skills/pdca/tests/test_neutralize_viewer.py:120` `test_empty_input_returns_empty` (`neutralize(b"") == b""`); `r3/suite2.log`/`r3/suite2.exit`=**0** (`Ran 84 tests`, `OK`); `r3/ac2b.log`/`r3/ac2b.exit`=**1** (0 matches, whole tree, no exclusions); `r3/mirror2.log`/`r3/mirror2.exit`=**0** (identical); matrices `r3/matrix-anchors.md`

## r3 n1 test-only closure (last CHECK gap)

- Added `test_empty_input_returns_empty` in `FontAbsentTest` at
  `config/skills/pdca/tests/test_neutralize_viewer.py:120` (asserts `neutralize(b"") == b""`);
  test-only, no behavior/product change, no forbidden-token literal.
- Evidence (all under `/tmp/pdca-universal-diagram/r3/`):
  - `suite2.log` + `suite2.exit` = **0** — `Ran 84 tests`, `OK` (new test line 46 `... ok`).
  - `ac2b.log` + `ac2b.exit` = **1** — 0 lines / 0 forbidden-token matches, whole tree, **no exclusions**.
  - `mirror2.log` + `mirror2.exit` = **0** — rsync exit 0; `git diff --no-index --stat` 0 lines, identical.
  - `matrix-anchors.md` — both frozen matrices inline (PRIORITY + VARIANT, each row with closure
    type and proving `file:line`) plus the per-AC AC1–AC7 table.
- Anchor shift: the 3-line insertion moved `test_unsupported_placement_…` `:142→:145` and
  `test_existing_output_file_left_unchanged_on_failure` `:150→:153`; earlier anchors
  (`:61`, `:73`, `:89`, `:108`, `:114`) unchanged.
- HEAD `1a37b3c…` unchanged; `?? config/skills/pdca/`; 0 staged; no commit/push.

## ACT (r=3) — cycle closed

- **ACT gate:** all r=3 CHECK streams pass — code (+ tests) and docs streams green; **perf waived** (static artifacts, no runtime hot path); **security not triggered** (no new network/secret surface). Verdict from the **anchored matrices-inline** beat (`/tmp/pdca-universal-diagram/r3/matrix-anchors.md`, both frozen matrices inline with per-row proving `file:line`): **PASS**.
- **Final verification summary** (all logs + exit under `/tmp/pdca-universal-diagram/r3/`):
  - `python3 -m unittest discover -s config/skills/pdca/tests -p 'test_*.py' -v` → exit **0**, `Ran 84 tests`, **OK** (0 failures/errors) — `suite2.log` / `suite2.exit`.
  - Whole-tree forbidden-token grep (`config/skills/pdca`, 9 tokens) → exit **1**, **0** matches, **no exclusions** — `ac2b.log` / `ac2b.exit`.
  - Mirror `rsync -a --delete` → exit 0; `diff` identical (0 lines) — `mirror2.log` / `mirror2.exit` = **0**.
  - `pdca-dotnet` diagram baseline `sha256sum -c` → exit **0**, **7/7 OK** (byte-unchanged) — `dotnet-baseline.log` / `dotnet-baseline.exit`.
  - `pdca.html` sha256 `1e71edfb…d011ca` **unchanged** (not rebaselined) — `pdca.sha.final`.
  - HEAD `1a37b3c`; `git status --short` = `?? config/skills/pdca/` only; **0 staged**.
- **Registry check:** no `AGENTS.md` / `skills-keep.txt` / test-discovery registry update needed — the stdlib auto-glob discovers `config/skills/pdca/tests/test_neutralize_viewer.py`; `README.md:76–77` already documents the universal `pdca` diagram rebuild + install-mirror paths.
- **Docs:** `README.md:76–77`; `config/skills/pdca/tests/scenarios.md:12,41`; accepted limitation browser/HTML validation N/A recorded at this file `:227` (also `r3/MATRICES.md`).
- **Transferable lessons (2)** recorded to the memory MCP by the orchestrator.
- **No commit/push performed. Status file finalized and kept.**
- **ACT complete — EXIT.**

2026-10-03T09:44:00Z | ACT | r3 | n1/3 | cycle closed | all r3 CHECK streams pass (code/tests/docs; perf waived; security N/A); suite exit 0 Ran 84 OK; ac2 exit 1/0 matches; mirror diff 0; dotnet baseline 7/7 OK; pdca.html sha 1e71edfb…d011ca; HEAD 1a37b3c, 0 staged; no commit/push; status finalized and kept
