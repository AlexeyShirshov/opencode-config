#!/usr/bin/env bash
#
# pdca-fleet.sh — запуск НЕСКОЛЬКИХ независимых PDCA-циклов:
# одна задача = один git worktree = одна ветка = одна сессия opencode.
#
# В отличие от скилла `pdca-dotnet` (один цикл, один репозиторий), это НЕ цикл, а
# процедура запуска. Параллельные задачи должны быть РЕАЛЬНО независимы:
# никаких общих изменяемых файлов / общего контракта — иначе слияние даст
# конфликты, а интеграция — регрессии. Скрипт этого не проверяет.
#
# Подкоманды:
#   start   создать ворктри и запустить сессии
#   status  показать, что живо / что закоммичено
#   logs    tail логов (все или одну задачу)
#   merge   последовательно влить ветки в --into (без push)
#   clean   убрать ворктри/ветки/состояние
#
# См. `pdca-fleet.sh <cmd> --help` и `-h` по каждой подкоманде.

set -euo pipefail

PROG=${0##*/}
BASH_OK=0
if (( BASH_VERSINFO[0] > 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] >= 3) )); then BASH_OK=1; fi

die() { printf '%s: %s\n' "$PROG" "$*" >&2; exit 1; }
note() { printf '%s\n' "$*" >&2; }

# ------------------------------------------------------------------ usage ---

usage() {
  cat <<EOF
Usage: $PROG <start|status|logs|merge|clean> -r <repo> [options]

Общие:
  -r, --repo <path>      git-репозиторий (обязателен)
      --wt-base <dir>    где создавать ворктри [<repo>-worktrees рядом]
      --prefix <name>    префикс ветки [pdca]  ->  <prefix>/<task>
  -y, --yes              не спрашивать подтверждения на merge/clean
      --dry-run          только показать план (start)

start:
  -f, --tasks <file>     файл задач:   <name><TAB><task>   (# и пустые — пропуск)
  -n, --task <n=task>    задача: имя<:=|>текст>  (можно повторять)
  -b, --base <ref>       от чего ветвиться [текущая ветка]
      --into <branch>    куда потом сливать [= --base]
      --run-id <id>      id запуска [YYYYmmdd-HHMMSS]
  -p, --parallel <n>     сколько сессий одновременно [4]
      --stagger <sec>    пауза между запусками [2]
      --agent <name>     opencode-агент [build]
  -m, --model <p/m>      модель (provider/model) [профиль]
      --config <file>    OPENCODE_CONFIG (напр. profiles/deepseek.jsonc)
      --profile <name>   = --config ~/.config/opencode/profiles/<name>.jsonc
      --proxy            поднять zen-cache-proxy перед запуском
      --prelude <cmd>    выполнить команду один раз перед запуском (eval)
      --verify-cmd <cmd> после merge выполнить в <repo> (валидация слияния)
      --no-auto          не передавать --auto в opencode (будут вопросы)
      --allow-dirty      не требовать чистого дерева (worktree от HEAD!)
      --reuse            переиспользовать существующие ворктри/ветки

status / logs / merge / clean:
      --run-id <id>      какой запуск [последний в <wt-base>/.pdca-fleet]
  -n, --task <name>      (logs) только одна задача
EOF
}

# ------------------------------------------------------------- arguments ---

CMD=
REPO=
WT_BASE=
BASE=
INTO=
BRANCH_PREFIX=pdca
RUN_ID=
TASKS_FILE=
PARALLEL=4
STAGGER=2
AGENT=build
MODEL=
CONFIG_FILE=
PROFILE=
AUTO=1
DRY=0
YES=0
PROXY=0
PRELUDE=
VERIFY_CMD=
ALLOW_DIRTY=0
REUSE=0
ONLY_TASK=
NAMES=()
TASKS=()

add_task_arg() {
  local s=$1 name task
  if [[ $s == *$'\t'* ]]; then name=${s%%$'\t'*}; task=${s#*$'\t'}
  elif [[ $s == *'='* ]]; then name=${s%%=*}; task=${s#*=}
  elif [[ $s == *'|'* ]]; then name=${s%%|*}; task=${s#*|}
  elif [[ $s == *':'* ]]; then name=${s%%:*}; task=${s#*:}
  else die "задача не разобрана (нужно name<TAB>|name=name: текст): $s"
  fi
  name=${name//[[:space:]]/}
  task=$(printf '%s' "$task" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  [[ $name =~ ^[A-Za-z0-9._-]+$ ]] || die "недопустимое имя задачи: '$name'"
  [[ -n $task ]] || die "пустой текст задачи у '$name'"
  NAMES+=("$name"); TASKS+=("$task")
}

load_tasks_file() {
  local file=$1 line
  [[ -f $file ]] || die "нет файла задач: $file"
  while IFS= read -r line || [[ -n $line ]]; do
    line=${line%$'\r'}
    [[ -z ${line//[[:space:]]/} || $line == \#* ]] && continue
    if [[ $line == *$'\t'* ]]; then
      add_task_arg "${line%%$'\t'*}:${line#*$'\t'}"
    else
      add_task_arg "$line"
    fi
  done < "$file"
}

while (($#)); do
  case "$1" in
    start|status|logs|merge|clean)
      [[ -z $CMD ]] || die "лишний аргумент: $1"; CMD=$1; shift ;;
    -r|--repo)        REPO=$2; shift 2 ;;
    --wt-base)        WT_BASE=$2; shift 2 ;;
    --prefix)         BRANCH_PREFIX=$2; shift 2 ;;
    -f|--tasks)       TASKS_FILE=$2; shift 2 ;;
    -n|--task)        if [[ $CMD == logs ]]; then ONLY_TASK=$2; else add_task_arg "$2"; fi; shift 2 ;;
    -b|--base)        BASE=$2; shift 2 ;;
    --into)           INTO=$2; shift 2 ;;
    --run-id)         RUN_ID=$2; shift 2 ;;
    -p|--parallel)    PARALLEL=$2; shift 2 ;;
    --stagger)        STAGGER=$2; shift 2 ;;
    --agent)          AGENT=$2; shift 2 ;;
    -m|--model)       MODEL=$2; shift 2 ;;
    --config)         CONFIG_FILE=$2; shift 2 ;;
    --profile)        PROFILE=$2; shift 2 ;;
    --verify-cmd)     VERIFY_CMD=$2; shift 2 ;;
    --prelude)        PRELUDE=$2; shift 2 ;;
    --proxy)          PROXY=1; shift ;;
    --no-auto)        AUTO=0; shift ;;
    --allow-dirty)    ALLOW_DIRTY=1; shift ;;
    --reuse)          REUSE=1; shift ;;
    --dry-run)        DRY=1; shift ;;
    -y|--yes)         YES=1; shift ;;
    -h|--help)        usage; exit 0 ;;
    *) die "неизвестный аргумент: $1 (см. --help)" ;;
  esac
