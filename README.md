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
- `tools/` — глобальные custom tools: `roslyn.ts` (инструмент `roslyn` для семантики C#) и `roslyn-cli/` — исходник CLI на Roslyn (`Microsoft.CodeAnalysis` / `MSBuildWorkspace`), устанавливается как глобальный dotnet tool `roslynq`.
- `tui.json` — attention (встроенный звук/уведомления выключены: в WSL нет рабочих PCM-устройств).
- `plugins/` — `terminal-title.js` (заголовок вкладки Windows Terminal: иконка состояния `⏳/❓/🔔/✅`, процент контекста `○◔◑◕●`, спиннер активности; пишет OSC 2 в `/dev/tty` и переустанавливает заголовок раз в 1 сек, чтобы встроенный `OC | …` не перетирал; отладка — `OPENCODE_TERMINAL_TITLE_DEBUG=1` → `/tmp/opencode/terminal-title.log`), `windows-notify.js` (Windows Toast через WinRT + звук `<audio>` на `question.asked`/`permission.asked`; non-activating — не забирает фокус; запуск `powershell.exe -WindowStyle Hidden`), `btw-context.js` (для слэш-команды `btw` — на хуке `tool.execute.before` сжимает контекст основной сессии через отдельную модель/сессию и подклеивает его в промпт субагента; env: `BTW_COMMAND`, `BTW_ALL_TASKS`, `BTW_SUMMARY_MODEL`, `BTW_SUMMARY_DISABLED`, `BTW_MAX_MESSAGES`, `BTW_MAX_CHARS`, `BTW_SUMMARY_TIMEOUT_MS`, `BTW_CONTEXT_DEBUG`), `response-timestamp.js` (метка `[HH:MM:SS]` на той же строке: в текстовых ответах агента — перед текстом, узкими квадратными скобками `⟦HH:MM:SS⟧` (TUI рендерит абзацы как подсвеченный tree-sitter markdown: ASCII `[x]` парсится как shortcut-link и красится ссылкой, а полноширинный `［x］` не линкуется, но занимает 2 клетки и даёт визуальный отступ; экранирование `\[…\]` даёт видимый обратный слэш; варианты через `RESPONSE_TIMESTAMP_TEXT`: `narrow` (по умолчанию), `wide` — `［…］`, `ascii` — `[`+`]`, `code` — inline-code); у bash-вызова — первой строкой-комментарием `# [HH:MM:SS]` в самой команде, т.к. TUI рисует bash из `input.command`, а не из `state.title`; остальным тулам — префикс заголовка; в ответах по умолчанию в начало — время старта; идемпотентно; на `experimental.chat.messages.transform` метки вырезаются из контекста модели; env: `RESPONSE_TIMESTAMP_LINK=1`+`RESPONSE_TIMESTAMP_LINK_URL` (сделать ссылкой), `RESPONSE_TIMESTAMP_BRACKETS=0` (без скобок), `RESPONSE_TIMESTAMP_BASH=0`, `RESPONSE_TIMESTAMP_TOOLS=0`, `RESPONSE_TIMESTAMP_POSITION=start|end`, `RESPONSE_TIMESTAMP_SUFFIX` (иконка, по умолчанию нет), `RESPONSE_TIMESTAMP_SEP` (по умолчанию пробел), `RESPONSE_TIMESTAMP_DURATION=1`, `RESPONSE_TIMESTAMP_DEBUG=1` → `/tmp/opencode/response-timestamp.log`), `clear-session.js` (для слэш-команды `clear`: на хуке `command.execute.before` удаляет текущую сессию — `client.session.delete({ path: { id } })`, обрати внимание на ключ `id`, а не `sessionID` — и бросает ошибку, чтобы оборвать отправку промпта; TUI переходит на чистую сессию, но показывает короткий красный тост `Failed to send command`, так как тихого отмены слэш-команды в opencode нет; срабатывает только на `command === "clear"`).
- `commands/` — пользовательские слэш-команды: `btw.md` (побочный вопрос субагенту; контекст сжимает плагин `btw-context.js`) и `clear.md` — `/clear` перекрывает встроенный алиас и удаляет текущую сессию (логика в плагине `clear-session.js`).
- `agents/` — кастомные субагенты (dotnet-*).
- `profiles/` — `deepseek.jsonc`, `gp.jsonc` (модели, MCP-серверы, skills paths; открываются алиасами `oc-ds`/`oc-gp` через `OPENCODE_CONFIG`). В `provider.*.options` заданы `headerTimeout: 60000` и `chunkTimeout: 180000` (дефолт opencode — 300000): мёртвый сокет при смене Wi-Fi/сети всё равно ловится по `chunkTimeout` быстрее дефолтных 5 минут, но 30с на чанк давали ложные ошибки `SSE read timed out` (стрим-ошибка `ResponseStreamError`) и `ProviderHeaderTimeoutError` на длинном reasoning — 180с/60с оставлены с запасом; ошибка помечена retryable, и opencode переподключается (бэкофф с 2 с).
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
