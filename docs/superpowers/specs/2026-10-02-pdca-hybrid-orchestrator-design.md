# Гибридный оркестратор PDCA — автономный цикл через субагента `pdca-orchestrator`

- **Дата:** 2026-10-02
- **Статус:** дизайн утверждён в чате; ожидает ревью спеки
- **Область:** `config/skills/pdca-dotnet/`, `config/agents/pdca-orchestrator.md`, `config/AGENTS.md`, `README.md`, тесты и диаграмма `pdca-dotnet`
- **Не является нормой:** исторические `docs/superpowers/*` — контекст, не правило

## 0. TL;DR

Скилл `pdca-dotnet` получает два явных режима входа. **Normal** (интерактивный, с гейтом `go`) ведёт primary, как сейчас. **Autonomous** делегируется субагенту `pdca-orchestrator` через `Task`; тот ведёт полный цикл в своём контексте и возвращает компактную сводку. Права субагента структурные (`edit/bash: deny`, `task`-allowlist). Новый primary не создаётся; `go`-гейт и семантика коллекции не меняются.

## 1. Контекст и проблема

Сегодня:

- единицу `pdca-dotnet` ведёт **cheap-tier primary** (`SKILL.md:26-29`, `:44-50`);
- `pdca-orchestrator` — субагент, который **уже ведёт полные циклы** по каждой задаче группы («Каждая задача внутри группы = полноценный цикл `pdca-dotnet`», `pdca-collection/SKILL.md:322`) и поддерживает вырожденный случай одной группы/задачи (`:43-50`, `:59-60`);
- встроенный `build` нигде в репозитории не объявлен: его `mode`/права — неявный дефолт opencode, а контракт «только диспетчер» держится прозой → риск Token Burn (`SKILL.md:304`);
- нормальный режим интерактивен: `go` после PLAN (`SKILL.md:109`, `:729-739`), вопрос пользователю при отсутствии критериев (`:190-191`), а субагент вопросов не задаёт (у `pdca-orchestrator` нет `question`; `pdca-collection:186-188`).

## 2. Цель

- дать автономным циклам **структурно-ограниченного драйвера**, переиспользуя нативный `pdca-orchestrator`, без нового primary;
- сохранить интерактивный `go`-цикл и все гейты/инварианты.

## 3. Не-цели

- не создавать отдельный primary-агент (отклонённый вариант A);
- не убирать `go` и интерактивность (отклонённый вариант B);
- не расщеплять цикл между primary и субагентом (отклонённый вариант C);
- не сужать права `build` вне PDCA; не менять семантику параллельных групп `pdca-collection`; не зашивать model id.

## 4. Решение: два пути

### 4.1 Normal (default)

Без изменений: primary сам ведёт `PLAN → … → ACT`, `go`-гейт и вопросы — на нём. `pdca-orchestrator` не участвует.

### 4.2 Autonomous

1. Пользователь явно просит автономный режим (`SKILL.md:215-217`).
2. Primary остаётся диспетчером и **не ведёт цикл сам**.
3. Primary формирует **cycle brief**: цель/задача, scope, acceptance criteria, ограничения, ссылки. Коллекционный статус-файл **не создаётся** (один цикл; YAGNI); обязательный cycle-status-файл `pdca-dotnet` (`docs/specs/status/<task>-<N>.md`, пишет `coder`) сохраняется.
4. Primary вызывает `Task` с субагентом `pdca-orchestrator` и передаёт brief.
5. `pdca-orchestrator` грузит `pdca-dotnet` (не `pdca-collection`), ведёт цикл через `planner`/`coder`/`check`/`escalate`/`scout`, вопросов не задаёт.
6. Возвращает компактную сводку ≤8 строк: ref/ветка, done/incomplete, причина остановки, указатели на evidence/patch.
7. Primary релеит сводку; решений не перевыбирает.

### 4.3 Dispatch-контракт

- **Вход:** brief (текст Task-промпта).
- **Выход:** сводка ≤8 строк, без кода/диффов/логов.
- Состояние цикла — в обязательном cycle-status-файле `pdca-dotnet` на диске (ведёт `coder`); коллекционный статус-файл не создаётся. При STOP — сводка в primary.

### 4.4 Fallback

Если `Task` с `pdca-orchestrator` падает (агент отсутствует, `subagent_depth` < 2, `Task` запрещён) — **плоский primary**: primary ведёт цикл сам, как в normal, и фиксирует факт fallback. Аналог `pdca-collection:332-339`.

## 5. Инварианты (не нарушаются)

