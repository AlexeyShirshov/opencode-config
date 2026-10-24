# opencode — кастомные настройки машины (WSL Ubuntu-22.04)

Снимок пользовательской конфигурации opencode. Секреты в репозиторий не попадают.

## Структура и соответствие путям на машине

| В репозитории | Куда восстанавливать |
| --- | --- |
| `config/` | `~/.config/opencode/` |
| `dot-agents/skills/`, `dot-agents/.skill-lock.json` | `~/.agents/` |
| `data/memory.json` | `~/.local/share/opencode/memory.json` |
| `home/.bashrc`, `home/.bash_aliases` | `~/.bashrc`, `~/.bash_aliases` |

`config/` содержит:

- `opencode.jsonc` — `permissions` (V2-массив правил), `plugins` (superpowers — набор курируется до одного `brainstorming`, виден **только `architect`**: глобальный `skill: brainstorming → deny` действует лишь на агентов без своего allow, поэтому агент с бланкетным `skill: "*": allow` (сейчас — `pdca-orchestrator`) дополнительно глушит его у себя per-agent; см. `superpowers-skills-keep.txt` и `AGENTS.md`). В V1 здесь был блок `lsp` (roslyn-language-server) — в V2 язык-серверы не запускаются, блок удалён (см. `v1/`); семантика C# идёт через тул `roslyn` из `plugins/roslyn.js`.
- `AGENTS.md` — глобальные правила для всех сессий: git (коммит/пуш только по явной просьбе), C#-символы только через `roslyn`, скиллы (superpowers; при «по циклу» позвоночник — `pdca-dotnet`, bootstrap superpowers его не подменяет; русские триггеры) и маршрутизация по тирам («Tier routing»: решения → `architect`, факты → `scout`, код → `coder`).
- `tools/` — вспомогательные скрипты (`sync-roles.mjs`, `curate-skills.mjs`, `zen-cache-proxy.mjs`, `pdca-fleet.sh`) и `roslyn-cli/` — исходник CLI на Roslyn (`roslynq`). **Важно:** V1-тул `roslyn.ts` (V1-хелпер `tool()` из `@opencode-ai/plugin`) в V2 **не загружается** — он перенесён в `v1/tools/roslyn.ts`, а рабочий инструмент `roslyn` теперь регистрируется V2-плагином `plugins/roslyn.js` (`ctx.tool.transform`).
- `cli.json` — клиентские настройки V2: theme/keybinds/attention (встроенный звук/уведомления выключены: в WSL нет рабочих PCM-устройств) и список CLI-плагинов — `plugins/git-status/` (**пакет-каталог**: `package.json` → `exports["./tui"] → tui.tsx`), `replace: "sidebar.footer"` и одна строка `~/path:branch ~13 ?2 …` как в V1 (встроенный `opencode.sidebar.footer` подавляется: теряются его клик-перенос сессии по пути и подсказка `Getting started`), и `plugins/sidebar-plugins/` (`append: "sidebar.content"` — секция `Plugins` под секцией `MCP`: по умолчанию **только то, что уходит в промпт** — серверные плагины с контекстными хуками (`tool`/`prompt`/`config`/`agent`/`skill`/`reference`/`mcp`) и builtin-плагины из таблицы, снятой с кода builtin-плагинов в бинаре opencode v2.0.28 (не по префиксу id): Tools/Prompt/Agent/Skill/Config/MCP — 28 из 88 в этом профиле, остальные 60 (провайдеры, бэкенды websearch, VCS, интеграции, инфраструктурные `config.*`) в промпт не пишут; `prompt.openai/anthropic/kimi/meta/arcee` привязаны к провайдеру и для чужой модели скрыты (`openai-only` и т.п.), незнакомые id помечаются `unclassified`; у локальных серверных плагинов каналы определяются сканом их исходников, для `package` исходники недоступны — считаются влияющими; CLI/TUI-only плагины (`git-status`, сам `sidebar-plugins`) в промпт не попадают и по умолчанию скрыты; опции `scope` = `context` (по умолчанию) \| `user` (все свои, включая CLI/TUI-only) \| `all` (плюс builtin и всё не влияющее), `interval` — мс, по умолчанию 15000, `enabled`). `tui.json` — legacy V1, для плагинов не читается. Обнаружение CLI-плагинов в V2 берёт только `.ts`/`.js` и каталоги-пакеты — одиночный `.tsx` не подхватывается. `plugins/clear-session/` — `/clear` из V1, портированный на V2 CLI-API (`keymap.layer` → слэш-команда и палитра): архивирует текущую сессию (`client.session.update({ archived: true })`, в V2 архивация живёт **только** в HTTP API — команды `session.archive` нет), закрывает её вкладку и уводит на пустую сессию (home-экран = будущая сессия, запись создаётся с первым промптом); опция `newSession: false` — только архив, без ухода; встроенную `session.clear` V2 (тот же `/clear`, но без архивации — только уход на home) плагин переопределяет: тот же id + `priority: 1000` у слоя, иначе в автодополнении два `/clear`; там же вторая команда `/archive` — отдельным id, потому что `slash.aliases` V2 раскрывает вместе с канонической строкой, и `/archive` показывал бы команду дважды
- `plugins/` — серверные V2-плагины (default-export `{ id, setup }`, автообнаружение из `plugins/`): `wsl-notify` — из npm-пакета, локального файла в `plugins/` больше нет (Windows Toast через WinRT + звук `<audio>` на `permission.asked`/`form.created`/`session.execution.succeeded` (complete; легаси `session.idle` склеивается с ним по `done:<sessionID>`, переarm — на `session.execution.started`)/`session.execution.failed` (error, текст из `data.error.message`) — в V2 вопросы приходят как форм-события, V1-события `question.asked` больше нет; non-activating, `powershell.exe -WindowStyle Hidden` через `node:child_process`; путь к powershell не зашит — опция `powershell`/`WSL_NOTIFY_POWERSHELL` → PATH (`powershell.exe`, `pwsh.exe`) → Windows-маунты из `/proc/mounts` (`drvfs`/9p: `<mount>/Windows/System32/WindowsPowerShell/v1.0/powershell.exe`, `<mount>/Program Files/PowerShell/7/pwsh.exe`), битый override откатывается к автопоиску с предупреждением; тот же файл несёт V1-совместимость: default-export `{ id, setup, server }`, V1 зовёт `server()` (объектная форма — с 1.18.29), зависимостей нет; дедуп по id запроса — состояние на `globalThis` через `Symbol.for`, потому что V2 поднимает один и тот же плагин по разу на активацию локации: в одном процессе живут несколько инстансов со своими графами модулей, все на одном потоке событий, и без общего состояния каждый даёт свой тост на событие (замер: 5 инстансов → 5 тостов на одну форму, после дедупа — 1 тост + 4 skip); grace-окно для пермишенов (`graceMs` = 500 мс, env `WSL_NOTIFY_GRACE_MS` (для локально обнаруженного файла, где options недоступны): тост откладывается, `permission.replied` внутри окна его отменяет — спасает при `session.permissions: "autoaccept"`, где TUI отвечает мгновенно, а `permission.asked` всё равно приходит); субагентские завершения отсекаются по `parentID` из события `session.created` (опция `subagentComplete`); обработчик никогда не **дожидается** обращения к серверу: `ctx.session.get`, который ждут внутри обработчика, для сессии, завершающейся в этот момент, не возвращается вообще (проверено живьём: обработчик встаёт на вызове, страховочный таймаут не срабатывает, инстанс висит до рестарта сервиса), поэтому для сессий, созданных до загрузки плагина (имя и `parentID` в потоке не приходят), то же чтение делается **отцепленным** (`fire-and-forget`, без await, на первом же событии сессии — к завершению хода ответ успевает прийти), и если оно не вернётся, тост всё равно уходит с заголовком `opencode`; короткие ходы (`minTurnMs` = 500 мс, env `WSL_NOTIFY_MIN_TURN_MS`): ход короче порога не тостит, метка ставится на `session.execution.started`, без метки (плагин поднялся посреди хода) тост всё равно есть — fail-open; опции `powershell`/`graceMs`/`minTurnMs`/`subagentComplete`/`sound.*`/`maxTitle`/`maxMessage`; `npm test` — 36 проверок на подставном powershell (тост/тишина в окне/склейка/субагент/ошибка/короткий ход/формы 1.18.x); диагностика — `WSL_NOTIFY_DEBUG=1` пишет решения в `$TMPDIR/opencode-wsl-notify.log` (`WSL_NOTIFY_DEBUG_LOG` меняет путь); канонический источник — `AlexeyShirshov/skills:opencode/plugins/wsl-notify`, публикуется как npm-пакет `wsl-notify` (обновления — `opencode plugin check` / `opencode plugin update wsl-notify`); на 1.18.x плагин работает **только файлом** (`~/.config/opencode/plugins/wsl-notify.js`) — npm-путь там пакет ставит, но событий не получает (проверено на 1.18.35: у пакетов зовётся лишь `setup(ctx)` без потока событий), а V1-события (`session.idle`/`session.error`/`question.asked`) и имя сессии из `properties.info` поддержаны с 1.0.1) и `btw-context.js` (для слэш-команды `btw`: на хуке `prompt` сжимает контекст основной сессии через `ctx.generate.text()` и подклеивает его в промпт дочерней сессии, где это становится каноническим вводом; триггер — agent `btw`, см. `agents/btw.md`; env: `BTW_AGENT`, `BTW_ALL_CHILDREN`, `BTW_SUMMARY_MODEL`, `BTW_SUMMARY_DISABLED`, `BTW_MAX_MESSAGES`, `BTW_MAX_CHARS`, `BTW_SUMMARY_TIMEOUT_MS`, `BTW_CONTEXT_DEBUG`), плюс CLI-плагины `git-status/` и `sidebar-plugins/` (id `sandbox.sidebar-plugins`; `data.ts` — чистая логика: `client.plugin.list({ location })` → строки, builtin классифицируются по таблице вердиктов, снятой с кода builtin-плагинов в бинаре v2.0.28 (Tools/Prompt/Agent/Skill/Config/MCP = влияют; провайдеры/websearch-бэкенды/VCS/интеграции/инфраструктурные `config.*` = нет; `prompt.*` — с привязкой к провайдеру; неизвестные id → `unclassified`), у локальных серверных плагинов контекстные каналы определяются сканом исходников (`tool.transform`, `session.hook("prompt")`, …) — так `roslyn` помечается как `tool`, `btw-context` как `prompt`, а `wsl-notify` (только `event.subscribe`) в контекстную секцию не попадает; CLI-only каталоги из `<config>/plugins` и `<location>/.opencode/plugins`, которых нет в серверном списке (`git-status` и сам `sidebar-plugins`), видны только при `scope: "user"`/`"all"`, потому что в промпт они не пишут; `tui.tsx` — секция, счётчики, сворачивание (состояние в `storage.store` → `~/.local/state/opencode/latest/tui/plugin.sandbox.sidebar-plugins.view.json`); API менеджера TUI-плагинов внешним плагинам недоступно, поэтому TUI-only записи идут только через каталоги) и `clear-session/` (`keymap.layer` → `/clear` и палитра, без собственного keybind). V1-версии плагинов (включая снятые `terminal-title.js`, `response-timestamp.js`, `sidebar-todo.tsx`) сохранены в `v1/plugins/` — что и почему см. `v1/README.md`.
- **Условный контекст** (то, что секция `Plugins` не показывает как «в промпте», но может туда попасть): `prompt.<provider>` — только со своим провайдером (для deepseek/zen не влияют); `opencode.vcs.git` — в таблице как `env`, потому что core-инструкция `<env>` печатает `Is directory a git repo: yes|no` из `vcs.type`; `opencode.warming` — выключен, пока в конфиге нет ключа `warming`, при включении генерирует keep-alive ходы в сессии (сообщения остаются в контексте); `provider.*`/`models.dev` — контента не добавляют, но задают лимиты модели, то есть бюджет контекста и порог компакции; `command`/`config.command` — списка команд в промпте нет, но текст запущенной команды становится сообщением; `config.image` (пере-кодирование картинок → их вес в токенах) и `config.formatter` (его вывод может попасть в tool-result); `tool.input.repair` правит уже лежащие в транскрипте аргументы тул-колов; вне таблицы — `provider.*.options.body`/`headers` из конфига, которые могут подмешать в запрос произвольные поля (в т.ч. системный текст).
- `commands/` — пользовательские слэш-команды: `btw.md` (`agent: btw`, `subagent: true` — побочный вопрос уходит в фоновую дочернюю сессию; контекст основной сессии подклеивает плагин `btw-context.js`). V1-фронтматтер (`agent: general`, `subtask: true`) — в `v1/commands/btw.md`.
- `agents/` — общие markdown-роли (промпт + права/шаги в frontmatter; **модели тут не хардкодятся** — только ярлык `# tier: cheap|medium|strong`, см. §Тиры ролей): `dotnet-*`, `docfx-specialist` и роли PDCA-цикла — `coder` («руки», cheap), `planner` (PLAN Decide, medium), `check` (CHECK Triage, medium), `security-auditor` (безопасность, medium), `escalate` (strong) — плюс `scout` (GATHER: факты из исходников/доков/вики/инета, строго read-only, cheap) и `btw` (побочный вопрос по слэш-команде `/btw` в фоновой дочерней сессии, read-only, cheap; контекст родителя подклеивает `btw-context.js`). `architect` — **primary**-агент medium-тира для решений (требования/дизайн/спеки/планы; из superpowers ему доступен единственный скилл `brainstorming` — он разрешён только архитектору глобальным `permission.skill` + его собственным `allow`); ему правами запрещены `read`/`grep`/`glob`/`bash`/`edit`/`webfetch`/`websearch` и все MCP (default-deny `"*"`), поэтому любой серфинг уходит в `scout` (см. `AGENTS.md` → «Tier routing»). Плюс `pdca-orchestrator` (cheap) — драйвер одной группы `pdca-collection`, собственного PLAN задачи коллекции (вход `COLLECTION TASK PLAN`, handoff `plan_handoff`) или одиночного автономного цикла: сам выбирает вариант цикла по задаче (.NET/C# → `pdca-dotnet`, другой код → `pdca-coder`, иначе → `pdca`; по умолчанию `pdca`) и ведёт одну группу коллекции в своём worktree (см. `skills/`); при недоступности — flat primary fallback. `architect` в цикле не участвует: он решает сам (интервью/дизайн/спеки/планы), делегируя только факты `scout` и записи `coder`. **PDCA-цикл оркеструет только cheap-tier primary** (по эффективному тиру профиля, не по имени агента); решения PLAN/replan, вердикт CHECK и эскалацию оркестратор делегирует `planner`/`check`/`escalate`, решение `escalate` только роутит (`planner`/`coder`/STOP), права дорогих ролей не расширяются.
- `profiles/` — `deepseek.jsonc`, `gp.jsonc` (дефолтная модель, **привязка ролей** в блоке `agent` — см. §Тиры ролей, MCP-серверы, skills paths; открываются алиасами `oc-ds`/`oc-gp` через `OPENCODE_CONFIG`). В `provider.*.options` заданы `headerTimeout: 60000` и `chunkTimeout: 180000` (дефолт opencode — 300000): мёртвый сокет при смене Wi-Fi/сети всё равно ловится по `chunkTimeout` быстрее дефолтных 5 минут, но 30с на чанк давали ложные ошибки `SSE read timed out` (стрим-ошибка `ResponseStreamError`) и `ProviderHeaderTimeoutError` на длинном reasoning — 180с/60с оставлены с запасом; ошибка помечена retryable, и opencode переподключается (бэкофф с 2 с). У zen-провайдера (CHECK/strong-роли) запас по чанку больше — 300с. Плюс `experimental.subagent_depth: 3` (дефолт `1`; **V2** читает глубину только из `experimental` — top-level `subagent_depth` он отбрасывает с WARN `omitted unsupported legacy setting`, и глубина падает до 1): без него субагент `pdca-orchestrator` не может сам запускать субагентов, и `pdca-collection` падает в плоский primary-fallback.
  - **`deepseek.jsonc` (алиас `oc-ds`) — основной рабочий профиль**, включает всё: (1) обычная работа — дефолт-агент `build` с полными инструментами на cheap-тире; (2) **PDCA-цикл — только по скиллу `pdca-dotnet`** (`config/skills/pdca-dotnet/SKILL.md`, подробный контракт для .NET/C#): пользователь просит «по циклу»/«через PDCA» → агент грузит скилл и ведёт `PLAN → DO → CHECK → ACT` с гейтами, статус-файлом цикла как источником истины (план пишется до подтверждения плана пользователем, журнал прогресса — на каждом событии; todo-фазы `P:`/`D:`/`C:`/`A:` — обязательное зеркало, ровно одна активная фаза, параллельные единицы `D` — в статус-файле), параллельными потоками DO (код∥тесты∥доки) и CHECK (аудит∥тест∥док∥перф∥security*), loop-back по счётчикам: цикл `<N>` (растёт только в ACT) + ревизия плана `r` + попытка `n/3` в пределах ревизии (`CHECK → DO` инкрементирует `n`, реальный пересмотр плана сбрасывает `n` в 1, третий провал CHECK той же ревизии → эскалация до 4-й попытки), режимом единиц (последовательно / параллельно в дереве / ворктри — решает `planner`), автономным режимом (без вопросов), handoff в ACT, самопроверкой (красные флаги/режимы отказа), восстановлением после компакта, доказательством вместо отчёта (verification-before-completion, систематическая отладка) и защитой от инъекций. Тиры ролей заданы блоком `agent` этого же профиля (cheap — `coder`/`scout`/`pdca-orchestrator` (с `dotnet-*`-линзами), medium — `planner`/`check`/`security-auditor`/`architect`, strong — `escalate`; конкретные id моделей — только в этом блоке) — §Тиры ролей. Это привязка **профиля**: сам скилл `pdca-dotnet` моделей не содержит — только роли, таблица «Требования к хосту» и `assets/agents/*.md` с ярлыками `# tier:` (без `model:`; публикуемо на skills.sh; конкретную модель пользователь ставит в конфиге агента). Sol-роли medium (`architect`/`planner`/`pdca-planner`/`security-auditor`) идут через провайдер `openai` (ChatGPT Plus, token sharing) напрямую — без прокси. Провайдер Zen остаётся для CHECK (Argon) и strong (Sonnet) и идёт через локальный `zen-cache-proxy` (ttl 1h), поэтому `oc-ds` поднимает прокси из алиаса. Отдельного primary-`plan` нет: и старт, и возврат CHECK → PLAN / DO → PLAN делает субагент `planner`. Оркестрация цикла — **cheap-only** (эффективный тир профиля, не имя агента); medium/strong primary цикл не диспетчеризует, а вне цикла решения остаются за `architect`. Все агенты цикла (`scout`/`planner`/`check`/`coder`/`security-auditor`/`escalate`/`pdca-orchestrator`) определены целиком в общих `agents/*.md`; в профиле для них — только привязка моделей (блок `agent`, §Тиры ролей). Проектные инварианты/регистры/toolchain подключаются локальным конфигом проекта (в nextorm — `.opencode/nextorm-pdca.md` через проектный скилл `.opencode/skills/nextorm-pdca/SKILL.md`), правки кода и регистров делает `coder`.
  - Профильные алиасы (`oc-ds`/`oc-gp`) всегда стартуют **новый сеанс**: `-c` не используется (на пустом проекте он даёт «Unexpected server error» из placeholder sessionID «dummy»). Вручную: `OPENCODE_CONFIG=$HOME/.config/opencode/profiles/deepseek.jsonc opencode`. Отдельного instructions-файла у профилей нет: opencode сам отдаёт агенту список скиллов (name+description) в system prompt, поэтому `pdca-dotnet` триггерится своим `description`, а обычные задачи выполняются напрямую.
- `skills-deepseek/` — полный пак скиллов (173 шт., исходно dotnet-набор): **не сканируется**, описания не стоят контекста; регаются только симлинки из `skills-deepseek-curated`. Сюда же по умолчанию ставим новые/сторонние скиллы (правило — `config/AGENTS.md` §Install slot), читаются по требованию как `~/.config/opencode/skills-deepseek/<name>/SKILL.md`. Здесь лежат `humanizer`, `humanizer-ru`, `writing-guru`.
- `skills/` — общая папка скиллов opencode (`~/.config/opencode/skills/`): **вендоренная копия** из skills repo (правится только там, см. §Матрица синхронизации); глобальный discovery, видна **всем** профилям без `skills.paths`. Здесь лежит `pdca-dotnet` — контракт PDCA-цикла для .NET/C# (подробный, общий для `oc-ds`/`oc-gp`/sandbox), model-agnostic (роли + `assets/agents/*.md` без `model`; интерфейс на английском — публикуемо на skills.sh) и с диаграммой цикла в `assets/diagram/` (роли/ступени, без вендоров), и `pdca-collection` — стек-нейтральный верхний уровень над кодовым PDCA-циклом (вариант на задачу выбирает `pdca-orchestrator`: `.NET/C#` → `pdca-dotnet`, иначе `pdca-coder`): список задач → собственный PLAN каждой задачи (ALL-barrier) → параллельные группы (worktree на группу) → продолжение сохранённого PLAN с DO, задачи внутри группы последовательно (ветка + автокоммит), merge группы `git merge --no-ff`; агент-обёртка — `agents/pdca-orchestrator.md` (cheap-тир). Несколько **независимых** циклов (по фиче на ворктри; сессия — своя в ручном режиме, подряд в одной в автономном) — это **не скилл**, а запуск скриптом `tools/pdca-fleet.sh` (создаёт ворктри и стартует N сессий; merge — вручную, см. `--help`). Проекты могут дополнять `pdca-dotnet` своим оверлеем: файл в `instructions` проекта или проектный скилл в `.opencode/skills/` (грузятся на старте сессии / по вызову `skill` соответственно).
- `skills-gp/` — пока пусто (`.gitkeep`).

## Тиры ролей: где привязаны модели

Агенты в `config/agents/*.md` — это **роли** (prompt, permission, mode, steps), без `model:`.
В frontmatter остаётся только ярлык `# tier: cheap|medium|strong`. Конкретную модель к роли
привязывает **хост** (профиль), а **проект** может переопределить:

| Тир | Роли |
| --- | --- |
| cheap | `scout`, `coder`, `pdca-orchestrator` |
| medium | `architect`, `planner`, `check`, `security-auditor` |
| strong | `escalate` |

Конкретные id моделей живут **только** в конфиге хоста — блок `agent` (поле `model` у роли) и
ключи `model`/`small_model` в `config/profiles/*.jsonc`. В ролях, скиллах, доках и
комментариях модель не называется — только тир.

`oc-gp` одномодельный по ролям: все тиры идут на одну модель, а `model` профиля (дефолтный
агент) может стоять на другой. Без привязки субагент
**наследует модель оркестратора**, а primary `architect` падает на `model` профиля — поэтому
привязка обязательна там, где нужен не-дефолт.

Роль `pdca-orchestrator` приходит из скилла `pdca-collection` / автономного одиночного цикла (одна группа коллекции в своём worktree, собственный PLAN задачи коллекции либо весь автономный цикл) и
`model:` не задаёт — поэтому привязана здесь явно: без привязки оркестратор унаследовал бы модель
дорогого primary. Сам агент — `config/agents/pdca-orchestrator.md`, скилл — `config/skills/pdca-collection/`.

**Переопределение в проекте** — своя `.opencode/opencode.jsonc`; достаточно указать только
изменённые роли (проектный конфиг мержится после профиля):

```jsonc
{ "agent": { "escalate": { "model": "<provider>/<model-id>" } } }
```

Механика (проверено по исходникам opencode): markdown-агент и JSON `agent.<имя>` мержатся,
JSON побеждает (`packages/opencode/src/agent/agent.ts`, `if (value.model) item.model = …`);
порядок уровней — глобальный конфиг → `OPENCODE_CONFIG` (профиль) → проектные
`opencode.json(c)` → директории (`~/.config/opencode`, затем проектные `.opencode`,
`packages/opencode/src/config/paths.ts`). Отсюда правило: **`model:` в markdown не возвращать** —
он перебьёт привязку из профиля (глобальная директория агентов мержится позже профиля).

## Матрица синхронизации

Направление правок — всегда одно: **skills repo → этот снимок → хост**
(полный порядок — `AGENTS.md`, §1–3). Скиллы и плагины правятся только в skills repo и
попадают в `config/skills`/`config/plugins` исключительно через
`bun config/tools/vendor-skills.mjs --fix` (он же `--check` — гейт против правки копии на
месте). Всё остальное (`AGENTS.md`, агенты, профили, `cli.json`, `tools/`, `home/`) правится
здесь. Рабочая копия на машине обновляется **только явным выкатом** по просьбе — ничего не
раскатывается автоматически. Что менять/проверять:

| Что меняешь | Что обновить и проверить |
| --- | --- |
| `config/skills/<name>/**` | **Вендоренная копия** из skills repo (`opencode/<name>/`, кроме `habr-article` — он из skills.sh): правится только там, в снимок — `bun config/tools/vendor-skills.mjs --fix` (пишет пин коммита и хеши в `skills.lock.json`). Ручная правка здесь ловится `--check` (exit 1). Выкат на машину — `~/.config/opencode/skills/<name>/**` (`cp -a` + `diff -rq`), только явно. Детали по `assets/**` — в следующих строках |
| `config/skills/<name>/assets/**` | **Источник — `../skills/skills/<name>/assets/**`**, после правки там — `vendor-skills.mjs --fix`; installed `~/.config/opencode/skills/<name>/assets/**` (каталог скилла копируется целиком); для `pdca-dotnet` — `assets/agents/*.md` (промпты ролей без `model:`) и `assets/diagram/`: `gen_pdca.py` + `pdca-hand.{svg,html}` (светлая) и `pdca-hand-dark.{svg,html}` (тёмная) — ручная раскладка (оркестратор + фазовые блоки + граф состояний) на двух палитрах, пересобирать `python3 gen_pdca.py` (пишет файлы рядом с собой); archify-выгрузка (`workflow.json` + `pdca-dotnet.html`) удалена и не поддерживается; для `pdca-coder` — `config/skills/pdca-coder/assets/diagram/`: только ручная раскладка `gen_pdca.py` → `pdca-coder-hand.{svg,html}` (светлая) и `pdca-coder-hand-dark.{svg,html}` (тёмная), пересобирать `python3 gen_pdca.py` (archify-viewer не используется) |
| `config/skills/pdca-coder/**` | **Источник — `../skills/skills/pdca-coder/**`**, в снимок только `vendor-skills.mjs --fix`; installed `~/.config/opencode/skills/pdca-coder/**` — стек-агностичный PDCA-контракт для кодовых задач (весь каталог копируется целиком: `cp -a config/skills/pdca-coder ~/.config/opencode/skills/pdca-coder`) |
| `config/skills/pdca/**` + `config/agents/pdca-*.md` | скилл — **источник `../skills/skills/pdca/**`**, в снимок только `vendor-skills.mjs --fix`; агенты — источник здесь. installed `~/.config/opencode/skills/pdca/**` (`cp -a config/skills/pdca ~/.config/opencode/skills/pdca`) — универсальный **доменно-нейтральный** PDCA-контракт, вызывается **явно по имени `skill pdca`** (для задач с проверяемым результатом; своего фразового триггера нет и маршруты `pdca-coder`/`pdca-dotnet` не меняются). Роли — четыре агента `config/agents/pdca-{planner,executor,check,escalate}.md` (ставятся как остальные `config/agents/*.md`): `pdca-planner`/`pdca-check` — medium, `pdca-escalate` — strong, `pdca-executor` — cheap; автономный драйвер — общий `pdca-orchestrator` (cheap), факты — общий `scout` (cheap); id моделей — только в блоке `agent` профиля (§Тиры ролей). Role-assets: `config/skills/pdca/assets/agents/*.md` |
| `config/agents/*.md` | installed `~/.config/opencode/agents/*.md`; список агентов и тиры в README; привязка моделей — блок `agent` в `config/profiles/*.jsonc` (§Тиры ролей), в markdown `model:` не возвращать. Настройки этих агентов — **источник** для role-assets скилла `pdca-dotnet` (см. строку про `sync-roles.mjs`). Бланкетный `skill: "*": allow` перекрывает глобальный `brainstorming: deny`, поэтому `config/agents/pdca-orchestrator.md` дублирует `brainstorming: deny` у себя (и так же — ассеты `config/skills/pdca*/assets/agents/pdca-orchestrator.md`: host-версия и все шесть ассетов должны совпадать). Дефолт-денaj у primary (`"*": deny` + allow-лист) режет и **контекст** (скрывает MCP и лишние тулзы); у дорогих ролей `skill`/`subagent` сужены allow-листом, поэтому неиспользуемые скиллы и субагенты не грузятся (замер: `architect` ≈4.9k, `security-auditor` ≈6.8k, `planner` ≈3.7k). Внимание: `opencode run --agent <subagent>` падает в `build` — измерять контекст субагентов только реальным запуском субагента |
| `config/plugins/**`, `config/v1/**` | `config/plugins/<vendored>` (`git-status`, `zen-failover`, `clear-session`) — **вендоренная копия** из skills repo (`opencode/plugins/<name>/`), правится только там, в снимок — `vendor-skills.mjs --fix`; остальное в `config/plugins/` (`btw-context.js`) и `config/v1/**` — источник здесь. installed `~/.config/opencode/plugins/**` и `~/.config/opencode/v1/**` — только явный выкат. Активные: серверные — `.js`/`.ts`-файлы и каталоги-пакеты (default-export `{ id, setup }`); CLI — только каталоги-пакеты с `package.json → exports["./tui"]` (одиночный `.tsx` V2 не обнаруживает). `v1/` — архив V1-версий (плагины/тулы/команды), V2 его не загружает; что и почему — `v1/README.md` |
| `config/cli.json` | installed `~/.config/opencode/cli.json` (`cp` + `diff -q` = SYNC-OK). Клиентские настройки V2 — theme/keybinds/attention и **список CLI-плагинов** (порядок = порядок загрузки, `-<id>`/`-team.*` отключает, объект `{ package, options }` передаёт опции). Файл добавлен в снимок вместе с `plugins/sidebar-plugins`; `plugins/clear-session` добавлен позже; изменение списка подхватывается только новым запуском opencode |
| `config/tools/sync-roles.mjs` | гейт/генератор синхронизации `config/agents/*.md` → `config/skills/pdca-dotnet/assets/agents/*.md`. `bun config/tools/sync-roles.mjs --check` (exit 1 при расхождении настроек или структуры тел), `--fix` переписывает frontmatter assets (name/mode/steps/`# tier`/permission) из агентов, вырезая host-специфичный `external_directory` (вместо него — коммент-плейсхолдер). Описания и тела остаются ru/en и **правятся вручную** (перевод не генерируется); тул проверяет только совпадение структуры заголовков |
| `config/tools/check-host-contract.mjs` | гейт host-инвариантов этого репозитория — то, что не должно проверяться из skills: брифы `architect`/`coder`/`scout` (иерархия ролей, порядок Evidence→Inner loop→Git, политика внутреннего цикла), маршрутизация в `AGENTS.md`, биндинги профилей (только живые агенты, обязательные `pdca-*`, `provider/model`), совместимость README с контрактом, отсутствие проектной специфики (`nextorm`/`webpdca`/`лейн T…`) вне `v1/` и вендоренных скиллов. `bun config/tools/check-host-contract.mjs` (exit 1 при нарушениях, `--json` для машинного вывода) |
| `config/tools/vendor-skills.mjs` | вендоринг/гейт `config/skills/**` и вендоренных `config/plugins/**` из skills repo (`../skills`, env `SKILLS_REPO`). `--check` (exit 1 — снимок правили на месте, 2 — нет источника; печатает `PENDING DEPLOY`, если хост отстал) и `--fix` (копирует источник → снимок и пишет `skills.lock.json` с пином коммита и хешами; отказывается вендорить грязный/незапушенный источник). В хост не пишет никогда |
| `skills.lock.json` | пин коммита skills repo и хеши вендоренных деревьев; пишется только `vendor-skills.mjs --fix`, руками не править |
| `config/AGENTS.md` | installed `~/.config/opencode/AGENTS.md` (`cp` + `diff -q` = SYNC-OK) |
| `config/profiles/*.jsonc` | installed профиль; **синхронизировать только через `config/tools/sync-profiles.mjs`**, не `cp`/`rsync` (иначе installed-правки теряются молча); раздел профилей в README; алиас в `home/.bash_aliases` |
| `config/tools/sync-profiles.mjs` | безопасная синхронизация `config/profiles/*.jsonc` → `~/.config/opencode/profiles/`. Помнит sha256 последнего успешного sync в `~/.local/state/opencode/sync-profiles.json` (для нестандартного `--target` — `<target>/.sync-profiles.json`): `--check` (exit 1 — дрейф, 2 — локальная правка), `--fix` копирует только безопасные файлы, `--fix --force` перезаписывает локальную правку. Если installed разошёлся с последним sync, печатает diff `agent`-ролей и отказывается копировать — так был бы пойман откат Sol на `opencode/*` 18.10. Источник по умолчанию — `config/profiles` рядом со скриптом, target — `$OPENCODE_CONFIG_DIR`/`~/.config/opencode` |
| `config/skills-keep.txt` | курируемый список always-on dotnet-скиллов профиля `deepseek`; installed `~/.config/opencode/skills-keep.txt`. Регаются только они (симлинки в `~/.config/opencode/skills-deepseek-curated` — это `skills.paths` профиля); остальные скиллы пака остаются в `~/.config/opencode/skills-deepseek` (opencode их не метёт → описания не стоят контекста) и читаются по требованию напрямую. Применение — `bun ~/.config/opencode/tools/curate-skills.mjs` (`--check` = exit 1 при дрейфе, `--fix` = пересобрать симлинки); перезапуск opencode обязателен |
| `config/tools/*` | installed `~/.config/opencode/tools/*`; README |
| `config/superpowers-skills-keep.txt` | курируемый список superpowers-скиллов; installed `~/.config/opencode/superpowers-skills-keep.txt`. Регается только он (симлинки в `~/.config/opencode/superpowers-skills-curated`); остальные скиллы плагина не метутся и читаются по требованию из `<plugin>/node_modules/superpowers/skills/<name>/SKILL.md`. `using-superpowers` в списке **не держать**: bootstrap плагин читает из полного пака и инъектит как раньше (см. строку про `patch-superpowers.mjs`). Применение — `bun ~/.config/opencode/tools/curate-skills.mjs --fix --pack superpowers`; перезапуск opencode обязателен |
| `config/tools/curate-skills.mjs` | генератор/гейт curated-наборов скиллов по keep-list (`dotnet` → `skills-keep.txt`, `superpowers` → `superpowers-skills-keep.txt`): `--check` (exit 1 при дрейфе), `--fix` (создать/починить симлинки, убрать лишние), `--pack dotnet\|superpowers` (по умолчанию оба). Только симлинки, паки не трогаются |
| `config/tools/patch-superpowers.mjs` | `cp` в installed + `node ~/.config/opencode/tools/patch-superpowers.mjs` (идемпотентно, две независимые правки). (1) bootstrap не грузится в primary из skip-листа (по умолчанию `architect`; override — `SUPERPOWERS_BOOTSTRAP_SKIP_AGENTS="a,b"`). (2) сайты регистрации скиллов (V1 config-hook + V2 setup) переводятся на `~/.config/opencode/superpowers-skills-curated` (fallback — полный пак), сам bootstrap продолжает читаться из полного пака. Патч применяется ко **всем** найденным копиям плагина: V2 ставит git-плагины в `~/.cache/opencode/npm/<slug>/<stamp>/node_modules/<pkg>`, старый (V1) инсталл — в `~/.cache/opencode/packages/<spec>/node_modules/<pkg>`; патчить один `packages/` недостаточно — живая V2-копия остаётся с полным паком скиллов. **Перезапускать после любого обновления/переустановки плагина superpowers** |
| `home/.bash_aliases`, `home/.bashrc` | `~/.bash_aliases`, `~/.bashrc`; `bash -n` |
| переименование скилла/агента/профиля | старый `rg`-ом в репозитории и в installed; `OPENCODE_CONFIG=… opencode debug skill\|agent\|config` |

Проверка после правки профиля (выкат — только когда он разрешён, см. ниже):
`bun config/tools/sync-profiles.mjs --check` (exit 1 — дрейф, 2 — локальная правка хоста).
`--fix` **пишет в хост** — это и есть выкат, запускать только по явной просьбе. Если менялся
скилл/агент/профиль — `opencode debug …` из нужного профиля. Конфиг и привязки ролей
подхватывает `opencode reload` (или новый запуск), но **модель уже открытой сессии остаётся
прежней** — её меняет `/models`.

## Выкат в хост (только явно)

Ничто в этом репозитории не раскатывается в `~/.config/opencode` автоматически: ни коммит,
ни пуш, ни `vendor-skills`, ни тесты. Выкат — отдельное действие по просьбе пользователя,
после того как снимок закоммичен и запушен. Перед выкатом:

```bash
bun config/tools/vendor-skills.mjs --check   # скиллы/плагины: снимок == skills repo
bun config/tools/sync-roles.mjs --check      # ассеты ролей
bun config/tools/check-host-contract.mjs     # host-инварианты: брифы, AGENTS.md, профили, README
```

Затем — команды из §Восстановление. Отставший хост — норма (`PENDING DEPLOY` в выводе
`vendor-skills --check`); расхождение снимка с источником — нет (exit 1).

После выката должны быть зелёными `bun config/tools/vendor-skills.mjs --check` (снимок ==
источник == хост), `bun config/tools/sync-roles.mjs --check` и
`bun config/tools/sync-profiles.mjs --check` (0 drift), а `opencode debug agents` — показывать
актуальный список агентов и их `permissions`.

## Восстановление

```bash
# ВЫКАТ: выполнять явно, по просьбе, после коммита/пуша снимка.
# 1) посмотреть, что изменится, и что исчезло бы из хоста:
rsync -a -n -i config/ ~/.config/opencode/ --exclude node_modules --exclude /profiles/
# 2) конфиг opencode — БЕЗ --delete. В хосте есть файлы, которых нет в снимке, и
#    --delete снесёт их: secrets.env, service.json, package-lock.json, .gitignore,
#    plugins/sidebar-plugins/, skills-backups/, pdca-backups/, *-curated/, tests/.
rsync -a config/ ~/.config/opencode/ --exclude node_modules --exclude /profiles/
# 3) файлы, удалённые из снимка (имён нет в выводе шага 1 как «only in host» —
#    их надо убрать в хосте явно), например мёртвые роли:
rm -f ~/.config/opencode/agents/{planner,check,escalate,security-auditor}.md
# 4) профили — только через guard (правки в хосте он не затирает молча):
bun config/tools/sync-profiles.mjs --fix

# скиллы агентов
rsync -a dot-agents/ ~/.agents/

# bash (aliases + completion)
cp home/.bashrc home/.bash_aliases ~/

# память MCP
mkdir -p ~/.local/share/opencode
cp data/memory.json ~/.local/share/opencode/memory.json

# зависимости плагинов
cd ~/.config/opencode && npm install
# патч superpowers (после каждого обновления плагина): bootstrap-skip в `architect`
# + регистрация только curated-скиллов (superpowers-skills-curated)
node ~/.config/opencode/tools/patch-superpowers.mjs
# curated-наборы скиллов (dotnet + superpowers)
bun ~/.config/opencode/tools/curate-skills.mjs --fix

# инструмент roslyn (глобальный dotnet tool)
cd ~/.config/opencode/tools/roslyn-cli && dotnet pack -c Release
dotnet tool install --global --add-source ./nupkg opencode-roslyn
```

## Секреты (создать вручную, в репо не лежат)

- `~/.config/opencode/secrets.env`:
  ```bash
  export DEEPSEEK_API_KEY=...
  ```
- `~/.local/share/opencode/auth.json` — учётные данные провайдеров opencode.

## Зависимости

- Windows Terminal (для заголовка вкладки), `powershell.exe` доступен из WSL.
- `.NET 10 SDK` — для сборки и установки глобального тула `roslynq` (`config/tools/roslyn-cli`).
- `~/.bun/bin/bun`, `~/.dotnet/tools/roslyn-language-server` — абсолютные пути в конфигах завязаны на эту машину.
