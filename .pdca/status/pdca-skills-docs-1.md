# PDCA status — task `pdca-skills-docs` — cycle 1

## Current state
- Phase: ACT (closed)
- Current cycle N: 1
- Plan revision r: 1
- Attempt n: 2/3
- Active: `D:` DO (U1, U2)
- Done/Verified: Done — docs/pdca-guide.md (путеводитель по pdca*); Verified — CHECK verdict PASS, все AC1–AC11 = met (revision 1, iteration 2/3).

## Goal / expected result
Подробная русскоязычная человекочитаемая документация по семейству скиллов `pdca*` — `pdca`, `pdca-coder`, `pdca-dotnet`, `pdca-collection` — и агента-драйвера `pdca-orchestrator`, как основа публицистических статей: максимально доступно объяснить логику работы, переходы, условия и выходы. Deliverable — один файл `docs/pdca-guide.md` (на языке-источнике: русский).

## Constraints
- Источник-рекорд — репозиторий `config/skills/*` (+ `config/agents/*`, `config/AGENTS.md`); installed-копии не расширяютRepo-норму.
- Не менять поведение скиллов/агентов/профилей; не синхронизировать `pdca-dotnet` в рамках задачи; не коммитить/пушить без явного запроса.
- Без конкретных model id — только тиры; имена ролей/сигналов/путей — в исходном написании с пояснением.
- Документ объясняет действующие правила, не создаёт новых.

## Assumptions
- «Основа статей» = подробный объяснительный материал, не готовая редакционная серия.
- Таблицы, короткая схема переходов и учебные примеры допустимы; один цельный путеводитель.
- Обязательная ссылка из `README.md` не входит в объём.

## Acceptance criteria (метод проверки)
- AC1 Все 4 скилла + место `pdca-orchestrator` представлены (назначение/вход/особенности/результаты). Проверка: сверка оглавления с картой покрытия; негатив — оркестратор назван пятым скиллом.
- AC2 Общая машина состояний: основной путь, возвраты из DO и CHECK, выход через ACT, отдельный STOP. Проверка: сверка с разделами источников; негатив — CHECK = автоуспех; STOP смешан с завершением.
- AC3 Различены `N`, `r`, `n/3`; история дефектов; запрет 4-й попытки в ревизии. Проверка: таблица счётчиков + сценарий повторного дефекта.
- AC4 Гейты 1–4, STOP и триггеры эскалации 1–5 объяснены через условие/ответственного/свидетельство/последствия. Проверка: поэлементная сверка.
- AC5 Роли, полномочия и режимы normal/autonomous: `go`, делегирование, fallback, `Notice:`, маршрутизация решения эскалации. Проверка: ролевая таблица + сценарии.
- AC6 Отличия вариантов: инженерные потоки; .NET-гейты и inner loop; группировка/изоляция/завершение коллекций. Проверка: матрица различий; негатив — `incomplete` допущен к merge.
- AC7 Выходы и восстановление: результат, статус-файл, доказательства, defect history, phase-todo, recovery после компакции, STOP/незавершённость. Проверка: сверка перечня артефактов и путей.
- AC8 Каждое нормативное утверждение прослеживается к источнику; repo отделён от installed drift. Проверка: проверка ссылок/карты покрытия.
- AC9 Понятность без чтения `SKILL.md`: термины объяснены при первом употреблении, причины показаны на примерах. Проверка: редакторский проход + контрольные вопросы.
- AC10 Учебные сценарии и блок идей для статей не создают новых правил. Проверка: маркировка примеров; сверка переходов.
- AC11 Изменения ограничены документацией. Проверка: итоговый diff исполнителем и CHECK.

## Plan quality / gaps
- Локация/формат → решение PLAN: один `docs/pdca-guide.md`.
- Действующая версия при drift → нормативная часть по repo; installed-отличия — отдельная оговорка.
- Точные гейты/триггеры/правила счётчиков/восстановления → добирается в U1 (`scout`).
- Полные контракты ролей, fallback, отличия .NET и поведение `validate_inner_loop.py` → доказательства в U1.
- Состав семейства `pdca*` → подтвердить в U1, молча не расширять.

## Minimal solution
Один многослойный документ: назначение и модель → точная механика переходов и ограничений → различия скиллов и коллекции → глоссарий, источники, drift и направления статей. Общее объясняется один раз; отличия — связной прозой.

## Decomposition (units)
- **U1 (P0) Проверяемый корпус источников** — `scout`: baseline revision, состав семейства, точные правила переходов/гейтов/ролей/счётчиков/drift, карта «тема → источник». Критерий: указатели `file:line` + revision + перечень неподтверждённого. Зависимостей нет.
- **U2 (P1) Человекочитаемый путеводитель `docs/pdca-guide.md`** — `pdca-executor`; зависит от U1. Критерий: AC1–AC11 + трассировка нормативных утверждений + читательский контроль + diff.