done

[[ $BASH_OK == 1 ]] || die "нужен bash >= 4.3 (есть ${BASH_VERSION})"
[[ -n $CMD ]] || { usage; exit 1; }
[[ $CMD == start || -n $TASKS_FILE || ${#NAMES[@]} -gt 0 || -n $REPO ]] || { usage; exit 1; }

if [[ -n $CONFIG_FILE ]]; then
  CONFIG_RESOLVED=$CONFIG_FILE
elif [[ -n $PROFILE ]]; then
  CONFIG_RESOLVED="$HOME/.config/opencode/profiles/${PROFILE}.jsonc"
else
  CONFIG_RESOLVED=${OPENCODE_CONFIG:-}
fi

OC_BIN=$(command -v opencode || true)
[[ -n $OC_BIN ]] || [[ $CMD == status || $CMD == logs || $CMD == merge || $CMD == clean ]] || \
  die "opencode не найден в PATH"

# --------------------------------------------------------------- resolve ---

resolve() {
  [[ -n $REPO ]] || die "нужен -r/--repo"
  [[ -d $REPO ]] || die "нет каталога: $REPO"
  REPO=$(cd "$REPO" && pwd -P)
  git -C "$REPO" rev-parse --git-dir >/dev/null 2>&1 || die "не git-репозиторий: $REPO"
  [[ -n $WT_BASE ]] || WT_BASE="$(dirname "$REPO")/$(basename "$REPO")-worktrees"
  [[ -n $BASE ]] || BASE=$(git -C "$REPO" rev-parse --abbrev-ref HEAD)
  [[ -n $INTO ]] || INTO=$BASE
  STATE_ROOT="$WT_BASE/.pdca-fleet"
}

resolve_run() {
  resolve
  if [[ -z $RUN_ID ]]; then
    [[ -d $STATE_ROOT ]] || die "нет запусков в $STATE_ROOT"
    RUN_ID=$(ls -1 "$STATE_ROOT" 2>/dev/null | sort | tail -n1)
    [[ -n $RUN_ID ]] || die "нет запусков в $STATE_ROOT"
  fi
  RUN_DIR="$STATE_ROOT/$RUN_ID"
  TASKS_TSV="$RUN_DIR/tasks.tsv"
  [[ -f $TASKS_TSV ]] || die "нет состояния запуска: $TASKS_TSV"
  # meta перекрывает значения по умолчанию
  local k v
  while IFS='=' read -r k v; do
    case "$k" in
      REPO) REPO=$v ;; BASE) BASE=$v ;; INTO) INTO=$v ;;
      WT_BASE) WT_BASE=$v ;; PREFIX) BRANCH_PREFIX=$v ;;
    esac
  done < "$RUN_DIR/meta"
}

