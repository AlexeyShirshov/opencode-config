# Восстановление O3-сессий в Herdr

`bin/oc` передаёт argv launcher через `O3_HERDR_RESUME_ARGV`. Плагин
`o3-session.js` подключён в `tui.json`, который launcher передаёт через
`OPENCODE_TUI_CONFIG`. Плагин поддерживает оба TUI plugin API: `setup` с
`data/ui.router` и `tui` с `state/route` (именно второй использует установленный
OpenCode 1.18.35). Требуется Herdr 0.9.2+.

Плагин сообщает Herdr выбранную корневую сессию и её `resume_argv`:

- `oc-gp` → `oc-gp --session <id>`;
- `oc-dev` → `oc-dev --session <id>`;
- `oc-loop` → `oc-loop --session <id>`;
- любой новый профиль через `oc <profile>` → `oc <profile> --session <id>`;
- новый профиль через ссылку `oc-<profile>` → `oc-<profile> --session <id>`.
- Без переменной launcher: `o3 agent opencode --session <id>`.

Для прямого запуска `o3 agent opencode` плагин также зарегистрирован в
`~/.o3-cli/o3_plugin_agent/opencode/tui.json`. Профильные launcher'ы используют
свой `OPENCODE_TUI_CONFIG`, поэтому регистрация есть в обоих TUI-конфигах.

Это позволяет восстанавливать разные профили в разных панелях одного проекта.
Каждый профиль должен иметь файл `profiles/<profile>.json`; профиль проверяется
по нему, а не по фиксированному списку имён. Каждый launcher сам вызывает
`o3 agent opencode` с нужными аргументами.
Изменения вступают в силу после перезапуска OpenCode через соответствующий
launcher. Старые запущенные процессы не получают новую интеграцию автоматически.

В конфиге Herdr должно оставаться:

```toml
[session]
resume_agents_on_restore = true
```

Для проверки запустить OpenCode через нужный launcher, открыть сессию и
проверить `herdr pane get <pane-id>`. В сохранённом `session.json` поле
`agent_session` содержит `source: herdr:opencode` и ID сессии, а соседнее поле
`agent_resume.argv` — команду `oc-* --session <id>`. После остановки и нового запуска
Herdr панель должна восстановиться через соответствующий `oc-*` launcher.

Проверки с тестовым Unix-сокетом:

```sh
node --test herdr/o3-session.test.mjs
node herdr/o3-session.tui.test.mjs
```

Второй тест проверяет текущий контракт TUI, вызов `tui` без привязки `this`,
отказ `accepted: false`, выбор дочерней и другой корневой сессии, повтор отчёта и cleanup.
Плагин расширяет штатную интеграцию OpenCode: отправляет `pane.report_agent_session`
с `source: herdr:opencode`, `agent: opencode`, `session_start_source: select` и
`resume_argv`. Это важно: в Herdr 0.9.5 уже сохранённая штатная сессия конфликтует
с чужим владельцем `custom:o3-opencode` / `o3-opencode`. Отчёт чужого агента не
захватывает такую панель и получает `resume_not_accepted` при передаче команды.
Состояние агента продолжает отслеживать штатная интеграция.
Для реального подтверждения нужно проверить `agent_resume.argv` нужной панели в
`~/.config/herdr/session.json`, а не только наличие `agent_session`.
Тестовый сокет сам по себе не доказывает восстановление после рестарта WSL.

Диагностика: `${XDG_STATE_HOME:-$HOME/.local/state}/o3-herdr/session.jsonl`.
При запуске записывается `started`, после принятого отчёта — `accepted` с
`resume_argv`, при ошибке — `error`. Повторяющиеся одинаковые ошибки не дублируются.
Неизменившийся отчёт обновляется раз в 5 секунд, чтобы пережить потерю
владения панелью или перезапуск сервера Herdr.

Переменные `HERDR_*` устанавливает Herdr, `O3_HERDR_RESUME_ARGV` устанавливает
launcher `oc-*`. Вручную экспортировать их не нужно. После изменения плагина
нужно перезапустить OpenCode: уже работающий TUI не перечитывает код плагина.

Протокол: https://herdr.dev/docs/add-herdr-support/

Профили сейчас записывают один общий конфиг O3, как и до этой интеграции.
Сохранение launcher не создаёт изолированных конфигураций для параллельных
процессов: при старте каждый `oc-*` применяет свой профиль в общий файл.
