# oc-report

Сводка по сессиям OpenCode из `opencode.db` в двух вариантах с одинаковым выводом:

- `oc-report.cs` — single-file app (.NET 10 + nextorm 1.0.9-rc4, типизированные запросы);
- `oc-report.py` — тот же отчёт на stdlib `sqlite3` + `json`.

## Запуск

```bash
python3 config/tools/oc-report/oc-report.py 3                 # executor за 3 дня
dotnet run config/tools/oc-report/oc-report.cs -- 3           # то же на nextorm

python3 config/tools/oc-report/oc-report.py 1 --all           # все агенты за сутки
python3 config/tools/oc-report/oc-report.py 7 --agent coder   # конкретный агент
python3 config/tools/oc-report/oc-report.py 2 --db /path/opencode.db
```

Аргументы одинаковые у обоих:

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

- соединение read-only (`Mode=ReadOnly` / `?mode=ro`) — оба скрипта ничего не пишут;
- `model` в базе хранится как JSON (`{"id":"beam-free","providerID":"opencode-go"}`), поэтому ключ
  группировки извлекается через `json_extract(model,'$.providerID')` / `'$.id'`; `group by model`
  напрямую сравнивал бы текст и разносил одну модель на несколько групп (другой порядок ключей,
  лишний `variant`). В C# это `SqlFunctions.Sqlite.json_extract<T>` (JSON1 — провайдер-специфичная
  поверхность, в переносимом `SqlFunctions.Sql` её намеренно нет), в Python — обычный SQL;
- ошибки ищутся по `data LIKE '%"error"%'` и разбираются `System.Text.Json` / `json`.

## Производительность

Замер: 3 дня, `agent=pdca-executor` (188–189 сессий, 335 сообщений с `error`), 3 прогона каждого
варианта, медиана; машина — WSL2, Ryzen 7 5800HS, .NET SDK 10.0.401.

| вариант | время | RSS | что входит |
| --- | --- | --- | --- |
| `python3 oc-report.py 3` | **0.14 s** | 22 MB | интерпретатор + запросы + разбор JSON |
| `dotnet oc-report.dll 3` | 0.41 s | 72 MB | рантайм + JIT + nextorm, без сборки |
| `dotnet run oc-report.cs -- 3` | 0.61 s | 87 MB | плюс проверка инкрементальной сборки |
| `dotnet publish` (AOT) | падает | — | nextorm требует `MetadataToken`, NativeAOT его не даёт (`InvalidOperationException: There is no metadata token available for the given member`) |

То же на большем окне (7 дней, все агенты — данных примерно вдвое больше):

| вариант | время |
| --- | --- |
| `python3 oc-report.py 7 --all` | 0.32 s |
| `dotnet oc-report.dll 7 --all` | 0.62 s |

Сам SQL стоит ~0.12 s, и почти всё в нём — выборка сообщений с `error`:

```
connect=0.1ms  agg=4.5ms  sessions=2.7ms  messages=110.4ms  total=117.6ms
```

То есть разница между вариантами — это старт рантайма: Python ~20 ms, .NET ~290 ms (JIT + разбор
выражений nextorm). На окне в 3 дня обе версии упираются в один и тот же запрос к
`session_message`, а не в язык.

AOT для nextorm сейчас неприменим: trim-анализ даёт IL2026/IL3050 на `System.Linq.Expressions`, и
собранный бинарь падает на первом же запросе. Если понадобится быстрый запуск — вариант
`dotnet oc-report.dll` (0.41 s) или Python.