confirm() {
  ((YES)) && return 0
  [[ -t 0 ]] || die "$1 — нет tty, добавь -y"
  local a; read -r -p "$1 [y/N] " a
  [[ $a == y || $a == Y || $a == yes ]]
}

ensure_clean_repo() {
  local dirty; dirty=$(git -C "$REPO" status --porcelain)
  if [[ -n $dirty ]]; then
    if ((ALLOW_DIRTY)); then
      note "ВНИМАНИЕ: дерево $REPO грязное — незакоммиченное НЕ попадёт в ворктри (worktree от $BASE)."
    else
      die "дерево $REPO не чистое: закоммить/спрячь или добавь --allow-dirty"
    fi
  fi
}

start_proxy() {
  local port=${OC_ZEN_PROXY_PORT:-8787} script="$HOME/.config/opencode/tools/zen-cache-proxy.mjs"
  [[ -f $script ]] || { note "прокси не найден: $script — пропускаю"; return 0; }
  if curl -fsS -o /dev/null --max-time 1 "http://127.0.0.1:$port/__health"; then
    note "прокси уже поднят на :$port"; return 0
  fi
  local bun; bun=$(command -v bun || echo "$HOME/.bun/bin/bun")
  [[ -x $bun ]] || die "bun не найден (нужен для zen-cache-proxy)"
  PORT=$port REWRITE=ttl nohup "$bun" "$script" \
    >>"$HOME/.local/share/opencode/zen-cache-proxy.log" 2>&1 &
  disown 2>/dev/null || true
  local i
  for i in $(seq 1 30); do
    curl -fsS -o /dev/null --max-time 1 "http://127.0.0.1:$port/__health" && { note "прокси поднят :$port"; return 0; }
    sleep 0.1
  done
  die "прокси не поднялся на :$port (лог: ~/.local/share/opencode/zen-cache-proxy.log)"
}