## Unit states
| unit | state | criteria covered | deps |
|---|---|---|---|
| U1 | done | evidence base для AC1–AC8 | — |
| U2 | done | AC1–AC11 (fixes applied; re-CHECK) | U1 |

## Means and access
- Факты: `scout` (read-only, указатели). Запись: `pdca-executor`. Вердикт: `pdca-check`. Эскалация: `pdca-escalate`.
- Рабочая область: `/home/alex/sources/opencode-config`.

## Risks / stop conditions
- Смешение repo/installed → явное разделение. Обобщение правил одного скилла → матрица применимости.
- Нечитаемая полнота → интуитивная модель раньше деталей. Красота ценой точности → метафоры маркируются.
- Нельзя подтвердить правило → адресный `scout`; противоречие, не разрешимое приоритетом repo → возврат в PLAN / эскалация (триггер 5).
- Требуется изменить скилл/синхронизировать installed/расширить права → отдельное решение, не скрытая часть задачи.

## Defect history
| defect key | observed r/n | applied fixes | pointers | last recurrence | escalation outcome |
|---|---|---|---|---|---|
| skill-creates-agents (C1) | r1/n1 | 1 | guide:118-119 vs pdca/SKILL.md:36-38 | r1/n1 | — |
| dotnet-gate-E2E (C2) | r1/n1 | 1 | guide:253-254 vs pdca-dotnet/SKILL.md:188-196,810-820 | r1/n1 | — |
| fallback-security-auditor (C4) | r1/n1 | 1 | guide:606-608 vs pdca-coder/SKILL.md:69 | r1/n1 | — |
| terms-first-use (AC9) | r1/n1 | 1 | guide:100,103,182,265,740 | r1/n1 | — |
| typo-Variante (C5) | r1/n1 | 1 | guide:1043 | r1/n1 | — |
| traceability-AC8 (evidence) | r1/n1 | 0 | gather: 7 ссылок проверено, полная карта — нет | r1/n1 | — |
| scope-AC11 (evidence) | r1/n1 | 0 | .pdca содержимое не перечислено | r1/n1 | — |

## Progress log
2026-10-03T11:43:50Z | PLAN | revision 1 | iteration 1/3 | PLAN ready — awaiting go | .pdca/status/pdca-skills-docs-1.md
2026-10-03T11:48:34Z | DO | revision 1 | iteration 1/3 | go received — DO started | .pdca/status/pdca-skills-docs-1.md
2026-10-03T11:50:04Z | DO | revision 1 | iteration 1/3 | U1 closed (evidence map; baseline 9b3db4e) | scout evidence map
2026-10-03T11:53:14Z | DO→CHECK | revision 1 | iteration 1/3 | U2 closed (docs/pdca-guide.md; wc -w 9631, 1162 lines); all units done; DO → CHECK | docs/pdca-guide.md
2026-10-03T11:56:26Z | CHECK | revision 1 | iteration 1/3 | CHECK verdict FAIL: C1 high; C2,C4,AC9 medium; C5 low. Loop-back CHECK → DO | docs/pdca-guide.md
2026-10-03T11:57:05Z | DO→CHECK | revision 1 | iteration 2/3 | U2 re-closed after fixes (C1,C2,C4,AC9,C5); DO → CHECK | docs/pdca-guide.md
2026-10-03T12:00:32Z | CHECK→ACT | revision 1 | iteration 2/3 | CHECK verdict PASS (all AC1–AC11 met); AC1–AC4 re-gathered; CHECK → ACT | docs/pdca-guide.md
2026-10-03T12:00:32Z | ACT | revision 1 | iteration 2/3 | ACT closed; flow closed; status file finalized and kept | docs/pdca-guide.md

## Done / Verified
- Done: `docs/pdca-guide.md` — человекочитаемый русскоязычный путеводитель по семейству скиллов `pdca*` (актуальная механика, переходы, гейты, счётчики, режимы, роли, коллекция, .NET-специфика).
- Verified: CHECK PASS — все AC1–AC11 `met` на свежих свидетельствах (revision 1, iteration 2/3); дефекты C1,C2,C4,AC9,C5 исправлены и подтверждены; drift `pdca-dotnet` описан отдельной оговоркой.

## Changed artefacts
- `docs/pdca-guide.md` (новый; 1172 строки / 121883 байта).
- `.pdca/status/pdca-skills-docs-1.md` (статус цикла, kept).

## Next plan
— (flow closed)

## Pointers
- `docs/pdca-guide.md:1058-1130` — раздел «Источники и соответствие» (карта тема → `file:line`).
- `docs/pdca-guide.md:1122-1133` — оговорка о drift installed `pdca-dotnet`.
- Baseline репозитория: `9b3db4e6b45bbaad668a59f241d9a7e1ab6d2b90`.
