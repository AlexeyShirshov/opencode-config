# pdca-collection: план реализации барьера собственных PLAN

- **Дата:** 2026-10-06
- **Спецификация:** [../specs/2026-10-06-pdca-collection-plan-barrier-design.md](../specs/2026-10-06-pdca-collection-plan-barrier-design.md) (одобрена письменно в чате 2026-10-06)
- **Статус:** Реализовано (P0–P6; см. §Журнал исполнения). Коммит/push/install не делались.
- **Нормативность:** после реализации нормативными остаются активные `config/skills/**` и `config/agents/**`; приоритет — текстовые исполняемые контракты, а не наличие runtime-API в существующем коде.

> Одобрение спеки **не** является разрешением на реализацию. Этот документ — план; ни одна
> задача ниже не выполнена. Коммиты/push/install/deploy не авторизованы.

## 0. Глобальные ограничения (действуют для P0–P6)

- ALL-barrier: собственный настоящий PLAN **каждой** задачи завершается и персистится **до**
  любых DAG/групп/прочей коллекционной организации; исходный жизненный цикл задачи
  сохраняется в том же цикле при handoff; возобновление идёт с DO, принудительного второго
  PLAN нет.
- Управление передаётся на существующей границе PLAN→DO коллекционному оркестратору — это не
  альтернативная имитация PLAN.
- Standalone manual (`go`) и standalone autonomous (немедленный DO) не меняются; интерактивный
  коллекционный режим не вводится; `ready ≠ go/done`; полный жизненный цикл охватывает два
  вызова, PLAN из жизненного цикла не удаляется.
- Точные сохранённые variant/N/r/n и канонический статус — авторитет; generic-схема не вводит
  новых обязательных входов standalone-PLAN.
- До старта любого лейна расписание может быть пересмотрено при изменении входов task-plan;
  после старта — никаких авто-recluster/rerun/reset/revert; совместимые локальные ревизии —
  только с evidence `planner` + персистентная привязка; несовместимые — остановка под явное
  решение.
- Роли/тиры/права/merge+C-recovery неизменны; новых агентов/model id/CLI/runtime-координатора
  нет.
- Worktree уже грязный; правки узкие аддитивные, без reset/checkout/перезаписи целых файлов,
  без широкого `--fix`, без стейджинга посторонних файлов. Сгенерированные коллекционные
  артефакты должны отражать **текущий** генератор (включая посторонние уже сделанные правки),
  их не откатывать. Перед исполнением — прочитать актуальные инструкции.
- Все записи выполняет `coder`; оркестратор не получает права `edit`/`bash` и не меняет
  маршрутизацию ролей.

## Контракт реализации (чтобы не решать архитектуру заново)

- **Оркестратор** сохраняет существующий вход standalone-autonomous и вход группы. Добавляется
  вход **COLLECTION TASK PLAN**: absolute `collection_status_path` + стабильный `task_id` +
  исходный бриф; выбранный variant/refs берутся из персистентной записи задачи. Он запускает
  variant PLAN и возвращает `plan_handoff` только с task/status/variant/PLAN revision refs и
  только после durable checkpoint. Никаких DO-веток и аллокации worktree на этом входе.
- **Вход группы** возобновляет каждую ready-задачу из её персистентного собственного PLAN, а не
  запускает новый PLAN. Группа получает **путь**, а не скопированную очередь. Внутри —
  продолжение через границу с точно сохранённой идентичностью, проверкой применимости, валидной
  привязкой ревизии расписания и применимым gate1. Неверное/отсутствующее состояние → возврат
  на восстановление/решение, не молчаливый новый цикл.
- **Запись задачи коллекции** добавляет: `plan_state` `pending|running|ready`, `cycle_id`
  (включая N), `selected_variant`, канонический статус-путь, `plan_revision` r, baseline ref,
  refs footprint/requirements/prerequisites. Существующие статусы
  `pending/running/done/incomplete` остаются отличными и неизменными. Коллекционное расписание
  привязывает вектор ревизий PLAN.
