# PDCA status — task `pdca-skills-docs` — cycle 2

## Current state
- Phase: ACT (closed)
- Current cycle N: 2
- Plan revision r: 2
- Attempt n: 2/3
- Active: —
- Done/Verified: Done — 4 статьи docs/articles/*.md + правки docs/pdca-guide.md; Verified — CHECK verdict PASS, AC1–AC9 = met (revision 2, iteration 2/3).

## Goal / expected result
Четыре самостоятельные русскоязычные статьи — по одной на каждый скилл `pdca*` — понятные без предварительного чтения путеводителя: назначение и выбор скилла, запуск, роли, ход цикла, один учебный сценарий, ограничения и неверные ожидания. Deliverable: `docs/articles/pdca.md`, `docs/articles/pdca-coder.md`, `docs/articles/pdca-dotnet.md`, `docs/articles/pdca-collection.md` + навигационный раздел со ссылками в конце `docs/pdca-guide.md`. Ревизия r2: статьи и связанные правки guide описывают текущий repo-контракт (drift устранён на HEAD a01d903); добавлена точечная корректировка guide (U6).

## Constraints
- Язык русский; аудитория знакома с AI-ассистентами, но не с внутренним устройством PDCA.
- Источник нормы — репозиторные `config/skills/*` (+ `config/agents/*`); scripts подтверждают поведение, не меняются.
- Guide — основа структуры, но НЕ замена повторной сверке нормативных утверждений; старые строки — адрес поиска, не подтверждение.
- `pdca-orchestrator` — не отдельная статья: его место — в `pdca.md`, специфика управления коллекцией — в `pdca-collection.md`.
- `pdca-dotnet`: нормативная часть по repo; drift installed-копии — отдельной оговоркой.
- Ориентир ~1200–2000 слов на статью (не жёсткий критерий).
- Без model id; только тиры. Не менять скиллы/агенты/профили/installed; без commit/push.
- Исторический baseline guide `9b3db4e` не подменять текущим HEAD механически.

## Assumptions
- Размещение: `docs/articles/<skill>.md`; отдельного каталога/формата статей ранее нет.
- «Статья» = самостоятельное связное объяснение с практическим сценарием, не справочник.
- Общий вводный документ не нужен; краткое введение повторяется по необходимости.
- Публикационная площадка/разметка вне scope.

## Acceptance criteria (метод проверки / негатив)
- AC1 Ровно 4 статьи (по одной на скилл), все доступны из guide. Проверка: состав файлов, заголовки, ссылки. Негатив: скилл пропущен; оркестратор — «пятый скилл»; битая ссылка.
- AC2 Каждая статья сама объясняет назначение, границы, запуск, участников, ход, результат. Проверка: ответы на вопросы только по одной статье. Негатив: нужен guide/соседняя статья.
- AC3 Различия содержательны: общий проверяемый результат (`pdca`); инженерный цикл (`pdca-coder`); .NET-специфика (`pdca-dotnet`); координация циклов (`pdca-collection`). Проверка: сверка с источниками. Негатив: отличие = замена названия.
- AC4 Все утверждения о запуске/ролях/полномочиях/гейтах/счётчиках/возвратах/остановке/доказательствах трассируются к repo-источникам. Проверка: карта «раздел статьи → file:line» с актуальной сверкой. Негатив: правило из старого guide/installed/догадки.
- AC5 Нет новых нормативных правил и противоречий контрактам; учебные упрощения не отменяют ограничений. Проверка: сверка утверждений и сценариев. Негатив: статья разрешает запрещённое; авторское превращено в правило.
- AC6 Нормативное описание — по текущим repo-источникам. Для `pdca-dotnet` «Versioned evidence contract» и «CHECK completeness gate — mandatory evidence contract» описаны как действующие части repo-контракта (config/skills/pdca-dotnet/SKILL.md:886,1085; связанные config/agents/planner.md:40, check.md:67). Отличия installed от repo упоминаются только при подтверждённом различии; существование drift не предполагается. Проверка: сопоставление .NET-статьи с источниками. Негатив: разделы названы installed-only/отсутствующими в repo.
- AC7 Жанр статьи: связное объяснение, мотивация, один ясно обозначенный учебный сценарий, разбор ограничений. Проверка: редакторская проверка. Негатив: перечни контрактных пунктов; вымышленный сценарий как реальный запуск.
- AC8 Нет лишнего копирования и смысловых противоречий между статьями; общее ядро объяснено одинаково. Проверка: сопоставление повторов. Негатив: 4 копии общей механики.
- AC9 Изменения ограничены документацией; ссылки/указатели корректны, происхождение материала обозначено, baseline вселенной объявлен. Проверка: diff, локальные ссылки. Негатив: изменены skills/agents/scripts; старый guide объявлен перепроверенным.

## Plan quality / gaps
- Состав «каждого» скилла → 4 перечисленных; подтвердить состав репозитория в U0.
- Локация/формат статей → `docs/articles/<skill>.md`.
- Актуальность строк/деталей → целевая сверка источников в U0.
- Состояние .NET drift → подтвердить в U0; если installed недоступна — оговорить, что расхождение только из brief.

## Minimal solution
Четыре самостоятельные статьи с кратким общим ядром (не вырезанные фрагменты guide): 1) проблема/выбор; 2) запуск; 3) ход работы/роли/результат; 4) один учебный сценарий; 5) отличия/ограничения/неверные ожидания; 6) «куда дальше» (guide, соседние статьи, источники с baseline). Плюс 4 ссылки в конце guide. Альтернативы (вырезать guide / общее введение + зависимые тексты) отклонены.

## Decomposition (units)
- **U0 (P0) Фактическая основа** — `scout`: подтвердить состав, baseline, способы запуска, существенные отличия, ограничения, drift; компактная карта «утверждение → file:line». Зависимостей нет.
- **U6 (P0) Точечная корректировка guide** — `pdca-executor`: исправить baseline `docs/pdca-guide.md:1060` и ложные утверждения §14.3 `:1132-1143` (зафиксировать, что разделы теперь есть в repo; не оставлять оговорку об installed-only drift). Зависит от U0.
- **U1 (P1) `docs/articles/pdca.md`** — `pdca-executor`; зависит от U0.
- **U2 (P1) `docs/articles/pdca-coder.md`** — `pdca-executor`; зависит от U0.
- **U3 (P1) `docs/articles/pdca-dotnet.md`** — `pdca-executor`; зависит от U0 (+AC6).
- **U4 (P1) `docs/articles/pdca-collection.md`** — `pdca-executor`; зависит от U0.
- **U5 (P1) Интеграция и проверка** — `pdca-executor` собирает 4 ссылки в guide и артефакты; `pdca-check` — вердикт (AC1–AC9). Зависит от U1–U4 и U6.
- U1–U4 независимы (каждый — свой файл), допускается параллель в одном дереве; guide меняет только U5.

## Unit states
| unit | state | criteria covered | deps |
|---|---|---|---|
| U0 | done | факт-основа для AC1–AC9 | — |
| U1 | done | AC2–AC5, AC7 (pdca) | U0 |
| U2 | done | AC2–AC5, AC7 (pdca-coder) | U0 |
| U3 | done | AC2–AC7 (pdca-dotnet) | U0 |
| U4 | done | AC2–AC5, AC7 (pdca-collection) | U0 |
| U6 | done | корректный baseline/§14.3 guide | U0 |
| U5 | done | AC1–AC9 (fixes applied; re-CHECK) | U1–U4, U6 |

## Means and access
- Факты: `scout`; запись: `pdca-executor`; вердикт: `pdca-check`; эскалация: `pdca-escalate`. Рабочая область: `/home/alex/sources/opencode-config`.

## Risks / stop conditions
- Устаревшие ссылки → сверять строки перед фиксацией; новый snapshot.
- Статьи-как-справочник → сокращать общую механику, сохранять объяснение/сценарий.
- Нормативное загрязнение из installed .NET → отделять drift.
- Расхождения параллельных текстов → устранять на U5 по источнику нормы.
- Разрастание scope → без полной актуализации guide/новых скиллов/изменений контрактов.
- Существенное утверждение не подтверждается / источники противоречат → адресный `scout`; не угадывать; при устойчивой низкой уверенности — `pdca-escalate` (триггер 5). 4-й попытки нет.

## Defect history
| defect key | observed r/n | applied fixes | pointers | last recurrence | escalation outcome |
|---|---|---|---|---|---|
| dotnet-stale-ranges | r2/n1 | 1 | pdca-dotnet.md:247,255 vs repo:1029-1039,1022-1028 | r2/n1 | — |
| guide-stale-ranges (FB2) | r2/n1 | 1 | guide:1118-1120 vs repo:925,1008,1077/1029-1039/1022-1028 | r2/n1 | — |
| dotnet-ACT-standalone (AC2) | r2/n1 | 1 | pdca-dotnet.md §4/§7 | r2/n1 | — |

## Progress log
2026-10-03T12:12:50Z | PLAN | revision 1 | iteration 1/3 | PLAN ready — awaiting go | .pdca/status/pdca-skills-docs-2.md
2026-10-03T13:13:20Z | DO | revision 1 | iteration 1/3 | go received — DO started | .pdca/status/pdca-skills-docs-2.md
2026-10-03T13:15:50Z | DO→PLAN | revision 1 | iteration 1/3 | candidate (a) additive prerequisite: drift resolved at a01d903; guide §14.3/baseline stale | docs/pdca-guide.md
2026-10-03T13:15:50Z | PLAN | revision 2 | iteration 1/3 | Replanned: drift resolved; add U6 (guide §14.3/baseline fix), reformulate AC6 (r 1→2, iteration 1/3) | .pdca/status/pdca-skills-docs-2.md
2026-10-03T13:21:45Z | DO | revision 2 | iteration 1/3 | U1 closed docs/articles/pdca.md (2060 w) | docs/articles/pdca.md
2026-10-03T13:21:45Z | DO | revision 2 | iteration 1/3 | U2 closed docs/articles/pdca-coder.md (1996 w) | docs/articles/pdca-coder.md
2026-10-03T13:21:45Z | DO | revision 2 | iteration 1/3 | U3 closed docs/articles/pdca-dotnet.md (1819 w) | docs/articles/pdca-dotnet.md
2026-10-03T13:21:45Z | DO | revision 2 | iteration 1/3 | U4 closed docs/articles/pdca-collection.md (1861 w) | docs/articles/pdca-collection.md
2026-10-03T13:21:45Z | DO | revision 2 | iteration 1/3 | U6 closed: guide §14.3/baseline corrected | docs/pdca-guide.md
2026-10-03T13:21:45Z | DO→CHECK | revision 2 | iteration 1/3 | U5 closed: nav links added; cross-article consistency checked; DO → CHECK | docs/articles/, docs/pdca-guide.md
2026-10-03T13:25:15Z | CHECK | revision 2 | iteration 1/3 | CHECK verdict FAIL: stale ranges (pdca-dotnet.md, guide §14.2), AC2 dotnet ACT evidence gap. Loop-back CHECK → DO | docs/pdca-guide.md
2026-10-03T13:25:50Z | DO→CHECK | revision 2 | iteration 2/3 | U5 re-closed after fixes (stale ranges, dotnet ACT); DO → CHECK | docs/pdca-guide.md
2026-10-03T13:38:09Z | CHECK→ACT | revision 2 | iteration 2/3 | CHECK verdict PASS (AC1–AC9 met); AC1–AC4 coverage re-gathered; CHECK → ACT | docs/articles/, docs/pdca-guide.md
2026-10-03T13:38:09Z | ACT | revision 2 | iteration 2/3 | ACT closed; flow closed; status file finalized and kept | .pdca/status/pdca-skills-docs-2.md

## Done / Verified
- Done: четыре самостоятельные статьи — `docs/articles/pdca.md`, `docs/articles/pdca-coder.md`, `docs/articles/pdca-dotnet.md`, `docs/articles/pdca-collection.md`; правки `docs/pdca-guide.md` (навигационный раздел «Статьи по скиллам»; §14.3 и baseline приведены к текущему HEAD `a01d903`; §14.2 dotnet-диапазоны актуализированы).
- Verified: CHECK PASS (revision 2, iteration 2/3) — AC1–AC9 = met на свежих свидетельствах; устаревшие диапазоны исправлены; versioned evidence contract и CHECK completeness gate описаны как действующая repo-норма.

## Changed artefacts
- `docs/articles/pdca.md`, `docs/articles/pdca-coder.md`, `docs/articles/pdca-dotnet.md`, `docs/articles/pdca-collection.md` (новые).
- `docs/pdca-guide.md` (навигация + §14.2/§14.3/baseline).
- `.pdca/status/pdca-skills-docs-2.md` (статус цикла, kept).

## Next plan
— (flow closed)

## Pointers
- `docs/articles/pdca-dotnet.md:249-278` — карта источников статьи.
- `docs/pdca-guide.md:1174-1182` — навигация на статьи.
- Baseline: HEAD `a01d90379cd5a72cc53dcfe96951fa336ad5e4b0`.
