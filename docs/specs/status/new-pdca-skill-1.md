# Цикл 1 задачи «new-pdca-skill» — универсальный доменно-независимый скилл pdca

- **Тип:** создание новой реализации (не миграция pdca-coder/pdca-dotnet)
- **Спека:** docs/superpowers/specs/2026-10-03-universal-pdca-design.md:38-156
- **Режим:** normal (требуется явный go после PLAN)

## Durable state
- Current cycle N: 1
- Plan revision r: 2
- Attempt n: 2 (n max 3)
- Defect history:
  - `runner-permission-isolation` — observed at r=2, n=1 (CHECK#1); fixes applied: 1 (fail-closed top-level `"*": deny` + only required allows, host↔asset parity); evidence: /tmp/pdca-new-pdca-skill/chk2-new.log (`test_runner_is_structural_dispatcher`); outcome: fixed, suite green.
  - `diagram-missing-act-plan` — observed at r=2, n=1 (CHECK#1); fixes applied: 1 (new `act_plan` ACT→PLAN next-cycle edge, both themes); evidence: /tmp/pdca-new-pdca-skill/chk2-new.log (`test_act_plan_*`); outcome: fixed, suite green.

## Goal (по сути)
Получить самостоятельный универсальный PDCA-контракт, явно вызываемый через `skill pdca`, с изолированными ролями, проверяемыми переходами и восстановлением состояния — без обязанностей конкретного домена и без изменения существующего поведения.

## Current state
- Phase: ACT (closed)
- Active units: none; all D0–D6 done.
- CHECK #2 verdict: PASS (K1–K11 pass; 58/58 matrix rows closed; both defect keys fixed; new suite 75/75; regressions 65/201/46 == D0; protected hashes 82/82 MATCH).

## Done / Verified
CHECK #2 (revision r=2, attempt n=2): **PASS**.
- New suite: `config/skills/pdca/tests` → **exit 0, `Ran 75 tests`, OK**, 0 failed, 0 skipped (log /tmp/pdca-new-pdca-skill/chk2-new.log).
- Regressions unchanged vs D0: pdca-coder **65 OK**, pdca-dotnet **201 OK**, pdca-collection **46 OK** (logs /tmp/pdca-new-pdca-skill/chk2b-{coder,dotnet,collection}.log).
- Protected files: `sha256sum -c /tmp/pdca-new-pdca-skill/protected-sha256.txt` → **82/82 `: OK`**, 0 FAILED (log chk2b-protected-check.txt).
- Variant matrix: **58/58 rows closed** (/tmp/pdca-new-pdca-skill/matrix-closure.md).

| ID | Proving artifact / command | Observed result |
|---|---|---|
| K1 | `config/skills/pdca/SKILL.md` frontmatter (`name: pdca`, EN domain-neutral description, explicit-invoke only); `SkillFrontmatterTest`, `ContractConsistencyTest.test_name_is_pdca`/`test_description_is_nonempty_and_domain_neutral`, `UniversalityTest.test_skill_declares_neutrality` | pass |
| K2 | SKILL.md `## Phase contracts (generic)` + `### Transition gates`; `ContractConsistencyTest.test_phase_contracts_are_present`/`test_required_sections_present`/`test_gate_check_to_act_requires_all_criteria_met` | pass |
| K3 | SKILL.md `## State machine`/`### Phase todo tracker`/`## Normal and autonomous modes`/`## Durable status`/`## Recovery after compaction and drift`/`### Cycle failure modes`; `test_three_counters_described`/`test_gates_encode_no_fourth_rule`/`test_status_first_todo_second_and_path`/`test_durable_status_carries_counters_and_history` | pass |
| K4 | SKILL.md phase todo / `### DO → PLAN candidate` / gates; `test_required_sections_present`/`test_phase_contracts_are_present` | pass |
| K5 | `ContractConsistencyTest.test_gate_check_to_act_requires_all_criteria_met`/`test_stop_is_a_separate_terminal_outcome_not_act_success` | pass |
| K6 | `RoleParityTest`(5) + `ProfileBindingTest`(3) + `PermissionRoutingTest`(3) + `ReadOnlyRoleBoundaryTest`(5) + `SkillFrontmatterTest`(1); host ↔ assets byte-parity, only `# tier:`, no model id | pass |
| K7 | `PermissionRoutingTest.test_runner_is_structural_dispatcher`/`test_planner_and_check_are_default_deny`/`test_escalate_only_allows_scout`, `ReadOnlyRoleBoundaryTest.test_runner_task_excludes_general_and_explore`; SKILL.md `## Normal and autonomous modes`/`## Escalation` | pass |
| K8 | `ContractConsistencyTest.test_durable_status_carries_counters_and_history`/`test_status_first_todo_second_and_path`; SKILL.md `## Durable status`/`## Recovery after compaction and drift`/`### Cycle status file` | pass |
| K9 | `UniversalityTest`(7) + `ForbiddenTokenGuardTest`(4); SKILL.md `## Generic operating constraints` | pass |
| K10 | `CostAccountingTest`(10) + `CostReadNoWriteTest`(2) + `MalformedProfileInputTest`(4) + `DiagramArtifactsTest`(6) + `DiagramReproducibilityTest`(2); diagram rerun IDENTICAL (log chk2b-diagram-run{1,2}.log) | pass |
| K11 | checksum/regression/footprint runs above | pass |

Оба defect key подтверждены исправленными: `runner-permission-isolation` (fail-closed runner, `test_runner_is_structural_dispatcher`) и `diagram-missing-act-plan` (ACT→PLAN next-cycle edge в обеих темах, `test_act_plan_*`) — evidence chk2-new.log.

## Acceptance criteria (K1–K11)
| ID | Критерий и проверка | Негативный случай |
| K1 | config/skills/pdca/SKILL.md: name: pdca, EN нейтральное описание, только явный вызов | доменные списки/фразовые триггеры/изменение старых |
| K2 | PLAN результат/ограничения/допущения/критерии-с-проверкой/зависимости/средства/доступ/риски/условия остановки | критерий без проверки проходит gate 1 |
| K3 | сохранены 4 фазы, normal/autonomous, N/r/n, max три CHECK ревизии, loop-back, todo, recovery | 4-й CHECK, фиктивная ревизия, N растёт до успешного ACT |
| K4 | жизненный цикл units + отчёт DO соответствуют требованиям | предусловие отменяет исходную единицу; DO выдаёт PASS/STOP; преждевременный done |
| K5 | независимый CHECK даёт met/unmet/unverified; ACT только после доказанного принятия; STOP отдельный | нет проверки, но PASS; STOP как успешный ACT |
| K6 | пять host-ролей и пять assets согласованы; разрешения/tier/профильные привязки статически проверены | лишние полномочия, неверное имя, model id вне profiles |
| K7 | cheap-only routing, делегирование runner, fallback, маршрутизация escalation | medium/strong ведёт цикл; runner грузит другой skill; переизбрание решения |
| K8 | append-only статус, история попыток, recovery, честное отсутствие persistence | перезапись истории, потеря активной единицы, выдуманная сохранность |
| K9 | runtime/prompts/ресурсы нейтральны; сохранены границы доверия/доступа/одобрения | доменные обязанности; autonomous обходит обязательное разрешение |
| K10 | cost-порт сохраняет учёт и read-only; диаграмма воспроизводима в СВЕТЛОЙ и ТЁМНОЙ темах (SVG+HTML) и совпадает с контрактом | запись в DB, неверные tiers, отсутствие STOP/loop-back на схеме |
| K11 | новая suite проходит; существующие baseline не ухудшены; итоговый diff чист по footprint | новый регресс объявлен «известным»; затронуты старые skills/agents или ~/.config |

## Constraints / assumptions ("what the statement did not say")
- Нормативный источник: spec:38-156; нецели spec:28-31.
- Только текущий репозиторий; без live-install/commit/push и внешних изменений.
- Дерево уже грязное; база сравнения — состояние до нашей работы (не только HEAD 1a37b3c); пользовательские изменения сохраняются.
- normal-режим: DO начинается только после явного go.
- Baseline-результаты существующих suite не предоставлены → D0 получает их до реализации.
- Численный coverage-порог не задан, новой ветки нет → не выдумываем процент; полное покрытие обязательств §6 и ноль новых регрессий.
- Имена исходных diagram-файлов не диктуются → минимальный собственный набор generator/SVG/HTML.
- Контрактный JSON не обязателен (spec:128-131) → не создаём.
- scout переиспользуется из config/agents/scout.md без правок.
- Live-install host здесь не проверяем; доказываем готовность репозиторного пакета, согласованность имён и маршрутов.

## DO units (sequential, one tree)
| ID | deps | state | owner | expected result / evidence |
| D0 | — | done | coder | снимок защищённых файлов + baseline трёх suites + границы footprint; журнал команд/результатов |
| D1 | D0 | done | coder | универсальный runtime SKILL.md + изолированные роли (host + assets); evidence K1–K9 |
| D2 | D1 | done | coder | read-only cost-порт + диаграмма в светлой и тёмной темах (SVG+HTML), генерируемая портированным gen_pdca.py (archify НЕ используется); evidence K10 |
| D3 | D1,D2 | done | coder | новая suite + статические проверки, закрывающие K1–K11 |
| D4 | D1 | done | coder | аддитивная интеграция profiles/keep/docs без изменения маршрутов; evidence K1,K6,K11 |
| D5 | D3,D4 | done | coder | итоговый evidence-pack, сравнение baseline, проверка footprint, передача в CHECK |
| D6 | D1,D2,D3 | done | coder | CHECK#1 fixes: runner fail-closed permission + diagram ACT→PLAN next-cycle edge + K3/K9 contract tests | suite green |
`done` — только по gate DO→CHECK; это не CHECK-PASS.

## DO tasks (exact paths)
- D0: снять содержимое/хеши защищённых существующих файлов и начальный diff (включая dirty/untracked); продукт не менять.
- D1: создать config/skills/pdca/SKILL.md; создать config/agents/{pdca-planner,pdca-executor,pdca-check,pdca-escalate,pdca-runner}.md и одноимённые config/skills/pdca/assets/agents/*.md; только # tier:, без model id; planner/check — default-deny без write/shell/task и широкого research; executor — edit/bash allow в пределах workspace; escalate — default-deny, факты через scout и/или узкое read-only; runner — edit/bash deny, без прямого research, task-allowlist pdca-planner/pdca-executor/pdca-check/pdca-escalate/scout, general/explore deny, skill только pdca. Включить gates/counters/phase todo/recovery/loop-backs/маршрутизацию escalation без переизбрания; аддитивное предусловие сохраняет исходную единицу; durable status default .pdca/status/<task>-<N>.md; нет хранилища → limitation.
- D2: создать config/skills/pdca/scripts/pdca_cost.py — порт семантики source config/skills/pdca-coder/scripts/pdca_cost.py:14-36,49-51,100-146,172-205,443-465 (идентичность → pdca). Создать config/skills/pdca/assets/diagram/{gen_pdca.py, pdca-hand.svg, pdca-hand.html, pdca-hand-dark.svg, pdca-hand-dark.html}: порт существующего генератора (без CLI, встроенные THEMES light/dark, пишет 4 файла рядом с собой, HTML встраивает SVG inline), заголовки «pdca — ручная раскладка» / «pdca — ручная раскладка (тёмная тема)», обозначения P·PLAN, D·DO, C·CHECK, A·ACT, ЭСКАЛАЦИЯ, STOP; НЕТ coding/security-полос и доменных подписей; скилл archify НЕ используется; stdlib-only, без timestamps/случайности/абсолютных путей.
- D3: создать config/skills/pdca/tests/test_contract_consistency.py, test_cost_accounting.py, test_diagram_artifacts.py, test_routing_consistency.py, test_permission_boundaries.py, test_universality.py; фикстуры внутри; REPO = Path(__file__).resolve().parents[4]; доменные исходники переписать/не переносить; существующие tests не менять; добавить config/skills/pdca/tests/test_diagram_artifacts.py: наличие всех 5 файлов; точные light/dark <title>; обязательные обозначения и соответствие графу в обеих темах; оба SVG — корректный XML; каждый HTML содержит ровно один inline SVG, побайтово равный соответствующему .svg; guard запрещает coding/stack-маркеры (coding, code, код, dotnet, .NET, C#, Python, Roslyn, build, lint, README, DocFX, pdca-coder, pdca-dotnet, без регистра); отдельный guard запрещает security-полосу (SEC / security / безопасность); проверка воспроизводимости: копировать только генератор в tempdir, запустить текущим Python, сравнить 4 результата побайтово с поставляемыми, повторный запуск даёт те же байты.
- D4: аддитивно изменить config/profiles/deepseek.jsonc, config/profiles/gp.jsonc, config/skills-keep.txt, config/AGENTS.md, README.md (новые profile entries по образцу tier bindings deepseek:25-34, gp:10-19; старые не менять; skills-keep:17-21 +pdca; AGENTS.md:18,24,30,34 добавить явный `skill pdca`/нейтральное назначение без правки старых триггеров; README:75-80 установка/вызов/роли).
- D5: полные проверки, evidence по каждому K, отчёт об остатке/блокерах, финальный diff.
- Deferred: любые исходные отказы старых suite/prompts/permissions → отдельная явно разрешённая задача; численный coverage-tool и живой host-E2E → отдельное требование.

## Test strategy
- Unit: переходы/состояния/учёт на фикстурах. Integration: согласованность skill+prompts+profiles+generated assets. E2E: репозиторные сценарии и воспроизводимость, без установки в host.
- Cases: NormalRequiresGo, AutonomousDelegates, MediumPrimaryRejected, FallbackNoticeAndReason, DoGateEvidence, AdditivePrerequisite, ScopeReplacementMapping, DoHasNoVerdict, CheckMatrixGate, AttemptLimit, RevisionReset, EscalationRouteOnly, RecoveryHistory, NoPersistenceLimitation, StopNotActSuccess, RoleParity, ProfileBindings, NeutralRuntime, AuthorityBoundaries, CostAccountingParity, DiagramReproducibility.
- Variant matrix (каждая строка закрыта test/guard): runner available/absent/depth-insufficient/Task-denied; PLAN полный/неполный; критерий без verification; отсутствие approval; units all-done/blocked/no-evidence/superseded; CHECK met/unmet/unverified/not-run; n=1/2/3/attempt4/replan/rename/rejected; escalation revised-plan/implementation/STOP; recovery с/без статуса; STOP routes; role/profile gates; domain tokens; cost DB absent/read-only; diagram rerun.
- Light: SVG+HTML — точный light-title, граф, well-formed XML, inline SVG; пропуск/неверный title/<img> → fail
- Dark: SVG+HTML — точный dark-title, граф, XML, inline SVG; подмена light-версией/запрещённая подпись → fail
- Генерация без аргументов — 4 файла в tempdir == поставляемым, повторяемость; любой дрейф → fail
- Coverage: исходной suite нет → baseline = отсутствие реализации; line coverage не заявляем; каждый инвариант — позитивный+негативный кейс или guard. Baseline существующих suite сравнивается по именам отказов.

## Docs plan
- Меняем только README.md и config/AGENTS.md в указанном footprint; создаём runtime SKILL и role-assets. Design spec и существующие docs/skills/shared agents — не трогаем. Generated API/XML — неприменимы; SVG/HTML — ресурсы D2.

## Perf measurement
- НЕ нужен (аргумент): изменения — текстовые артефакты (spec:38-43,99-108,135-138), не per-row. Cost-script — вспомогательный read-only отчёт (source:172-205); алгоритм сохраняем, не оптимизируем.

## Reconnaissance
- Design spike НЕ нужен (аргумент): подход/роли/gates заданы нормативно (spec:48-81,99-124). D0 — обязательный baseline, не spike. При расхождении фактической схемы profiles/permissions с evidence — точечный scout до изменения плана.

## Toolchain and lenses
- D0/D5: git status --short, git diff --name-status, git diff --check, сравнение хешей/содержимого защищённых файлов (untracked тоже).
- D0/D5: python3 -m unittest discover -s config/skills/pdca-coder/tests -p 'test_*.py' -v; аналогично config/skills/pdca-dotnet/tests.
- D1/D4: python3 -m unittest discover -s config/skills/pdca/tests -p 'test_routing_consistency.py' -v; JSONC читается с учётом комментариев.
- D2: python3 config/skills/pdca/assets/diagram/gen_pdca.py; python3 config/skills/pdca/scripts/pdca_cost.py --help; проверки диаграммы выше.
- D3: python3 -m unittest discover -s config/skills/pdca/tests -p 'test_diagram_artifacts.py' -v.
- D3/D5: python3 -m unittest discover -s config/skills/pdca/tests -p 'test_*.py' -v.
- Линзы: соответствие спеке, полнота переходов, маршрутизация/полномочия, сохранность исходной базы. Доменные линзы в новый runtime не добавляем.

## Priority matrix
| P1 | gates/counters/units/recovery/STOP, neutral-runtime, permissions/routing, profile bindings, защищённые AGENTS:18,24, cost read-only, approvals/confidentiality | любое нарушение K1–K11 блокирует; CHECK не понижает |
| P2 | необязательная удобочитаемость/диагностика без нарушения критериев | deferred с триггером |
| P3 | косметика вне критериев/footprint | не расширять |

## Risks / known issues
- копирование доменных требований; расхождение host/assets; потеря dirty-изменений; недостаток доказательств независимого CHECK.
- риск переноса старых доменных/security-подписей в диаграмму — закрывается guard'ами и tempdir-проверкой воспроизводимости; генератор stdlib-only, детерминированный.
- Несовместимость формата/нехватка доказательств → точечный scout, не молчаливое ослабление.
- Внешняя граница → escalate; низкая уверенность после разведки → escalate (триггер 5).
- Нет разрешённой записи статуса / конфликт с чужими правками / внешнее действие без approval → остановка действия и маршрутизация.
- 3-й неуспешный CHECK ревизии → escalation, не 4-я попытка.

## Minimal solution / Chesterton's fence
- result: независимый универсальный контракт; constraints: механика/нейтральность/аддитивность/полномочия; optimum: отдельный skill + пять пар prompts + минимальные ресурсы + локальные проверки.
- Альтернативы: (A) отдельный порт — выбран; (B) wrapper над pdca-coder — наследует доменные обязанности; (C) переделка общих skills — большой footprint, запрещено нецелями. Старые skills/agents/triggers обеспечивают действующее поведение; не демонтируем.

## Deferred + trigger
- исправление исходных отказов старых suite/prompts/permissions → отдельная явно разрешённая задача.
- численный coverage-tool и живой host-E2E → отдельное требование/разрешение.

## Next plan
— (flow closed)

Единичный цикл; универсальный скилл pdca поставлен и принят. Дальнейших циклов этой задачи нет. Файл сохраняется (never delete).

## Changed files
| Path | Status | Note |
|---|---|---|
| config/skills/pdca/SKILL.md | NEW | runtime-контракт скилла pdca |
| config/skills/pdca/assets/agents/pdca-planner.md | NEW | asset-роль (байт-в-байт с host) |
| config/skills/pdca/assets/agents/pdca-executor.md | NEW | asset-роль |
| config/skills/pdca/assets/agents/pdca-check.md | NEW | asset-роль |
| config/skills/pdca/assets/agents/pdca-escalate.md | NEW | asset-роль |
| config/skills/pdca/assets/agents/pdca-runner.md | NEW | asset-роль |
| config/skills/pdca/assets/diagram/gen_pdca.py | NEW | stdlib-only детерминированный генератор (light+dark SVG/HTML) |
| config/skills/pdca/assets/diagram/pdca-hand.svg | NEW | светлая тема SVG |
| config/skills/pdca/assets/diagram/pdca-hand.html | NEW | светлая тема HTML (inline SVG) |
| config/skills/pdca/assets/diagram/pdca-hand-dark.svg | NEW | тёмная тема SVG |
| config/skills/pdca/assets/diagram/pdca-hand-dark.html | NEW | тёмная тема HTML (inline SVG) |
| config/skills/pdca/scripts/pdca_cost.py | NEW | read-only cost-порт |
| config/skills/pdca/tests/test_contract_consistency.py | NEW | контрактные переходы/критерии |
| config/skills/pdca/tests/test_cost_accounting.py | NEW | учёт/read-only cost |
| config/skills/pdca/tests/test_diagram_artifacts.py | NEW | light/dark SVG+HTML, запреты, XML |
| config/skills/pdca/tests/test_permission_boundaries.py | NEW | PermissionRouting/ReadOnlyRole/ProfileBinding |
| config/skills/pdca/tests/test_routing_consistency.py | NEW | cheap-only routing, runner |
| config/skills/pdca/tests/test_universality.py | NEW | нейтральность/запреты домена |
| config/agents/pdca-planner.md | NEW | host-роль |
| config/agents/pdca-executor.md | NEW | host-роль |
| config/agents/pdca-check.md | NEW | host-роль |
| config/agents/pdca-escalate.md | NEW | host-роль |
| config/agents/pdca-runner.md | NEW | host-роль |
| config/profiles/deepseek.jsonc | MODIFIED | аддитивные tier-bindings pdca-ролей |
| config/profiles/gp.jsonc | MODIFIED | аддитивные tier-bindings pdca-ролей |
| config/skills-keep.txt | MODIFIED | аддитивно +pdca |
| config/AGENTS.md | MODIFIED | аддитивно явный `skill pdca`/нейтральное назначение |
| README.md | MODIFIED | аддитивно установка/вызов/роли |
| docs/specs/status/new-pdca-skill-1.md | NEW (untracked) | этот status-файл цикла |

Сборка-артефакт `config/skills/pdca/scripts/__pycache__/` исключена из в-set (bytecode, не продукт). Ни один старый skill/agent/`~/.config`-путь не изменён циклом (K11).

## Pointers
- Spec: docs/superpowers/specs/2026-10-03-universal-pdca-design.md:38-156
- Source to port: config/skills/pdca-coder/{SKILL.md,scripts/pdca_cost.py,assets/diagram/,tests/}
- Log dir: /tmp/pdca-new-pdca-skill/ (D0 baseline: pdca-{coder,dotnet,collection}.log, pre-*; CHECK#1/2: chk*/chk2*; D5: d5-*.log; protected-sha256.txt; matrix-closure.md)
- Key test files: config/skills/pdca/tests/test_contract_consistency.py, test_cost_accounting.py, test_diagram_artifacts.py, test_permission_boundaries.py, test_routing_consistency.py, test_universality.py

## Progress log
2026-10-03T05:38:00Z | PLAN | r=1 | n=1/3 | PLAN ready — awaiting go | plan in this file
2026-10-03T05:44:45Z | PLAN | r=2 | n=1/3 | Replanned: пользователь добавил требование диаграммы SVG light+dark по образцу существующих скиллов, без archify (r 1→2, iteration 1/3) | status updated
2026-10-03T05:46:46Z | DO | r=2 | n=1/3 | go received — DO started | D0 baseline
2026-10-03T05:47:17Z | DO | r=2 | n=1/3 | D0 baseline complete: 3/3 suites OK, protected hash snapshot 82 files | /tmp/pdca-new-pdca-skill/
2026-10-03T05:50:25Z | DO | r=2 | n=1/3 | D1 done: config/skills/pdca/SKILL.md + 5 host agents + 5 assets | files: config/skills/pdca/SKILL.md, config/agents/{pdca-planner,pdca-executor,pdca-check,pdca-escalate,pdca-runner}.md, config/skills/pdca/assets/agents/{pdca-planner,pdca-executor,pdca-check,pdca-escalate,pdca-runner}.md
2026-10-03T05:58:34Z | DO | r=2 | n=1/3 | D2 done: pdca_cost.py + diagram light/dark | files: config/skills/pdca/scripts/pdca_cost.py, config/skills/pdca/assets/diagram/{gen_pdca.py,pdca-hand.svg,pdca-hand.html,pdca-hand-dark.svg,pdca-hand-dark.html}
2026-10-03T06:00:31Z | DO | r=2 | n=1/3 | D4 done: additive integration profiles/keep/AGENTS/README | files: config/profiles/deepseek.jsonc, config/profiles/gp.jsonc, config/skills-keep.txt, config/AGENTS.md, README.md
2026-10-03T06:05:53Z | DO | r=2 | n=1/3 | D3 not done: 6 test files written; suite RED (66 tests, 2 failing) — D1 runtime leaks forbidden tokens (roslyn in planner/check; runner names pdca-coder/pdca-dotnet/pdca-collection) | log /tmp/pdca-new-pdca-skill/pdca-new.log
2026-10-03T06:07:03Z | DO | r=2 | n=1/3 | D3 done: fixed D1 token leaks (roslyn removed; runner reworded), suite green | ran 66 tests | log /tmp/pdca-new-pdca-skill/pdca-new-fix.log
2026-10-03T06:08:15Z | DO | r=2 | n=1/3 | D5 done: all suites green, protected hashes MATCH, footprint clean | evidence in this file
2026-10-03T06:09:05Z | CHECK | r=2 | n=1/3 | DO → CHECK: all 6 units done with evidence | verdict pending
2026-10-03T06:18:53Z | CHECK | r=2 | n=2/3 | CHECK #1 fail → DO: defect keys runner-permission-isolation, diagram-missing-act-plan (r=2, n 1→2) | status updated
2026-10-03T06:18:53Z | DO | r=2 | n=2/3 | D6 done: runner fail-closed, diagram +ACT→PLAN, K3/K9 tests added | ran 75 tests | /tmp/pdca-new-pdca-skill/chk2-new.log
2026-10-03T06:25:22Z | ACT | r=2 | n=2/3 | CHECK #2 pass: K1–K11 pass, 58/58 matrix rows closed, 75/75 tests | evidence in this file
2026-10-03T06:25:22Z | ACT | r=2 | n=2/3 | ACT closed; flow closed | status finalized

## Baseline (D0)
Снято до любых правок продукта (только этот status-файл — наш). Время снимка: 2026-10-03T05:46:46Z.

### Suites (все запущены с `timeout 600` + `PYTHONDONTWRITEBYTECODE=1`, exit code — ведущей команды через PIPESTATUS)
| Suite | exit | Ran | Result | passed | failed | skipped | failing tests | log |
|---|---|---|---|---|---|---|---|---|
| config/skills/pdca-coder/tests | 0 | 65 | OK | 65 | 0 | 0 | — | /tmp/pdca-new-pdca-skill/pdca-coder.log |
| config/skills/pdca-dotnet/tests | 0 | 201 | OK | 201 | 0 | 0 | — | /tmp/pdca-new-pdca-skill/pdca-dotnet.log |
| config/skills/pdca-collection/tests | 0 | 46 | OK | 46 | 0 | 0 | — | /tmp/pdca-new-pdca-skill/pdca-collection.log |

Итого: 312 tests, 0 failed, 0 skipped; все три suite — OK, exit 0.

### Protected-files hash baseline
- Список файлов (82): /tmp/pdca-new-pdca-skill/protected-files-list.txt
- sha256 построчно: /tmp/pdca-new-pdca-skill/protected-sha256.txt
- sha256 самого манифеста: 8d271806429ff96136f0377ffc619c49eba3294a786cdad98e7672587fa9beb9 (/tmp/pdca-new-pdca-skill/protected-sha256.txt.sha256)
- Охват: config/skills/pdca-coder/**, config/skills/pdca-dotnet/**, config/skills/pdca-collection/**, config/skills/pdca-dotnet/assets/agents/**, config/agents/*.md (23), config/tools/*.mjs (4), config/opencode.jsonc.

### Pre-existing git state (снято до append в этот status-файл)
- `git status --short`: 7 modified (`README.md`, `config/AGENTS.md`, `config/agents/coder.md`, `config/skills-keep.txt`, `config/skills/pdca-dotnet/SKILL.md`, `config/skills/pdca-dotnet/assets/agents/coder.md`, `docs/specs/status/enforce-pdca-inner-loop-1.md`) + untracked (в т.ч. `config/skills/pdca-coder/`, `docs/reports/`, spec/status для universal-pdca). Полный вывод: /tmp/pdca-new-pdca-skill/pre-git-status-short.txt
- `git diff --stat`: 7 files changed, 168 insertions(+), 6 deletions(-). Файл: /tmp/pdca-new-pdca-skill/pre-git-diff-stat.txt
- `git diff --name-status`: /tmp/pdca-new-pdca-skill/pre-git-diff-name-status.txt

### Границы footprint (D0)
- Продуктовые файлы не создавались/не изменялись; `config/skills/pdca/` НЕ создан.
- Единственная наша запись — этот status-файл (docs/specs/status/new-pdca-skill-1.md; untracked).
- D0 state остаётся `pending` до gate DO→CHECK (baseline не является CHECK-PASS).

## D5 evidence
Собрано 2026-10-03T06:08:15Z. Все прогоны: `PYTHONDONTWRITEBYTECODE=1 timeout 600 python3 -m unittest discover -s <dir> -p 'test_*.py' -v 2>&1 | tee <log>`; exit code — ведущей команды через `${PIPESTATUS[0]}`. Логи: `/tmp/pdca-new-pdca-skill/d5-{new,coder,dotnet,collection}.log`.

### D5 run results (сравнение с D0)
| Suite | exit | Ran | Result | failed | skipped | failing tests | log |
|---|---|---|---|---|---|---|---|
| config/skills/pdca/tests (new) | 0 | 66 | OK | 0 | 0 | — | /tmp/pdca-new-pdca-skill/d5-new.log |
| config/skills/pdca-coder/tests | 0 | 65 | OK | 0 | 0 | — | /tmp/pdca-new-pdca-skill/d5-coder.log |
| config/skills/pdca-dotnet/tests | 0 | 201 | OK | 0 | 0 | — | /tmp/pdca-new-pdca-skill/d5-dotnet.log |
| config/skills/pdca-collection/tests | 0 | 46 | OK | 0 | 0 | — | /tmp/pdca-new-pdca-skill/d5-collection.log |

Baseline совпадает точно: pdca-coder 65 OK, pdca-dotnet 201 OK, pdca-collection 46 OK; новых отказов/пропусков нет. New suite разбивка по классам: ContractConsistencyTest 12, CostAccountingTest 10, UniversalityTest 7, DiagramArtifactsTest 6, RoleParityTest 5, ReadOnlyRoleBoundaryTest 5, ForbiddenTokenGuardTest 4, MalformedProfileInputTest 4, PermissionRoutingTest 3, ProfileBindingTest 3, AdditiveIntegrationTest 2, CostReadNoWriteTest 2, DiagramReproducibilityTest 2, SkillFrontmatterTest 1.

### K1–K11 (providing artifact / command → observed result)
| ID | Proving artifact / command | Observed result |
|---|---|---|
| K1 | `config/skills/pdca/SKILL.md` frontmatter (`name: pdca`, EN domain-neutral description, «Invoke only when the user explicitly names the `pdca` skill»); new suite `SkillFrontmatterTest.test_skill_frontmatter_name_is_pdca`, `ContractConsistencyTest.test_name_is_pdca`/`.test_frontmatter_has_exactly_name_and_description`/`.test_description_is_nonempty_and_domain_neutral`, `UniversalityTest.test_skill_declares_neutrality` | pass (66 OK); старые триггеры/скиллы не менялись (K11 footprint) |
| K2 | SKILL.md `## Phase contracts (generic)` + `### Transition gates`; `ContractConsistencyTest.test_phase_contracts_are_present`/`.test_required_sections_present`/`.test_gate_check_to_act_requires_all_criteria_met` | pass; PLAN-раздел/критерии-с-проверкой присутствуют |
| K3 | SKILL.md `## State machine`, `### Phase todo tracker`, `## Normal and autonomous modes`, `## Durable status`, `## Recovery after compaction and drift`, `### Cycle failure modes`; `ContractConsistencyTest.test_three_counters_described`/`.test_gates_encode_no_fourth_rule`/`.test_status_first_todo_second_and_path`/`.test_durable_status_carries_counters_and_history` | pass; 4 фазы, N/r/n, no-4th, todo, recovery зафиксированы текстом контракта |
| K4 | SKILL.md phase todo / `### DO → PLAN candidate` / gates; `ContractConsistencyTest.test_required_sections_present`/`.test_phase_contracts_are_present` | pass; lifecycle units и запрет преждевременного `done` покрыты контрактными проверками (текст), отдельного state-симулятора нет |
| K5 | `ContractConsistencyTest.test_gate_check_to_act_requires_all_criteria_met`/`.test_stop_is_a_separate_terminal_outcome_not_act_success` | pass; CHECK met/unmet/unverified и STOP≠ACT подтверждены |
| K6 | `RoleParityTest` (5) + `ProfileBindingTest` (3) + `PermissionRoutingTest` (3) + `ReadOnlyRoleBoundaryTest` (5) + `SkillFrontmatterTest` (1); artifacts `config/agents/pdca-{planner,executor,check,escalate,runner}.md` ↔ `config/skills/pdca/assets/agents/*.md` | pass; 5 хостов = 5 assets побайтово, только `# tier:`, без model id, bindings в profiles |
| K7 | `PermissionRoutingTest.test_runner_is_structural_dispatcher`/`.test_planner_and_check_are_default_deny`/`.test_escalate_only_allows_scout`, `ReadOnlyRoleBoundaryTest.test_runner_task_excludes_general_and_explore`; SKILL.md `## Normal and autonomous modes`, `## Escalation` | pass; cheap-only routing, runner-делегирование, fallback, escalation routed-not-re-decided |
| K8 | `ContractConsistencyTest.test_durable_status_carries_counters_and_history`/`.test_status_first_todo_second_and_path`; SKILL.md `## Durable status`, `## Recovery after compaction and drift`, `### Cycle status file` | pass; append-only статус/история/recovery; отсутствие persistence честно объявлено |
| K9 | `UniversalityTest` (7: declares_neutrality, generic_operating_constraints_present, no_domain_example_or_task_type_markers, no_security_auditor_or_domain_specialist, no_security_or_audit_section_header, roles_referenced_are_only_the_universal_set, skill_does_not_frame_code_test_docs_streams); `ForbiddenTokenGuardTest` (4); SKILL.md `## Generic operating constraints` | pass; runtime/prompts/ресурсы нейтральны, границы доверия/доступа сохранены |
| K10 | `CostAccountingTest` (10), `CostReadNoWriteTest` (2), `MalformedProfileInputTest` (4), `DiagramArtifactsTest` (6), `DiagramReproducibilityTest` (2); explicit diagram rerun (ниже) | pass; cost read-only/учёт сохранён, диаграмма light+dark SVG+HTML воспроизводима |
| K11 | D5 run table выше; protected `sha256sum -c` (ниже); `git status --short` + `git diff --name-status` (footprint ниже) | pass; new suite 66 OK, baseline не ухудшен, protected MATCH, footprint чистый |

### Protected-file integrity
- Команда: `sha256sum -c /tmp/pdca-new-pdca-skill/protected-sha256.txt` (cwd = repo root); полный вывод — `/tmp/pdca-new-pdca-skill/d5-protected-check.txt`.
- Результат: `CHECK_EXIT=0`; 82 строки `: OK`, 0 строк `: FAILED`. sha256 манифеста не изменился (`8d271806429ff96136f0377ffc619c49eba3294a786cdad98e7672587fa9beb9`). **Verdict: MATCH, изменённых путей нет.**

### Footprint (`git status --short` / `git diff --name-status`)
- В-set за этот цикл: новый `config/skills/pdca/**` (SKILL.md, 5 assets/agents, 5 diagram-файлов, scripts/pdca_cost.py, 6 tests), 5 новых `config/agents/pdca-{planner,executor,check,escalate,runner}.md`, `docs/specs/status/new-pdca-skill-1.md`, аддитивные правки `config/profiles/deepseek.jsonc`, `config/profiles/gp.jsonc`, `config/skills-keep.txt`, `config/AGENTS.md`, `README.md`.
- Вне-set новых файлов цикл не вносит. Все «лишние» строки `git status` уже были в D0 (`/tmp/pdca-new-pdca-skill/pre-git-status-short.txt`) и сохраняются: M `config/agents/coder.md`, M `config/skills/pdca-dotnet/SKILL.md`, M `config/skills/pdca-dotnet/assets/agents/coder.md`, M `docs/specs/status/enforce-pdca-inner-loop-1.md`; ?? `config/skills/pdca-coder/`, `config/skills/pdca-dotnet/scripts/validate_inner_loop.py`, `config/skills/pdca-dotnet/tests/test_inner_loop_gate.py`, `docs/reports/`, `docs/specs/status/universal-pdca-*`, `docs/superpowers/specs/2026-10-03-universal-pdca-design.md`.
- **Verdict: чисто** — ни одного нового out-of-set пути, атрибутируемого этому циклу; ранее существовавшее dirty-состояние не тронуто.

### Diagram reproducibility
- Команда: копия только `gen_pdca.py` в два tempdir (`/tmp/pdca-new-pdca-skill/diagram-repro/run{1,2}`), запуск `python3 gen_pdca.py` в каждом.
- Результат: все 4 файла **IDENTICAL** run1↔committed и run1↔run2 (`pdca-hand.svg`, `pdca-hand.html`, `pdca-hand-dark.svg`, `pdca-hand-dark.html`); генератор печатает только строки `wrote ...`, без таймстампов/абсолютных путей.

### Blockers / residual
- Блокеров нет: 4/4 suite зелёные, protected MATCH, footprint чистый, диаграмма воспроизводима.
- Остаток вне D5: живой host-E2E и численный coverage-tool (deferred, как в плане); CHECK не выполнялся — это следующий шаг.