- **Handoff-метаданные** — COLLECTION-only, выводятся в genuine per-task PLAN из общего
  исходного списка задач (без предвычисленного порядка). Плановый footprint
  записи/неопределённость/связи/prerequisites/допущения о выходах + refs. Все обязательные
  выходы варианта сохраняются, включая версионируемый evidence-контракт/rv `.NET`.
- **Ready checkpoint** остаётся на границе PLAN→DO в ожидании коллекционного родителя; ложного
  «awaiting human confirmation» нет, если он неприменим. n/r/N сохраняются. Персист статуса —
  до ready/возврата; обновление канонического владения/ссылки — до DO при передаче в worktree.
  Крэш незавершённой передачи → разрешение авторитета, без DO и без второго PLAN по умолчанию.

## P0. Preflight и baseline (только после одобрения плана)

- **Файлы/чтение:** текущая спека; `git diff` по TARGETS; исходные контракты и тесты.
- **Действия:** зафиксировать `git status` и существующие релевантные диффы, старые
  падения/role drift, а не предполагать чистоту. Ресеты запрещены. Записать baseline для всех
  4 unittest-наборов ниже и `bun config/tools/sync-roles.mjs --check` (если Bun недоступен —
  зафиксировать инфраструктурный блокер, не устанавливать). Учесть, что существующий
  `test_verification_recovery.py` содержит render harness и точные guards node/edge/subblock
  (14 нижних рёбер/10 узлов) — не ослаблять постороннее покрытие. Baseline-прогоны до
  добавления RED-тестов; для этой doc-only задачи тесты сейчас не запускаются.
- **DONE:** baseline отчёта, пользовательские правки не отброшены.

## P1. Красные barrier-контрактные тесты

- **Файлы:** создать `config/skills/pdca-collection/tests/test_plan_barrier.py`; узко
  расширить при необходимости
  `config/skills/pdca/tests/test_orchestrator_variant_routing.py`,
  `config/skills/pdca-dotnet/tests/test_routing_consistency.py`,
  `config/skills/pdca-dotnet/tests/test_contract_consistency.py`,
  `config/skills/pdca-collection/tests/test_verification_recovery.py`.
- **Действия:** семантические секции/маркеры и нормализованные scoped-asserts, без глобального
  поиска ключевых слов и хрупких привязок к номерам строк. Кейсы: собственный variant PLAN всех
  задач до DAG; поля завершённого ready-checkpoint; resume с неизменными N/r/n/variant;
  сохранённые standalone `go` + немедленный auto; отсутствие раннего DO/partial-ready;
  несовпадение ревизии расписания не освобождает до обновления привязки `planner`; канонический
  авторитет до DO; несовместимые поздние footprint → стоп/без recluster. Это текстовые
  контрактные регрессии, а не runtime-доказательство: фейковый «model», зеркалящий доки, не
  создаётся. Новые тесты сначала падают из-за отсутствия контракта, а не из-за случайного
  синтаксиса.
- **RED-команда:** `python3 -m unittest discover -s config/skills/pdca-collection/tests -p
  'test_plan_barrier.py' -v`.
- **DONE:** RED зафиксирован (exit≠0), assertions действительно падают на старом контракте.

## P2. Граница collection/orchestrator + персистентность

- **Файлы:** `config/agents/pdca-orchestrator.md` (description/inputs/lane behavior);
  `config/skills/pdca-collection/SKILL.md` (начальные роли, P, лейн, статус, отношение к
  базовым вариантам и возобновлению).
- **Действия:** P из предварительного scout-footprint→DAG меняется на собственный реальный PLAN
  каждой задачи → all ready → коллекционные planner-решения DAG/групп; до barrier только
  bootstrap-факты/статус. P завершается персистентным вектором ревизий расписания; до этого
  аллокации лейнов нет. Footprint/зависимости решаются вместе с per-task PLAN; коллекционный
  `planner` валидирует противоречия/неопределённость, затем группирует по текущим правилам
  непересечения/топологии. Нет осмысленного плана → gap, без ready-placeholder. Определить
  checkpoint/result и continuing group input по контракту выше; существующая одна группа без
  лишних worktree/бранчей сохраняется. Канонические пути статуса вариантов сохраняются
  (`pdca` → `.pdca/status`, `pdca-coder`/`pdca-dotnet` → `docs/specs/status`). `.NET`
  evidence-readiness остаётся полной. Добавить проверки восстановления/передачи
  авторитета/невалидных путей с точными счётчиками и без авто-recluster. Права: оркестратор без
  `edit`/commands; маршрутизация ролей не меняется. Существующая формулировка полного жизненного
  цикла остаётся истинной через планирование+лейн и не выдаёт лейн за второй полный цикл.