- **cheap-only:** цикл ведёт только cheap-тир; medium/strong (например `architect`) не ведут (`SKILL.md:44-50`).
- **no-4th:** после третьего failed CHECK — `escalate`, четвёртой попытки нет (`:130`, `:571-572`).
- PLAN-решение — `planner`; вердикт CHECK — `check`; `escalate` принимает решение, оркестратор маршрутизирует.
- security: условный gather-поток, агрегирует `check`.
- права `pdca-orchestrator`: `edit: deny`, `bash: deny`, `task`-allowlist; **не расширяются**.
- model id — только в профилях.

## 6. Изменения по файлам

### 6.1 `config/skills/pdca-dotnet/SKILL.md`

- `:26-29` — разнести явно: тезис «primary ведёт цикл» остаётся для normal; для autonomous — `Task(pdca-orchestrator)`; `build` остаётся shorthand дефолтного cheap primary.
- §Autonomous mode (заголовок ~`:213`) — переписать: автономный прогон **делегируется** `pdca-orchestrator`, а не ведётся primary; `go`-пауза сохраняется только в normal.
- `## Host requirements` (`:42`, тело `:44-50`) — сохранить cheap-only; в autonomous драйвер — cheap `pdca-orchestrator`.
- setup (`:67-71`) — добавить `pdca-orchestrator` в разрешённые `Task`-цели оркестратора. В профилях сейчас только модель-байндинги (`config/profiles/*.jsonc:25-34`), блока `agent.<primary>.permission.task` для `build` нет; зафиксировать allowlist явно либо в setup-шаге, либо в профиле. Для встроенного `plan` блок `task` уже `*: allow` (`config/opencode.jsonc:21-30`).
- добавить/уточнить fallback-абзац (§4.4).
- держать формулировки двух путей **в одном месте**, не дублировать по разделам.

### 6.2 `config/agents/pdca-orchestrator.md`

- `:2` description → «одна группа коллекции **или** одиночный автономный цикл»; убрать «do not use for single tasks».
- тело (`:23-43`) → добавить single-cycle вход: (б) одиночный цикл грузит только `pdca-dotnet`; `pdca-collection` — только при работе с группой.
- права **без изменений**.

### 6.3 Документация

- `config/AGENTS.md`: строка tier-routing про autonomous-делегирование.
- `README.md:22` и рядом: уточнить, что `pdca-orchestrator` — драйвер автономного одиночного цикла и групп.

### 6.4 Тесты

- `config/skills/pdca-dotnet/tests/test_routing_consistency.py` — канонический тест allowlist/permissions оркестратора (`:116-127`): обновить под новую description/поведение, при необходимости добавить проверку автономного делегирования.
- `config/skills/pdca-dotnet/tests/test_contract_consistency.py` — токены двух путей и fallback; гварды no-4th/gates/security сохранить (allowlist-ассертов здесь нет; литерал «do not use for single tasks» живёт в `pdca-orchestrator.md:2`, см. §6.2).
- `config/skills/pdca-dotnet/tests/scenarios.md` — сценарии на autonomous-делегирование и на fallback.

### 6.5 Диаграмма

- `assets/diagram/gen_pdca.py` band и `workflow.json` orb sublabel: отразить `normal: primary · autonomous: pdca-orchestrator`. Пересобрать `pdca-hand{,-dark}.{svg,html}` и `pdca-dotnet.html`.
- Новые узлы/рёбра не добавлять — только подпись.

## 7. Критерии приёмки

- normal: `build` + «по циклу» ведёт цикл сам, `go` работает.
- autonomous: цикл ведёт `pdca-orchestrator`; primary не читает/не правит файлы.
- fallback задокументирован и покрыт тестом.
- тесты `pdca-dotnet` зелёные; устаревших токенов нет.
- `bun config/tools/sync-roles.mjs --check` — ok; archify validate — ok; генерация диаграмм детерминирована.
- model id в ролях/скиллах/доках отсутствуют; права дорогих ролей не расширены.

## 8. Риски

- Структурная гарантия — только autonomous; normal остаётся prose-контрактом.
- Риск расхождения формулировок двух путей → один раздел-источник.
- Субагент не задаёт вопросов → normal намеренно не делегируется.
- Лишний слой делегирования в autonomous (latency) — приемлемо ради изоляции и структурных прав.

## 9. Открытые вопросы

Нет. Спорные развилки зафиксированы решениями: гибрид (A), без статус-файла для одиночного цикла, без нового primary.

## 10. Вне scope

- права `build` вне PDCA;
- семантика параллельных групп `pdca-collection`;
- удаление `go`-гейта;
- перенос model id в роли.
