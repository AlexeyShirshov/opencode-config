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

- `opencode.jsonc` — LSP (roslyn), permissions.
- `tools/` — глобальные custom tools: `roslyn.ts` (инструмент `roslyn` для семантики C#) и `roslyn-cli/` — исходник CLI на Roslyn (`Microsoft.CodeAnalysis` / `MSBuildWorkspace`), устанавливается как глобальный dotnet tool `roslynq`. Плюс `zen-cache-proxy.mjs` — локальный реверс-прокси перед OpenCode Zen (`opencode.ai/zen/v1`): opencode шлёт Opus-запросы как Anthropic Messages (`POST /v1/messages`) с `cache_control:{type:"ephemeral"}` без `ttl` (=5 мин), а когда оркестратор ждёт субагентов 5–10 мин, prompt-cache протухает и весь контекст перезаписывается по `cache_write` ($5/M на Opus 5.5). Прокси добавляет `ttl:"1h"`, и вместо перезаписи идёт дешёвое чтение кэша ($0.2/M). Поднимается на `127.0.0.1:8787` из алиаса `oc-dev` (функция `_oc_zen_proxy_ensure`, health-check `GET /__health`; `/dev/tcp` в этой WSL виснет — проверка через `curl`), а `profiles/oc-dev.jsonc` указывает `provider.opencode.options.baseURL` на него; если прокси не поднят, профиль `oc-dev` не работает — запускать через алиас. ENV: `UPSTREAM`, `PORT`, `REWRITE` (`ttl` | `add` | `none`), `LOG=1` + `CAPTURE_DIR` — дамп тел запросов (ключи/`authorization` редактируются). Учитывать: 1h-запись у Anthropic тарифицируется как 2× input, а модель стоимости opencode (`cache_write: 5`) считает 1.25× — отображаемая цена может занижать. Замер (26.09, Opus 5.5 via Zen, один и тот же сеанс, второй ход через ~6m53s): с прокси `cacheR=15841 / cacheW=19` ($0.0034, 100% попадание), без прокси `cacheR=0 / cacheW=15859` ($0.0794, 0%) — «холодный» ход дешевле ~23×; на реальной oc-dev-сессии 7 таких перезаписей (859K ток.) дали бы ≈$4.1 экономии.
- `tui.json` — attention (встроенный звук/уведомления выключены: в WSL нет рабочих PCM-устройств).
- `plugins/` — `terminal-title.js` (заголовок вкладки Windows Terminal: иконка состояния `⏳/❓/🔔/✅`, процент контекста `○◔◑◕●`, спиннер активности; пишет OSC 2 в `/dev/tty` и переустанавливает заголовок раз в 1 сек, чтобы встроенный `OC | …` не перетирал; отладка — `OPENCODE_TERMINAL_TITLE_DEBUG=1` → `/tmp/opencode/terminal-title.log`), `windows-notify.js` (Windows Toast через WinRT + звук `<audio>` на `question.asked`/`permission.asked`; non-activating — не забирает фокус; запуск `powershell.exe -WindowStyle Hidden`), `btw-context.js` (для слэш-команды `btw` — на хуке `tool.execute.before` сжимает контекст основной сессии через отдельную модель/сессию и подклеивает его в промпт субагента; env: `BTW_COMMAND`, `BTW_ALL_TASKS`, `BTW_SUMMARY_MODEL`, `BTW_SUMMARY_DISABLED`, `BTW_MAX_MESSAGES`, `BTW_MAX_CHARS`, `BTW_SUMMARY_TIMEOUT_MS`, `BTW_CONTEXT_DEBUG`), `response-timestamp.js` (метка `[HH:MM:SS]` на той же строке: в текстовых ответах агента — перед текстом, узкими квадратными скобками `⟦HH:MM:SS⟧` (TUI рендерит абзацы как подсвеченный tree-sitter markdown: ASCII `[x]` парсится как shortcut-link и красится ссылкой, а полноширинный `［x］` не линкуется, но занимает 2 клетки и даёт визуальный отступ; экранирование `\[…\]` даёт видимый обратный слэш; варианты через `RESPONSE_TIMESTAMP_TEXT`: `narrow` (по умолчанию), `wide` — `［…］`, `ascii` — `[`+`]`, `code` — inline-code); у bash-вызова — первой строкой-комментарием `# [HH:MM:SS]` в самой команде, т.к. TUI рисует bash из `input.command`, а не из `state.title`; остальным тулам — префикс заголовка; в ответах по умолчанию в начало — время старта; идемпотентно; на `experimental.chat.messages.transform` метки вырезаются из контекста модели; env: `RESPONSE_TIMESTAMP_LINK=1`+`RESPONSE_TIMESTAMP_LINK_URL` (сделать ссылкой), `RESPONSE_TIMESTAMP_BRACKETS=0` (без скобок), `RESPONSE_TIMESTAMP_BASH=0`, `RESPONSE_TIMESTAMP_TOOLS=0`, `RESPONSE_TIMESTAMP_POSITION=start|end`, `RESPONSE_TIMESTAMP_SUFFIX` (иконка, по умолчанию нет), `RESPONSE_TIMESTAMP_SEP` (по умолчанию пробел), `RESPONSE_TIMESTAMP_DURATION=1`, `RESPONSE_TIMESTAMP_DEBUG=1` → `/tmp/opencode/response-timestamp.log`), `clear-session.js` (для слэш-команды `clear`: на хуке `command.execute.before` удаляет текущую сессию — `client.session.delete({ path: { id } })`, обрати внимание на ключ `id`, а не `sessionID` — и бросает ошибку, чтобы оборвать отправку промпта; TUI переходит на чистую сессию, но показывает короткий красный тост `Failed to send command`, так как тихого отмены слэш-команды в opencode нет; срабатывает только на `command === "clear"`).
- `commands/` — пользовательские слэш-команды: `btw.md` (побочный вопрос субагенту; контекст сжимает плагин `btw-context.js`) и `clear.md` — `/clear` перекрывает встроенный алиас и удаляет текущую сессию (логика в плагине `clear-session.js`).
- `agents/` — кастомные субагенты (dotnet-*).
- `profiles/` — `deepseek.jsonc`, `gp.jsonc`, `oc-dev.jsonc` (модели, MCP-серверы, skills paths; открываются алиасами `oc-ds`/`oc-gp`/`oc-dev` через `OPENCODE_CONFIG`). В `provider.*.options` заданы `headerTimeout: 60000` и `chunkTimeout: 180000` (дефолт opencode — 300000): мёртвый сокет при смене Wi-Fi/сети всё равно ловится по `chunkTimeout` быстрее дефолтных 5 минут, но 30с на чанк давали ложные ошибки `SSE read timed out` (стрим-ошибка `ResponseStreamError`) и `ProviderHeaderTimeoutError` на длинном reasoning — 180с/60с оставлены с запасом; ошибка помечена retryable, и opencode переподключается (бэкофф с 2 с). У `opencode` (Opus 5.5) запас по чанку больше — 300с.
  - `oc-dev.jsonc` + `oc-dev.instructions.md` — продвинутый PDCA-профиль: «мозг» `build`/`plan` на `opencode/claude-opus-5-5` (`build.steps = 60` — цикл с запасом на один loop-back), «руки» на `deepseek/deepseek-flash` (все `dotnet-*`, включая `dotnet-code-review-agent`; `small_model`; на Opus оставлен только `dotnet-security-reviewer`), кастомный субагент `coder` с правом `edit`/`bash` для Do-фазы. Оркестратор цикла — `build`: инструкции задают машину состояний `PLAN → DO → CHECK → ACT → (EXIT | PLAN)` с todo-фазами (`P:`/`D:`/`C:`/`A:`), gate'ы переходов, обязательный Check и loop-back (макс. 3 итерации), карту делегирования (P/решения/C — Opus, объём D — DeepSeek) и переход Plan → Build «выполняй только план, не переисследуй». Чеклисты встроены в фазы: §PLAN — дизайн-ревью двухтактно (Gather на DeepSeek — `explore`/`general`/`dotnet-architect`/`dotnet-code-review-agent` по области изменений; Decide на Opus — build читает только сводку) по линзам SOLID/DRY, type design, perf-анти-паттерны, sealing ratio, §CHECK — аудит двухтактно (Gather на DeepSeek: `dotnet-code-review-agent` по чанкам диффа + детерминированные команды `coder` — baseline анализаторов, suppression/slop-скан, public-API/CS1591, optional-`null` smell; Triage на Opus — build читает только сводный отчёт, код в свой контекст не грузит); формулировки общие, а проектные инварианты/регистры/toolchain подключаются локальным конфигом проекта (в nextorm — `.opencode/nextorm-pdca.md` через `opencode.json`, где аудитор-чеклист — суперсет: общее ревью из `dotnet-code-review-agent` + `nextorm-code-auditor`), правки кода и регистров делает `coder`.
- `skills-deepseek/` — скиллы профиля deepseek.
- `skills-gp/` — пока пусто (`.gitkeep`).

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