- **Check:** `python3 -m unittest discover -s config/skills/pdca-collection/tests -p
  'test_plan_barrier.py' -v` — зелёный; `-p 'test_*.py'` для коллекции — без регрессий.
- **DONE:** P1-кейсы зелёные, изменения прав/режимов нет.

## P3. Та же граница во ВСЕХ вариантах

- **Файлы:** `config/skills/pdca/SKILL.md`, `config/skills/pdca-coder/SKILL.md`,
  `config/skills/pdca-dotnet/SKILL.md`.
- **Действия:** уточнить collection-only caller handoff всюду, где немедленный DO / запрет паузы
  мог бы противоречить ему: transition gate1, normal/autonomous режимы,
  завершение/сохранение/подтверждение PLAN, autonomous red flags, recovery/status, повторяющиеся
  финальные transition-notes (coder/dotnet). Это handoff вызывающего, а не standalone-autonomous
  ожидание; правило «нет вопросов» для standalone сохраняется. Normal требует явного `go`;
  all-ready не фабрикует согласие; оркестратор не ведёт интерактивных циклов. Не освобождать
  iteration/no-fourth/scope/security и не обходить per-variant completeness. Диаграммы базовых
  вариантов не трогать, если не обнаружено фактическое противоречие (тогда — стоп и сообщить,
  если scope выходит за одобренную спеку).
- **Check:** `python3 -m unittest discover -s config/skills/pdca/tests -p 'test_*.py' -v`;
  `... pdca-coder ...`; `... pdca-dotnet ...`.
- **DONE:** контрактные/маршрутные гварды всех вариантов зелёные; evidence-контракт/rv цел.

## P4. Диаграмма коллекции + render-регрессии

- **Файлы:** `config/skills/pdca-collection/assets/diagram/gen_collection.py`; сгенерированные
  `collection-hand.svg/html`, `collection-hand-dark.svg/html`;
  `config/skills/pdca-collection/tests/test_verification_recovery.py` + `test_plan_barrier.py`.
- **Действия:** P остаётся композитной фазой планирования без добавления посторонних
  merge/recovery-узлов: substeps P явно «task own PLAN → all-plan barrier → collection
  scheduling/DAG/groups/status». Осмысленные семантические data-step маркеры: `task-plan`,
  `all-plans-barrier`, `collection-scheduling`; порядок виден в rendered-выходах. Guard P→DO
  выражает «all plans ready AND persisted schedule valid», а не только старое «groups». Метка
  лейна начинается с «continue from saved PLAN → DO→CHECK→ACT», а не свежий полный PLAN.
  Топология merge/C/recovery неизменна; нового авто-recluster-ребра нет. Обновлять **только**
  ожидания для изменённых planning/lane-семантики/меток/guard; не выбрасывать
  node/edge/C/fallback/dispatch-проверки ради зелени. Render-helper уже копирует генератор в
  temp. Генератор — только stdlib.
- **Build:** `python3 config/skills/pdca-collection/assets/diagram/gen_collection.py`.
- **DONE:** light/dark SVG/HTML показывают реальную упорядоченную barrier-семантику; сохранённые
  C/merge-тесты зелёные; все диффы генерации проверены на нежелательные регрессии.

## P5. Согласованность документации

- **Файлы:** `docs/pdca-guide.md` (коллекционный §11: P, лейн, статус/resume, описание полного
  цикла); `docs/articles/pdca-collection.md` (§2/3, ссылки P/D/лейн/статус/failures); `README.md`
  — коллекционный синопсис и актуальные ссылки/карта источников только если вводят в заблуждение.