build_prompt() { # name wt branch task
  cat <<EOF
Проведи следующую задачу по циклу PDCA. Сначала загрузи скилл \`pdca-dotnet\` (инструмент skill, name: pdca-dotnet)
и следуй ему в АВТОНОМНОМ режиме (раздел «Автономный режим» в скилле): PLAN -> DO -> CHECK -> ACT
самостоятельно, без вопросов к пользователю. Вопрос/эскалация — только если цикл невыполним
или после 3 неудачных попыток.

Задача: $4

Ограничения (обязательны):
- работай ТОЛЬКО в этом ворктри: $2
- не трогай основной репозиторий и другие ворктри; никаких \`git push\`
- коммить в текущую ветку этой ворктри: $3
- по завершении ACT оставь статус-файл и краткий итоговый отчёт (что сделано, файлы, как проверено, риски)
EOF
}

# ------------------------------------------------------------------ start ---

cmd_start() {
  resolve
  [[ -n $TASKS_FILE ]] && load_tasks_file "$TASKS_FILE"
  ((${#NAMES[@]} > 0)) || die "нет задач: -f <file> или -n <name=task>"

  # уникальность имён
  local i j
  for ((i=0; i<${#NAMES[@]}; i++)); do
    for ((j=i+1; j<${#NAMES[@]}; j++)); do
      [[ ${NAMES[i]} == "${NAMES[j]}" ]] && die "дубликат имени задачи: ${NAMES[i]}"
    done
  done

  RUN_ID=${RUN_ID:-$(date +%Y%m%d-%H%M%S)}
  RUN_DIR="$STATE_ROOT/$RUN_ID"
  TASKS_TSV="$RUN_DIR/tasks.tsv"
  [[ -e $RUN_DIR ]] && die "запуск уже существует: $RUN_DIR"

  note "repo=$REPO"
  note "base=$BASE   into=$INTO   wt-base=$WT_BASE"
  note "run=$RUN_ID   parallel=$PARALLEL   stagger=${STAGGER}s   agent=$AGENT   auto=$AUTO"

  # план
  for ((i=0; i<${#NAMES[@]}; i++)); do
    printf '  %-16s -> %s\n' "${NAMES[i]}" "$WT_BASE/${NAMES[i]}  (branch ${BRANCH_PREFIX}/${NAMES[i]})" >&2
  done

  if ((DRY)); then note "dry-run: ничего не создаю"; return 0; fi
  ensure_clean_repo
  ((PROXY)) && start_proxy
  [[ -n $PRELUDE ]] && { note "prelude: $PRELUDE"; eval "$PRELUDE"; }

  mkdir -p "$RUN_DIR/capture"
  {
    printf 'REPO=%s\nBASE=%s\nINTO=%s\nWT_BASE=%s\nPREFIX=%s\n' \
      "$REPO" "$BASE" "$INTO" "$WT_BASE" "$BRANCH_PREFIX"
  } > "$RUN_DIR/meta"

  # worktrees
  for ((i=0; i<${#NAMES[@]}; i++)); do
    local name=${NAMES[i]} wt="$WT_BASE/${NAMES[i]}" branch="${BRANCH_PREFIX}/${NAMES[i]}"
    if [[ -d $wt ]] || git -C "$REPO" show-ref --verify --quiet "refs/heads/$branch"; then
      ((REUSE)) || die "уже существует '$wt' или ветка '$branch' (нужен --reuse)"
      note "reuse: $name"
    else
      git -C "$REPO" worktree add -b "$branch" "$wt" "$BASE" >&2
    fi
    printf '%s\t%s\t%s\t%s\n' "$name" "$branch" "$wt" "${TASKS[i]}" >> "$TASKS_TSV"
  done

  # запуск с ограничением параллелизма
  local running=0
  for ((i=0; i<${#NAMES[@]}; i++)); do
    launch_one "${NAMES[i]}" "${TASKS[i]}"
    running=$((running+1))
    if ((running >= PARALLEL)); then
      wait -n 2>/dev/null || true
      running=$((running-1))
    fi
    ((STAGGER > 0)) && sleep "$STAGGER"
  done
  note "все ${#NAMES[@]} сессий запущены; жду завершения (Ctrl-C — сессии продолжат работать)…"
  wait || true

  note ""
  note "Готово. Статус:  $PROG status -r '$REPO' --run-id $RUN_ID"
  note "Логи:           $PROG logs   -r '$REPO' --run-id $RUN_ID [-n <task>]"
  note "Слияние:        $PROG merge  -r '$REPO' --run-id $RUN_ID"
}

launch_one() {
  local name=$1 task=$2 wt branch log rc pid msg
  wt=$(awk -F'\t' -v n="$name" '$1==n{print $3}' "$TASKS_TSV")
  branch=$(awk -F'\t' -v n="$name" '$1==n{print $2}' "$TASKS_TSV")
  log="$RUN_DIR/$name.log"; rc="$RUN_DIR/$name.rc"; pid="$RUN_DIR/$name.pid"
  rm -f "$rc" "$pid"
  msg=$(build_prompt "$name" "$wt" "$branch" "$task")

  (
    set +e
    [[ -n $CONFIG_RESOLVED ]] && export OPENCODE_CONFIG="$CONFIG_RESOLVED"
    export PDCA_FLEET_RUN="$RUN_ID" PDCA_FLEET_NAME="$name"
    export CAPTURE_DIR="$RUN_DIR/capture/$name"
    local -a a=(run --dir "$wt" --title "pdca-fleet/$RUN_ID/$name")
    ((AUTO)) && a+=(--auto)
    [[ -n $AGENT ]] && a+=(--agent "$AGENT")
    [[ -n $MODEL ]] && a+=(--model "$MODEL")
    a+=("$msg")
    "$OC_BIN" "${a[@]}"
    echo $? > "$rc"
  ) >"$log" 2>&1 &
  echo $! > "$pid"
  note "  запущен: $name (pid $(cat "$pid")) -> $log"
}

# ----------------------------------------------------------------- status ---

tail_log() { # name bytes
  local f="$RUN_DIR/$1.log"
  [[ -f $f ]] || { printf '    (нет лога)\n'; return; }
  tail -c "${2:-600}" "$f" | sed 's/^/    | /'
}

cmd_status() {
  resolve_run
  printf 'run  %s\nrepo %s\ninto %s\n\n' "$RUN_ID" "$REPO" "$INTO"
  printf '%-16s %-10s %-8s %-9s %s\n' TASK STATE RC AHEAD WORKTREE
  each_task_show
}

each_task_show() {
  local name branch wt task state rc="" ahead dirty pid
  while IFS=$'\t' read -r name branch wt task; do
    [[ -n $name ]] || continue
    if [[ -f $RUN_DIR/$name.rc ]]; then
      rc=$(cat "$RUN_DIR/$name.rc"); state="done"
    elif [[ -f $RUN_DIR/$name.pid ]] && kill -0 "$(cat "$RUN_DIR/$name.pid")" 2>/dev/null; then
      state="running"
    else
      state="dead?"; rc="-"
    fi
    ahead=$(git -C "$wt" rev-list --count "$BASE..$branch" 2>/dev/null || echo '?')
    dirty=$(git -C "$wt" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    printf '%-16s %-10s %-8s %-9s %s (+%s dirty)\n' "$name" "$state" "$rc" "$ahead" "$wt" "$dirty"
  done < "$TASKS_TSV"
}

# ------------------------------------------------------------------- logs ---

cmd_logs() {
  resolve_run
  if [[ -n $ONLY_TASK ]]; then
    tail -f "$RUN_DIR/$ONLY_TASK.log"
  else
    each_task_logs
  fi
}

each_task_logs() {
  local name branch wt task
  while IFS=$'\t' read -r name branch wt task; do
    [[ -n $name ]] || continue
    printf '\n===== %s (%s) =====\n' "$name" "$branch"
    tail_log "$name" 2000
  done < "$TASKS_TSV"
}

# ------------------------------------------------------------------ merge ---

cmd_merge() {
  resolve_run
  local dirty; dirty=$(git -C "$REPO" status --porcelain)
  [[ -z $dirty ]] || die "дерево $REPO не чистое — сначала приведи его в порядок"

  local n; n=$(wc -l < "$TASKS_TSV" | tr -d ' ')
  confirm "Слить $n веток в '$INTO' последовательно (без push)?" || { note "отменено"; return 0; }

  git -C "$REPO" show-ref --verify --quiet "refs/heads/$INTO" || die "нет локальной ветки '$INTO'"
  git -C "$REPO" switch "$INTO"

  local merged=() name branch wt task
  while IFS=$'\t' read -r name branch wt task; do
    [[ -n $name ]] || continue
    if git -C "$REPO" merge-base --is-ancestor "$branch" "$INTO" 2>/dev/null; then
      note "skip: $branch уже в $INTO"; merged+=("$name"); continue
    fi
    if git -C "$REPO" merge --no-ff -m "merge(pdca-fleet/$RUN_ID): $name" "$branch"; then
      note "ok: $name ($branch)"; merged+=("$name")
    else
      note "КОНФЛИКТ при слиянии '$branch' в '$INTO':"
      git -C "$REPO" status --short >&2
      die "остановлено на '$name'; разреши вручную и запусти merge снова (skip уберёт уже слитое)"
    fi
  done < "$TASKS_TSV"

  if [[ -n $VERIFY_CMD ]]; then
    note "verify: $VERIFY_CMD"
    ( cd "$REPO" && eval "$VERIFY_CMD" ) || die "verification упал — репозиторий в '$INTO', разбирайся вручную"
    note "verify: ok"
  else
    note "ВНИМАНИЕ: --verify-cmd не задан. Прогони проверку интеграции после слияния (тесты/сборка)."
  fi
  note "Слито: ${merged[*]:-}"
}

# ------------------------------------------------------------------ clean ---

cmd_clean() {
  resolve_run
  confirm "Убрать ворктри и ветки запуска $RUN_ID?" || { note "отменено"; return 0; }
  local name branch wt task
  while IFS=$'\t' read -r name branch wt task; do
    [[ -n $name ]] || continue
    git -C "$REPO" worktree remove --force "$wt" 2>/dev/null || note "ворктри не убран: $wt"
    if git -C "$REPO" merge-base --is-ancestor "$branch" "$INTO" 2>/dev/null; then
      git -C "$REPO" branch -d "$branch" 2>/dev/null || true
    elif ((YES)); then
      git -C "$REPO" branch -D "$branch" 2>/dev/null || true
    else
      note "ветка НЕ слита, оставляю: $branch (для удаления — с -y)"
    fi
  done < "$TASKS_TSV"
  git -C "$REPO" worktree prune
  rm -rf "$RUN_DIR"
  note "состояние $RUN_DIR удалено"
}

# ---------------------------------------------------------------- dispatch ---

case "$CMD" in
  start)  cmd_start ;;
  status) cmd_status ;;
  logs)   cmd_logs ;;
  merge)  cmd_merge ;;
  clean)  cmd_clean ;;
  *)      usage; exit 1 ;;
esac
