# `v1/` — архив артефактов OpenCode V1

Здесь лежат исходные (V1) версии того, что было отмигрировано на V2 или что V2 больше
не поддерживает. **Ничего из этой папки не загружается:** V2 сканирует только
`~/.config/opencode/plugins/` (и `<project>/.opencode/plugins/`), а `v1/` — рядом, не внутри.
Папка хранится для истории/отката; полное состояние «до миграции» доступно в git (`HEAD`).

## Инвентарь

| Файл | Что это в V1 | Статус в V2 |
| --- | --- | --- |
| `plugins/btw-context.js` | на `tool.execute.before` ловил тул `task` (`args.command === "btw"`) | портирован: `plugins/btw-context.js` (хук `prompt`, триггер — agent `btw`) |
| `plugins/wsl-notify.js` | событие `question.asked`, Bun `$` | портирован: `plugins/wsl-notify.js` (`form.created`, `node:child_process`) |
| `plugins/git-status.tsx` | TUI-плагин `{ id, tui }` | портирован: `plugins/git-status/` (пакет-каталог, `replace: "sidebar.footer"`) |
| `plugins/sidebar-todo.tsx` | TUI-плагин, список todo сессии (`client.session.todo`) | **не портируем**: в V2 подсистемы todo нет (тул `todowrite` удалён, API/событий нет) |
| `plugins/clear-session.tsx` | слэш-команда `/clear` → `client.session.update({ time: { archived } })` | **не портируем**: в V2 архивации сессий нет (ни в клиенте, ни в HTTP API, ни команды `session.archive`) |
| `plugins/response-timestamp.js` | метки времени ответов, хук `experimental.text.complete` | **удалено**: в V2 нет аналога; у `Tool.Result` нет поля `title` |
| `plugins/terminal-title.js` | заголовок вкладки терминала (OSC 2 в `/dev/tty`) | **удалено**: плагины V2 живут в фоновом сервисе, а не в процессе TUI, поэтому `/dev/tty` недоступен |
| `tools/roslyn.ts` | custom tool `roslyn` через V1-хелпер `tool()` из `@opencode-ai/plugin` | портирован: `plugins/roslyn.js` (`ctx.tool.transform`, тот же один тул `roslyn`; бинарь `roslyn-cli/` остался в `tools/`) |
| `commands/btw.md` | фронтматтер `agent: general`, `subtask: true` | актуальная версия — `commands/btw.md` (`agent: btw`, `subagent: true`) |
| `agents/*.md` | 13 файловых ролей с V1-frontmatter (`permission:`-map, `task`/`bash`/`write`/`list`/`todowrite`/`doom_loop`/`lsp`, `tools`) | портированы на V2 (`permissions`-массив, `subagent`/`shell`/`edit`); `list`/`todowrite`/`doom_loop`/`lsp` убраны как отсутствующие в V2; `name:` снят — см. §Ловушка ниже |
| `opencode.jsonc` | V1-блоки: `plugin`, `lsp` (roslyn-language-server), `agent.plan.permission`, top-level `permission` | портированы: `plugins`, `agents.plan.permissions`, top-level `permissions`; блок `lsp` **удалён** (V2 не запускает язык-серверы — семантика C# идёт через тул `roslyn`) |

## Важное про V2

- Обнаружение **серверных** плагинов: только immediate `.js`/`.ts`-файлы и каталоги-пакеты в `plugins/`.
- Обнаружение **CLI**-плагинов: то же, но `.tsx`-файл **не** берётся — нужен каталог-пакет с `package.json` → `exports["./tui"]`.
- V1-плагины в V2 не исполняются: нужен `export default { id, setup }`.

### Ловушка: `name:` в файловой роли отключает нативный `permissions`

Если во frontmatter агента есть поле `name:`, V2 обрабатывает файл по **legacy-пути** и нативный
`permissions`-массив **молча игнорируется** — роль остаётся вообще без своих правил (никакой ошибки
в лог не пишется). Нативный `permissions` применяется только без `name:`: id роли берётся из имени
файла, а `name` в API всё равно подставляется из id.

Проверено на `agents/planner.md`: с `name: planner` → 32 эффективных правила (своего `*: deny` нет),
без `name:` → 33 (правило на месте). Поэтому во всех мигрированных ролях `name:` снят; у 15
немигрированных он оставлен — там V1-`permission` и legacy-путь ещё работают, но при добавлении
`permissions` поле придётся снять.

### Как проверялась эквивалентность прав при переводе

V2 сам нормализует V1-frontmatter в V2, поэтому до правки снимается baseline эффективных прав
(`opencode api get /api/agent`), после — сравнивается с новым снимком. Ожидаемая дельта
перечисляется заранее; любое расхождение сверх неё = ошибка перевода. Для этой миграции ожидались
только удаления инертных в V2 действий: `todowrite` (7), `doom_loop` (7), `list` (5, дублируется
действием `read`), дубликат `edit` от V1 `edit`+`write` (2). Совпало ровно: 21 удаление, 0
добавлений, порядок правил не изменился.
