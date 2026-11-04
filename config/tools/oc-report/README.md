# oc-report

Сводка по сессиям OpenCode из `opencode.db` — single-file app (.NET 10 + nextorm 1.0.9-rc4).
Раньше такие разборы писались питоновскими скриптами; этот вариант читает ту же базу
типизированными запросами nextorm, без raw SQL.

## Запуск

```bash
dotnet run config/tools/oc-report/oc-report.cs -- 3                 # executor за 3 дня
dotnet run config/tools/oc-report/oc-report.cs -- 1 --all           # все агенты за сутки
dotnet run config/tools/oc-report/oc-report.cs -- 7 --agent coder   # конкретный агент
dotnet run config/tools/oc-report/oc-report.cs -- 2 --db /path/opencode.db
```

Аргументы:

| аргумент | смысл |
| --- | --- |
| `<days>` | окно в днях, по умолчанию 3 |
| `--agent <name>` | агент, по умолчанию `pdca-executor` |
| `--all` | без фильтра по агенту |
| `--db <path>` | путь к `opencode.db`; иначе `$OPENCODE_DB` или `~/.local/share/opencode/opencode.db` |

## Что показывает

- сессии по моделям: количество, `succeeded`/`failed`/остальные, вход, выход, cache read, стоимость;
- исходы и список не-`succeeded` сессий;
- ошибки провайдеров из `session_message.data` (JSON) с разбивкой по типу и модели.

## Как устроено

- `#:package nextorm@1.0.9-rc4` + `#:package nextorm.sqlite@1.0.9-rc4` — пакеты тянутся из nuget.org,
  `.csproj` нет;
- соединение read-only (`Mode = SqliteOpenMode.ReadOnly`, `Pooling = false`) — скрипт ничего не пишет;
- сущности — интерфейсы с `[SqlTable]`/`[Column]` над `session_v2` и `session_message`;
- `model` в базе хранится как JSON (`{"id":"beam-free","providerID":"opencode-go"}`), поэтому ключ
  группировки извлекается через `SqlFunctions.Sqlite.json_extract<T>(s.Model, "$.providerID")` /
  `"$.id"`; `group by model` напрямую сравнивал бы текст и разносил одну модель на несколько групп
  (другой порядок ключей, лишний `variant`). JSON1 — это **провайдер-специфичная** поверхность
  (`SqlFunctions.Sqlite`); в переносимом `SqlFunctions.Sql` её намеренно нет.
