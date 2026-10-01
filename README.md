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

- `opencode.jsonc` — LSP (roslyn), permissions, `plugin` (superpowers — скиллы `brainstorming`/`writing-plans`/`executing-plans` и т.д., см. `AGENTS.md`).
- `AGENTS.md` — глобальные правила для всех сессий: git (коммит/пуш только по явной просьбе), C#-символы только через `roslyn`, скиллы (superpowers; при «по циклу» позвоночник — `pdca-dotnet`, bootstrap superpowers его не подменяет; русские триггеры) и маршрутизация моделей («Model routing»: решения → `architect`, факты → `scout`, код → `coder`).
- `tools/` — глобальные custom tools: `roslyn.ts` (инструмент `roslyn` для семантики C#) и `roslyn-cli/` — исходник CLI на Roslyn (`Microsoft.CodeAnalysis` / `MSBuildWorkspace`), устанавливается как глобальный dotnet tool `roslynq`. Плюс `zen-cache-proxy.mjs` — локальный реверс-прокси перед OpenCode Zen (`opencode.ai/zen/v1`): opencode шлёт Opus-запросы как Anthropic Messages (`POST /v1/messages`) с `cache_control:{type:"ephemeral"}` без `ttl` (=5 мин), а когда оркестратор ждёт субагентов 5–10 мин, prompt-cache протухает и весь контекст перезаписывается по `cache_write` ($5/M на Opus 5.5). Прокси добавляет `ttl:"1h"`, и вместо перезаписи идёт дешёвое чтение кэша ($0.2/M). Поднимается на `127.0.0.1:8787` из алиаса `oc-ds` (функция `_oc_zen_proxy_ensure`, health-check `GET /__health`; `/dev/tcp` в этой WSL виснет — проверка через `curl`), а `profiles/deepseek.jsonc` указывает `provider.opencode.options.baseURL` на него; если прокси не поднят, профиль `oc-ds` не работает — запускать через алиас. ENV: `UPSTREAM`, `PORT`, `REWRITE` (`ttl` | `add` | `none`), `LOG=1` + `CAPTURE_DIR` — дамп тел запросов (ключи/`authorization` редактируются). Учитывать: 1h-запись у Anthropic тарифицируется как 2× input, а модель стоимости opencode (`cache_write: 5`) считает 1.25× — отображаемая цена может занижать. Замер (26.09, Opus 5.5 via Zen, один и тот же сеанс, второй ход через ~6m53s): с прокси `cacheR=15841 / cacheW=19` ($0.0034, 100% попадание), без прокси `cacheR=0 / cacheW=15859` ($0.0794, 0%) — «холодный» ход дешевле ~23×; на реальной oc-ds-сессии 7 таких перезаписей (859K ток.) дали бы ≈$4.1 экономии.
- `tui.json` — attention (встроенный звук/уведомления выключены: в WSL нет рабочих PCM-устройств) и список TUI-плагинов (`git-status.tsx`, `sidebar-todo.tsx`, `clear-session.tsx`).
- `plugins/` — `terminal-title.js` (заголовок вкладки Windows Terminal: иконка состояния `⏳/❓/🔔/✅`, процент контекста `○◔◑◕●`, спиннер активности; пишет OSC 2 в `/dev/tty` и переустанавливает заголовок раз в 1 сек, чтобы встроенный `OC | …` не перетирал; отладка — `OPENCODE_TERMINAL_TITLE_DEBUG=1` → `/tmp/opencode/terminal-title.log`), `windows-notify.js` (Windows Toast через WinRT + звук `<audio>` на `question.asked`/`permission.asked`; non-activating — не забирает фокус; запуск `powershell.exe -WindowStyle Hidden`), `btw-context.js` (для слэш-команды `btw` — на хуке `tool.execute.before` сжимает контекст основной сессии через отдельную модель/сессию и подклеивает его в промпт субагента; env: `BTW_COMMAND`, `BTW_ALL_TASKS`, `BTW_SUMMARY_MODEL`, `BTW_SUMMARY_DISABLED`, `BTW_MAX_MESSAGES`, `BTW_MAX_CHARS`, `BTW_SUMMARY_TIMEOUT_MS`, `BTW_CONTEXT_DEBUG`), `response-timestamp.js` (метка `[HH:MM:SS]` на той же строке: в текстовых ответах агента — перед текстом, узкими квадратными скобками `⟦HH:MM:SS⟧` (TUI рендерит абзацы как подсвеченный tree-sitter markdown: ASCII `[x]` парсится как shortcut-link и красится ссылкой, а полноширинный `［x］` не линкуется, но занимает 2 клетки и даёт визуальный отступ; экранирование `\[…\]` даёт видимый обратный слэш; варианты через `RESPONSE_TIMESTAMP_TEXT`: `narrow` (по умолчанию), `wide` — `［…］`, `ascii` — `[`+`]`, `code` — inline-code); у bash-вызова — первой строкой-комментарием `# [HH:MM:SS]` в самой команде, т.к. TUI рисует bash из `input.command`, а не из `state.title`; остальным тулам — префикс заголовка; в ответах по умолчанию в начало — время старта; идемпотентно; на `experimental.chat.messages.transform` метки вырезаются из контекста модели; env: `RESPONSE_TIMESTAMP_LINK=1`+`RESPONSE_TIMESTAMP_LINK_URL` (сделать ссылкой), `RESPONSE_TIMESTAMP_BRACKETS=0` (без скобок), `RESPONSE_TIMESTAMP_BASH=0`, `RESPONSE_TIMESTAMP_TOOLS=0`, `RESPONSE_TIMESTAMP_POSITION=start|end`, `RESPONSE_TIMESTAMP_SUFFIX` (иконка, по умолчанию нет), `RESPONSE_TIMESTAMP_SEP` (по умолчанию пробел), `RESPONSE_TIMESTAMP_DURATION=1`, `RESPONSE_TIMESTAMP_DEBUG=1` → `/tmp/opencode/response-timestamp.log`), `clear-session.tsx` (TUI-плагин, подключён в `tui.json`; вешает слэш-команду `clear` через `slash: { name: "clear" }`): архивирует текущую сессию — `client.session.update({ sessionID, time: { archived: Date.now() } })`. Встроенной команды `session.archive` в TUI-keymap нет, поэтому архив идёт через API; диагностика — `/tmp/opencode/clear-debug.log`).
- `commands/` — пользовательские слэш-команды: `btw.md` (побочный вопрос субагенту; контекст сжимает плагин `btw-context.js`). `/clear` объявлен TUI-плагином `plugins/clear-session.tsx` (`slash: { name: "clear" }`), файла команды нет.
- `agents/` — общие markdown-роли (промпт + права/шаги в frontmatter; **модели тут не хардкодятся** — только ярлык `# tier: cheap|medium|strong`, см. §Модели ролей): `dotnet-*`, `docfx-specialist` и роли PDCA-цикла — `coder` («руки», cheap), `planner` (PLAN Decide, medium), `check` (CHECK Triage, medium), `security-auditor` (безопасность, medium), `escalate` (strong) — плюс `scout` (GATHER: факты из исходников/доков/вики/инета, строго read-only, cheap). `architect` — **primary**-агент medium-тира для решений (требования/дизайн/спеки/планы, рабочий набор — superpowers-скиллы `brainstorming`/`writing-plans`/`executing-plans`); ему правами запрещены `grep`/`glob`/`webfetch`/`websearch` и весь MCP-поиск, поэтому любой серфинг уходит в `scout` (см. `AGENTS.md` → «Model routing»). Плюс `lane` (cheap) — агент-обёртка `pdca-collection`: ведёт одну группу коллекции в своём worktree (см. `skills/`).
- `profiles/` — `deepseek.jsonc`, `gp.jsonc` (дефолтная модель, **привязка ролей** в блоке `agent` — см. §Модели ролей, MCP-серверы, skills paths; открываются алиасами `oc-ds`/`oc-gp` через `OPENCODE_CONFIG`). В `provider.*.options` заданы `headerTimeout: 60000` и `chunkTimeout: 180000` (дефолт opencode — 300000): мёртвый сокет при смене Wi-Fi/сети всё равно ловится по `chunkTimeout` быстрее дефолтных 5 минут, но 30с на чанк давали ложные ошибки `SSE read timed out` (стрим-ошибка `ResponseStreamError`) и `ProviderHeaderTimeoutError` на длинном reasoning — 180с/60с оставлены с запасом; ошибка помечена retryable, и opencode переподключается (бэкофф с 2 с). У `opencode` (Opus 5.5) запас по чанку больше — 300с.
  - **`deepseek.jsonc` (алиас `oc-ds`) — основной рабочий профиль**, включает всё: (1) обычная работа — дефолт-агент `build` с полными инструментами на `deepseek/deepseek-flash`; (2) **PDCA-цикл — только по скиллу `pdca-dotnet`** (`config/skills/pdca-dotnet/SKILL.md`, подробный контракт для .NET/C#): пользователь просит «по циклу»/«через PDCA» → агент грузит скилл и ведёт `PLAN → DO → CHECK → ACT` с гейтами, статус-файлом цикла как источником истины (план пишется до `go`, журнал прогресса — на каждом событии; todo-фазы `P:`/`D:`/`C:`/`A:` — обязательное зеркало, ровно одна активная фаза, параллельные единицы `D` — в статус-файле), параллельными потоками DO (код∥тесты∥доки) и CHECK (аудит∥тест∥док∥перф∥security*), loop-back по счётчикам: цикл `<N>` (растёт только в ACT) + ревизия плана `r` + попытка `n/3` в пределах ревизии (`CHECK → DO` инкрементирует `n`, реальный пересмотр плана сбрасывает `n` в 1, третий провал CHECK той же ревизии → эскалация до 4-й попытки), режимом единиц (последовательно / параллельно в дереве / ворктри — решает `planner`), автономным режимом (без вопросов), handoff в ACT, самопроверкой (красные флаги/режимы отказа), восстановлением после компакта, доказательством вместо отчёта (verification-before-completion, систематическая отладка) и защитой от инъекций. Модели ролей заданы блоком `agent` этого же профиля (cheap = DeepSeek Flash для `coder`/`scout`/`lane` (с `dotnet-*`-линзами), medium = GPT-6.1 Sol (variant high) для `planner`/`check`/`security-auditor`/`architect`, strong = Sonnet 5.5 для `escalate`) — §Модели ролей. Это привязка **профиля**: сам скилл `pdca-dotnet` моделей не содержит — только роли, таблица «Требования к хосту» и `assets/agents/*.md` с ярлыками `# tier:` (без `model:`; публикуемо на skills.sh; конкретную модель пользователь ставит в конфиге агента). Провайдер Zen идёт через локальный `zen-cache-proxy` (ttl 1h), поэтому `oc-ds` поднимает прокси из алиаса. Отдельного primary-`plan` нет: и старт, и возврат CHECK → PLAN / DO → PLAN делает субагент `planner` через Task. Все агенты цикла (`scout`/`planner`/`check`/`coder`/`security-auditor`/`escalate`/`lane`) определены целиком в общих `agents/*.md`; в профиле для них — только привязка моделей (блок `agent`, §Модели ролей). Проектные инварианты/регистры/toolchain подключаются локальным конфигом проекта (в nextorm — `.opencode/nextorm-pdca.md` через проектный скилл `.opencode/skills/nextorm-pdca/SKILL.md`), правки кода и регистров делает `coder`.
  - Новый сеанс (без `-c`) — вручную: `OPENCODE_CONFIG=$HOME/.config/opencode/profiles/deepseek.jsonc opencode`. Отдельного instructions-файла у профилей нет: opencode сам отдаёт агенту список скиллов (name+description) в system prompt, поэтому `pdca-dotnet` триггерится своим `description`, а обычные задачи выполняются напрямую.
- `skills-deepseek/` — скиллы профиля deepseek (dotnet-* и т.п.).
- `skills/` — общая папка скиллов opencode (`~/.config/opencode/skills/`): глобальный discovery, видна **всем** профилям без `skills.paths`. Здесь лежит `pdca-dotnet` — контракт PDCA-цикла для .NET/C# (подробный, общий для `oc-ds`/`oc-gp`/sandbox), model-agnostic (роли + `assets/agents/*.md` без `model`; интерфейс на английском — публикуемо на skills.sh) и с диаграммой цикла в `assets/diagram/` (роли/ступени, без вендоров), и `pdca-collection` — верхний уровень над ним: список задач → параллельные группы (worktree на группу), задачи внутри группы последовательно (ветка + автокоммит), merge группы `git merge --no-ff`; агент-обёртка — `agents/lane.md` (cheap-тир). Несколько **независимых** циклов (по фиче на ворктри; сессия — своя в ручном режиме, подряд в одной в автономном) — это **не скилл**, а запуск скриптом `tools/pdca-fleet.sh` (создаёт ворктри и стартует N сессий; merge — вручную, см. `--help`). Проекты могут дополнять `pdca-dotnet` своим оверлеем: файл в `instructions` проекта или проектный скилл в `.opencode/skills/` (грузятся на старте сессии / по вызову `skill` соответственно).
- `skills-gp/` — пока пусто (`.gitkeep`).

## Модели ролей: тиры и где они привязаны

Агенты в `config/agents/*.md` — это **роли** (prompt, permission, mode, steps), без `model:`.
В frontmatter остаётся только ярлык `# tier: cheap|medium|strong`. Конкретную модель к роли
привязывает **хост** (профиль), а **проект** может переопределить:

| Тир | Роли | oc-ds (профиль) | oc-gp (профиль) |
| --- | --- | --- | --- |
| cheap | `scout`, `coder`, `lane` | `deepseek/deepseek-flash` | `opencode-go/kimi-k3` |
| medium | `architect`, `planner`, `check`, `security-auditor` | `opencode/gpt-6.1-sol` (variant `high`) | `opencode-go/kimi-k3` |
| strong | `escalate` | `opencode/claude-sonnet-5-5` | `opencode-go/kimi-k3` |

`oc-gp` одномодельный: у него нет `provider.opencode`, поэтому Sol/Sonnet недоступны и все роли
идут на kimi-k3. Без привязки субагент **наследует модель оркестратора**, а primary `architect`
падает на `model` профиля — поэтому привязка обязательна там, где нужен не-дефолт.

Роль `lane` приходит из скилла `pdca-collection` (одна группа коллекции в своём worktree) и
`model:` не задаёт — поэтому привязана здесь явно: без привязки лейн унаследовал бы модель
дорогого primary. Сам агент — `config/agents/lane.md`, скилл — `config/skills/pdca-collection/`.

**Переопределение в проекте** — своя `.opencode/opencode.jsonc`; достаточно указать только
изменённые роли (проектный конфиг мержится после профиля):

```jsonc
{ "agent": { "escalate": { "model": "deepseek/deepseek-flash" } } }
```

Механика (проверено по исходникам opencode): markdown-агент и JSON `agent.<имя>` мержатся,
JSON побеждает (`packages/opencode/src/agent/agent.ts`, `if (value.model) item.model = …`);
порядок уровней — глобальный конфиг → `OPENCODE_CONFIG` (профиль) → проектные
`opencode.json(c)` → директории (`~/.config/opencode`, затем проектные `.opencode`,
`packages/opencode/src/config/paths.ts`). Отсюда правило: **`model:` в markdown не возвращать** —
он перебьёт привязку из профиля (глобальная директория агентов мержится позже профиля).

## Матрица синхронизации

Правка в `config/`/`home/` — это правка **снимка**: рабочая копия на машине должна
обновиться вместе с ним, иначе расходится то, что читает opencode. Что менять/проверять:

| Что меняешь | Что обновить и проверить |
| --- | --- |
| `config/skills/<name>/SKILL.md` | installed `~/.config/opencode/skills/<name>/SKILL.md` (`cp` + `diff -q` = SYNC-OK); описание в этом README |
| `config/skills/<name>/assets/**` | installed `~/.config/opencode/skills/<name>/assets/**` (каталог скилла копируется целиком); для `pdca-dotnet` — `assets/agents/*.md` (промпты ролей без `model:`) и `assets/diagram/` в двух видах: (1) `workflow.json` + собранный `pdca-dotnet.html` — пересобирать `archify deliver workflow … --quality showcase` при изменении **источника** `workflow.json`, **включая правку только меток** (по утверждённой спеке); если источник не менялся, HTML не пересобирать; (2) `gen_pdca.py` + `pdca-hand.{svg,html}` (светлая) и `pdca-hand-dark.{svg,html}` (тёмная) — ручная раскладка (оркестратор + фазовые блоки + граф состояний) на двух палитрах, пересобирать `python3 gen_pdca.py` (пишет файлы рядом с собой) |
| `config/agents/*.md` | installed `~/.config/opencode/agents/*.md`; список агентов и тиры в README; привязка моделей — блок `agent` в `config/profiles/*.jsonc` (§Модели ролей), в markdown `model:` не возвращать |
| `config/AGENTS.md` | installed `~/.config/opencode/AGENTS.md` (`cp` + `diff -q` = SYNC-OK) |
| `config/profiles/*.jsonc` | installed профиль; раздел профилей в README; алиас в `home/.bash_aliases` |
| `config/tools/*` | installed `~/.config/opencode/tools/*`; README |
| `home/.bash_aliases`, `home/.bashrc` | `~/.bash_aliases`, `~/.bashrc`; `bash -n` |
| переименование скилла/агента/профиля | старый `rg`-ом в репозитории и в installed; `OPENCODE_CONFIG=… opencode debug skill\|agent\|config` |

Проверка после правки: `cp` в installed + `diff -q` (должно быть пусто) и, если менялся
скилл/агент/профиль, `opencode debug …` из нужного профиля. **opencode читает конфиг при
старте процесса** — открытая сессия правки не подхватит, нужен новый запуск. Полное
восстановление снимка — `rsync` (см. ниже).

## Восстановление

```bash
# конфиг opencode
rsync -a --delete config/ ~/.config/opencode/ --exclude node_modules

# скиллы агентов
rsync -a dot-agents/ ~/.agents/

# bash (aliases + completion)
cp home/.bashrc home/.bash_aliases ~/

# память MCP
mkdir -p ~/.local/share/opencode
cp data/memory.json ~/.local/share/opencode/memory.json

# зависимости плагинов
cd ~/.config/opencode && npm install

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
