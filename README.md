# opencode — кастомные настройки машины (WSL Ubuntu-22.04)

Снимок пользовательской конфигурации opencode. Секреты в репозиторий не попадают.

## Структура и соответствие путям на машине

| В репозитории | Куда восстанавливать |
| --- | --- |
| `config/` | `~/.config/opencode/` |
| `dot-agents/skills/`, `dot-agents/.skill-lock.json` | `~/.agents/` |
| `data/memory.json` | `~/.local/share/opencode/memory.json` |

`config/` содержит:

- `opencode.jsonc` — LSP (roslyn), permissions.
- `tools/` — глобальные custom tools: `roslyn.ts` (инструмент `roslyn` для семантики C#) и `roslyn-cli/` — исходник CLI на Roslyn (`Microsoft.CodeAnalysis` / `MSBuildWorkspace`), устанавливается как глобальный dotnet tool `roslynq`.
- `tui.json` — attention (встроенный звук/уведомления выключены: в WSL нет рабочих PCM-устройств).
- `plugins/` — `terminal-title.js` (заголовок вкладки Windows Terminal: иконка состояния `⏳/❓/🔔/✅`, процент контекста `○◔◑◕●`, спиннер активности; пишет OSC 2 в `/dev/tty` и переустанавливает заголовок раз в 1 сек, чтобы встроенный `OC | …` не перетирал; отладка — `OPENCODE_TERMINAL_TITLE_DEBUG=1` → `/tmp/opencode/terminal-title.log`), `windows-notify.js` (Windows Toast через WinRT + звук `<audio>` на `question.asked`/`permission.asked`; non-activating — не забирает фокус; запуск `powershell.exe -WindowStyle Hidden`), `btw-context.js` (для слэш-команды `btw` — на хуке `tool.execute.before` сжимает контекст основной сессии через отдельную модель/сессию и подклеивает его в промпт субагента; env: `BTW_COMMAND`, `BTW_ALL_TASKS`, `BTW_SUMMARY_MODEL`, `BTW_SUMMARY_DISABLED`, `BTW_MAX_MESSAGES`, `BTW_MAX_CHARS`, `BTW_SUMMARY_TIMEOUT_MS`, `BTW_CONTEXT_DEBUG`).
- `agents/` — кастомные субагенты (dotnet-*).
- `profiles/` — `deepseek.jsonc`, `gp.jsonc` (модели, MCP-серверы, skills paths).
- `skills-deepseek/` — скиллы профиля deepseek.
- `skills-gp/` — пока пусто (`.gitkeep`).

## Восстановление

```bash
# конфиг opencode
rsync -a --delete config/ ~/.config/opencode/ --exclude node_modules

# скиллы агентов
rsync -a dot-agents/ ~/.agents/

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