- **Действия:** объяснить аналогию user-go ↔ коллекционный родитель, различие прав и фазовой
  готовности; существующее поведение cap/group/one-group/merge не меняется. Ссылки карты
  источников обновить либо заменить нестабильные диапазоны строк ссылками на заголовки, если
  конвенция позволяет; без переписывания посторонних статей. Прочие pdca-статьи не трогать, если
  они явно не противоречат новому коллекционному исключению (при расширении scope — сообщить).
  Sync — **не эта** задача: read-only `bun config/tools/sync-roles.mjs --check` сверяет canonical
  `config/agents` с `config/skills/pdca-dotnet/assets/agents`; при новом drift из-за изменённой
  роли обновить **только** соответствующий role-зеркальный файл после разбора baseline-диффа.
  Никакого массового `--fix`, никакого deploy/install. Preexisting drift фиксируется отдельно.
- **DONE:** доки не противоречат скиллам; model id нигде не названы.

## P6. Финальная валидация и handoff

- **Действия:** прогнать генератор, ровно 4 unittest-команды ниже, `sync --check`. Сравнить с
  baseline; любое новое падение разобрать в рамках одобренного scope, существующие падения не
  прятать. `git diff --check` и точечный разбор диффов (новые untracked — отдельно); без
  коммита. Протрассировать кейсы через `config/skills/pdca-collection/tests/scenarios.md`,
  дополнив planning-кейсами: mixed variants, один missing PLAN, restart partial-ready, transfer
  interruption, valid predecessor outputs, invalid predecessor assumptions, before/after
  footprint changes, unchanged standalone modes. Ручной scenario-walkthrough — явный тип
  evidence; если реального multi-agent harness нет — **не** добавлять новый
  runtime-подсистемный код и не заявлять живую проверку. Различать контрактные тесты/диаграммные
  проверки и walkthrough; фиксировать runtime-пробел отдельно.
- **DONE:** таблица приёмки ниже покрыта; ни одна единица не считается done по одному намерению;
  завершение реализации не заявляется, если требуемый набор падает впервые или важный
  safety-кейс не проверен. Без sync/deploy (если не авторизовано отдельно); итоговый список
  файлов, exit-статусы, известные baseline-проблемы, уровень scenario-верификации.

## Команды верификации (repo root; только при исполнении)

```
python3 -m unittest discover -s config/skills/pdca-collection/tests -p 'test_*.py' -v
python3 -m unittest discover -s config/skills/pdca/tests -p 'test_*.py' -v
python3 -m unittest discover -s config/skills/pdca-coder/tests -p 'test_*.py' -v
python3 -m unittest discover -s config/skills/pdca-dotnet/tests -p 'test_*.py' -v
python3 config/skills/pdca-collection/assets/diagram/gen_collection.py
bun config/tools/sync-roles.mjs --check
git diff --check
```

Python harness — pathlib от корня репо + временные копии генератора; для рендера коллекционной
stdlib-диаграммы установка зависимостей не нужна; **никакие команды пока не запускались**.

## Соответствие критериям приёмки (§10 a–l)

| §10 | Критерий | Задача |
|---|---|---|
| a | все собственные PLAN до DAG | P1, P2 |
| b | тот же PLAN/r/N, без второго PLAN | P1, P2 |
| c | отсутствующий/невалидный PLAN блокирует DAG/DO | P1, P2 |
| d | restart partial-ready возобновляет ready-PLAN | P1, P2 |
| e | restart после групп/передачи → каноническое состояние | P1, P2 |
| f | изменения предшественника → replan | P1, P2, P6 |
| g | footprint до лейнов → пересмотр; после — стоп/без recluster | P1, P2, P6 |
| h | standalone normal `go` / autonomous immediate | P3 |
| i | `.NET` evidence + обязательные PLAN-требования | P3 |
| j | смешанные вариант-специфичные статус-пути | P1, P2, P6 |
| k | rendered-поток: собственный PLAN всех + ALL barrier до DAG/DO | P4 |
| l | существующие merge/C-тесты без изменений | P0, P4, P6 |

Дополнительно покрываются mixed-variant extra paths. Явная передача управления до планировщика
отражается в агенте.

## Риск/стоп

- Грязный workspace/несовместимые параллельные правки → согласовать/спросить, никогда не
  перезаписывать.
