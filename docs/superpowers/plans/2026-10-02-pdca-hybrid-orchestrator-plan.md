# План внедрения: гибридный оркестратор PDCA — автономный цикл через `pdca-orchestrator`

- **Дата:** 2026-10-02
- **Источник:** `docs/superpowers/specs/2026-10-02-pdca-hybrid-orchestrator-design.md` (утверждена)
- **Принципы:** без коммитов/push/установок; не сужать/не расширять права дорогих ролей; model id — только в профилях; сохранять пользовательский WIP; файлы `config/skills/pdca-collection/**` не редактировать.

## Предусловия (факты, на которые опираемся)

- Скилл `pdca-dotnet`: `SKILL.md:26-29` («you drive the cycle yourself»), `:42-50` (Host requirements, cheap-only), `:67-71` (setup allowlist), `:109`/`:729-739` (`go`-гейт normal), `:213-252` (§Autonomous mode), `:130`/`:571-572` (no-4th), `:190-191` (вопрос только в normal).
- Агент `config/agents/pdca-orchestrator.md`: `:2` description содержит «do not use for single tasks»; тело `:23-43` — ведёт одну группу; права `:6-21` (`task`-allowlist, `edit/bash: deny`); ассет-копии нет.
- `pdca-collection/SKILL.md:322` — задача группы = полный цикл `pdca-dotnet`; `:43-50`,`:59-60` — вырожденный случай одной группы; `:332-339` — плоский fallback.
- Профили: `subagent_depth: 3` (`deepseek.jsonc:3-4`, `gp.jsonc:3-4`); `default_agent: build` (`deepseek.jsonc:19`); блоки `agent.*` — только model id (`:25-34`); для `plan` task уже `*: allow` (`config/opencode.jsonc:21-30`).

## P1. Инвентаризация вхождений (read-only)

- **Действие:** `grep -rn "do not use for single\|drive the cycle yourself\|single cycle\|автоном" config/agents config/skills/pdca-dotnet README.md config/AGENTS.md` — зафиксировать полный список мест, где описан драйвер цикла.
- **DONE:** список `file:line` собран; ни одно живое место не пропущено (исторические `docs/superpowers/*` игнорируются).

## P2. Контракт `config/skills/pdca-dotnet/SKILL.md`

- **Действие:**
  1. `:26-29` — разнести на **normal** (primary ведёт цикл, как сейчас) и **autonomous** (`Task(pdca-orchestrator)`, brief → сводка ≤8 строк). `build` остаётся shorthand дефолтного cheap primary.
  2. §Autonomous mode (`:213-252`) — добавить/переписать: в autonomous primary **не ведёт цикл сам**, а диспатчит субагента; вопросов нет (автономность); при STOP релеит сводку; fallback §4.4 спеки.
  3. `## Host requirements` (`:42`, тело `:44-50`) — cheap-only сохранить; драйвер: normal — cheap primary, autonomous — cheap `pdca-orchestrator`; medium/strong не ведут.
  4. setup (`:67-71`) — добавить `pdca-orchestrator` в разрешённые `Task`-цели оркестратора; отметить, что для `build`/`plan` это уже разрешено, а в профилях явного `agent.<primary>.permission.task` блока нет.
  5. Формулировки двух путей держать **в одном месте**, без дублирования по разделам.
- **DONE:** `grep -n "pdca-orchestrator" config/skills/pdca-dotnet/SKILL.md` показывает и normal-, и autonomous-ветки; `go`-гейт остался только в normal; no-4th/gates/security не изменились.

## P3. Агент `config/agents/pdca-orchestrator.md`

- **Действие:**
  1. `:2` description → «одна группа коллекции **или** одиночный автономный цикл `pdca-dotnet`»; убрать «do not use for single tasks».
  2. Тело `:23-43` → два входа: (а) группа — грузит `pdca-collection` + `pdca-dotnet`; (б) одиночный цикл — грузит только `pdca-dotnet`, работает в текущем worktree.
  3. Права `:6-21` **не менять**.
- **DONE:** `pdca-orchestrator.md` не содержит «do not use for single tasks»; `task`-allowlist, `edit: deny`, `bash: deny` побайтово те же.

## P4. Документация

- **Действие:** `config/AGENTS.md` (секция `### Tier routing`) — одна строка про autonomous-делегирование cheap-`pdca-orchestrator`; `README.md:22` и рядом — уточнить, что `pdca-orchestrator` — драйвер автономного одиночного цикла и групп.
- **DONE:** доки не противоречат SKILL; model id нигде не названы.

## P5. Тесты и сценарии

- **Действие:**
  1. `config/skills/pdca-dotnet/tests/test_routing_consistency.py` — канонический тест allowlist/permissions (`:116-127`): обновить под новую description; при необходимости добавить проверку, что одиночный автономный цикл делегируется (`Task(pdca-orchestrator)`), а права не расширены.
  2. `config/skills/pdca-dotnet/tests/test_contract_consistency.py` — токены двух путей и fallback (`Autonomous mode`, `pdca-orchestrator`, brief/≤8 строк); гварды no-4th/gates/security/security-aggregation сохранить.
  3. `config/skills/pdca-dotnet/tests/scenarios.md` — сценарии: (K) autonomous-делегирование субагенту, (L) fallback в плоский primary.
- **DONE:** `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s config/skills/pdca-dotnet/tests -p 'test_*.py' -v` — OK, 0 failures; старых токенов нет.

## P6. Диаграмма

- **Действие:** `assets/diagram/gen_pdca.py` band и `assets/diagram/workflow.json` orb sublabel → `normal: primary · autonomous: pdca-orchestrator` (текущее `cheap` сохранить); пересобрать `pdca-hand{,-dark}.{svg,html}` и `pdca-dotnet.html`; новых узлов/рёбер не добавлять.
- **DONE:** генерация детерминирована (двойной прогон byte-identical), SVG/HTML парсятся; `archify validate workflow … --quality showcase --json` — 9/9, 0 ошибок/предупреждений.

## P7. Финальная верификация

- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s config/skills/pdca-dotnet/tests -p 'test_*.py' -v` → OK.
- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s config/skills/pdca-collection/tests -p 'test_*.py' -v` → прогон без правок коллекции; failures только сообщить.
- `bun config/tools/sync-roles.mjs --check` → ok.
- `git diff --check` (и `--cached --check`) → чисто.
- Проверить: права дорогих ролей не расширены; model id не добавлены; WIP сохранён; коммитов нет.

## Соответствие критериям приёмки

| Критерий спеки | Шаг |
|---|---|
| normal: `build` + «по циклу» ведёт цикл сам, `go` работает | P2.1 |
| autonomous: цикл ведёт `pdca-orchestrator`, primary не читает/не правит | P2.2, P3 |
| fallback задокументирован и покрыт тестом | P2.4, P5 |
| тесты зелёные, устаревших токенов нет | P5, P7 |
| sync/archify/determinism ok | P6, P7 |
| model id только в профилях, права не расширены | P3, P4, P7 |

## Риски

- Два пути легко разъезжаются в формулировках → один раздел-источник (P2.5).
- Normal остаётся prose-контрактом (структурные права только в autonomous) — принято спекой.
- При отсутствии `pdca-orchestrator` в хосте сработает fallback; standalone-установка ассета не входит в scope.

## Вне scope

- права `build` вне PDCA; семантика параллельных групп `pdca-collection`; удаление `go`; новые primary-агенты; перенос model id в роли.