- Неполные допущения или footprint мешают расписанию → gate.
- Неоднозначность авторитета worktree блокирует DO.
- Drift в baseline ролевой сверки — не разрешение на посторонний sync.
- Новое падение baseline vs изменение — различать.
- Изменения за пределами textual/diagram scope или interactive mode → решение пользователя.

## Выбор исполнения

Одобрение ревью плана всё ещё требуется. Варианты: (1) последовательная реализация `coder` в
текущей сессии, `architect` только ревьюит решения и делегирует записи/команды; (2) handoff
cheap-primary `build` для исполнения (если пользователь выбирает PDCA — драйвером цикла должен
быть cheap, `architect` его **не** оркеструет). Сейчас PDCA не диспатчить и не вызывать.
Коммиты/push на любой стадии — только по явному запросу. Одобрение плана пользователем должно
включать выбор исполнения до начала.

## Журнал исполнения

- **2026-10-06, старт.** Пользователь выбрал вариант (1): последовательная реализация в текущей
  сессии; исполнение — на cheap-primary.
- **P0 baseline (до правок, HEAD `defb7f5`, ветка `main`):**
  - `pdca-collection` — 48 тестов, OK;
  - `pdca` — 84 теста, **FAILED (failures=4)** — предсуществующие:
    `ForbiddenTokenGuardTest.test_no_forbidden_token_in_runtime_surface`,
    `AdditiveIntegrationTest.test_skills_keep_has_pdca_and_pdca_coder`,
    `RoleParityTest.test_assets_are_byte_identical_to_host` (role=`pdca-escalate`),
    `RoleParityTest.test_assets_are_byte_identical_to_host` (role=`pdca-executor`);
  - `pdca-coder` — 65 тестов, OK;
  - `pdca-dotnet` — 201 тест, OK;
  - `bun config/tools/sync-roles.mjs --check` — exit 0;
  - `git diff --check` — чисто.
  - Команды: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s config/skills/<suite>/tests -p 'test_*.py' -v`.
  - Предсуществующие падения и грязный worktree НЕ откатываются; baseline для сравнения.
- **P1–P5 (реализация):**
  - P1: `config/skills/pdca-collection/tests/test_plan_barrier.py` (10 тестов) + `CollectionPlanBarrierDiagramTest` (light/dark) — RED зафиксирован.
  - P2: `config/skills/pdca-collection/SKILL.md` (P → собственный PLAN + ALL-barrier + кластеризация; §Лейн resume; новая §Неактуальный PLAN; поля `plan_state`/`cycle_id`/`selected_variant`/`plan_revision`/вектор ревизий) и `config/agents/pdca-orchestrator.md` (вход `COLLECTION TASK PLAN` + `plan_handoff`).
  - P3: `config/skills/pdca/SKILL.md`, `pdca-coder/SKILL.md`, `pdca-dotnet/SKILL.md` — collection caller handoff; standalone-семантика сохранена.
  - P4: `config/skills/pdca-collection/assets/diagram/gen_collection.py` (`data-step` task-plan/all-plans-barrier/collection-scheduling; P→DO guard «все планы готовы · группы/порядок»; лейн «continue from saved PLAN») + регенерированы `collection-hand{,-dark}.{svg,html}`.
  - P5: `docs/pdca-guide.md` §11, `docs/articles/pdca-collection.md`, `README.md`.
- **P6 финальная валидация (HEAD `defb7f5`, dirty worktree):**
  - `pdca-collection` — 60 тестов, OK;
  - `pdca` — 84, FAILED (failures=4) — те же предсуществующие (см. baseline), новых нет;
  - `pdca-coder` — 65 OK; `pdca-dotnet` — 201 OK;
  - `python3 config/skills/pdca-collection/assets/diagram/gen_collection.py` — OK;
  - `bun config/tools/sync-roles.mjs --check` — exit 0 (нового drift нет);
  - `git diff --check` — чисто;
  - планировочные сценарии добавлены в `config/skills/pdca-collection/tests/scenarios.md` (v5, static; поведение не исполнялось);
  - коммитов/push/install/deploy не делалось.
