# Ported from PowerShell dev-aliases.ps1 (and helpers.ps1)

alias dn='dotnet'
alias docker='podman'
alias clip='clip.exe'
alias gs='git-status'
alias sln='load-solution'

# PowerShell-style `cd..`, `cd...`, ... (no space)
cd..() { cd ..; }
cd...() { cd ../..; }
cd....() { cd ../../..; }
cd.....() { cd ../../../..; }

git-status() {
    git status "$@"
}

# GitPush (gtpsh)
git-push() {
    git push "$@"
}
alias gtpsh='git-push'

# GitSwitch (gcd)
git-switch() {
    git switch "$@"
}
alias gcd='git-switch'

# GitCreateBranch (g-create-branch)
git-create-branch() {
    git switch -c "$1" && git push --set-upstream origin "$1"
}
alias g-create-branch='git-create-branch'

# MakeDirAndGo (mkdircd)
mkdircd() {
    mkdir -p "$1" && cd "$1" || return
}

# OpenLocation (fcd)
open-location() {
    local path
    path=$(command -v "$1") || return
    cd "$(dirname "$path")" || return
}
alias fcd='open-location'

load-solution() {
    local -a slns
    mapfile -t slns < <(find . -name '*.sln' 2>/dev/null)
    if [ "${#slns[@]}" -eq 1 ]; then
        explorer.exe "$(wslpath -w "${slns[0]}")" >/dev/null 2>&1 || echo "${slns[0]}"
    elif [ "${#slns[@]}" -eq 0 ]; then
        echo "no solution found" >&2
        return 1
    else
        printf '%s\n' "${slns[@]}"
    fi
}

# LocateParentFile: first matching file walking up from the current dir
_locate-parent-file() {
    local dir="$PWD" file
    while :; do
        file=$(find "$dir" -maxdepth 1 -name "$1" -print -quit 2>/dev/null)
        [ -n "$file" ] && {
            printf '%s\n' "$file"
            return 0
        }
        [ "$dir" = "/" ] && return 1
        dir=$(dirname "$dir")
    done
}

# GoToSolution / GoToProject
goto-solution() {
    local file
    file=$(_locate-parent-file '*.sln') || return
    cd "$(dirname "$file")" || return
}

goto-project() {
    local file
    file=$(_locate-parent-file '*.csproj') || return
    cd "$(dirname "$file")" || return
}

# Ported from the GoTo() function in Microsoft.PowerShell_profile.ps1
goto() {
    case "$1" in
        repos)
            cd /mnt/c/Users/user/source/repos || return
            ;;
        nextorm)
            cd /mnt/c/Users/user/source/repos/nextorm || return
            ;;
        ozon)
            cd /mnt/c/Users/user/source/repos/ozon || return
            ;;
        services)
            cd /mnt/c/Users/user/source/repos/ozon/metazone/core/services || return
            ;;
        sln)
            goto-solution
            ;;
        proj)
            goto-project
            ;;
        *)
            echo "goto: unknown alias '$1' (available: repos, nextorm, ozon, services, sln, proj)" >&2
            return 1
            ;;
    esac
}

# FindProcess($byPort)
find-process() {
    local port="$1"
    ss -ltnp 2>/dev/null | grep -F ":$port" || lsof -iTCP:"$port" -sTCP:LISTEN -Pn 2>/dev/null
}

# Ported from filter-package() (PowerShell find-package -> dotnet package search)
filter-package() {
    local query="${1//\"/}"
    query="${query//\^/}"
    dotnet package search "$query" --take 20
}

# opencode profiles (oc-ds определяется ниже как функция)
alias oc-gp='OPENCODE_CONFIG=$HOME/.config/opencode/profiles/gp.jsonc opencode'

# oc-ds — основной профиль (обычная работа + PDCA-скилл). Всегда новый сеанс:
# `-c` (продолжить последнюю) не используем —
# на пустом проекте он даёт "Unexpected server error" из placeholder sessionID "dummy".
# ZEN_FAILOVER_RULES: у free-модели (beam-free) свой дневной потолок; когда он выбран,
# сессия и привязка уезжают на `openai/gpt-6-luna`, а не на платный DeepSeek. Платные
# модели Go не затронуты: их цели задаёт ZEN_FAILOVER_MAP (argon/kimi → свои двойники).
# ZEN_FAILOVER_RESET_OPENCODE_GO: месячная квота Go выбирается целиком и восстанавливается
# не через неделю, а в дату продления подписки (Console: 17 ноября 18:24Z). Плагин знает
# только относительный срок, поэтому ставим 14d — с запасом вперёд: недобор хуже перебора,
# потому что по истечении срока привязка восстанавливается вслепую и сразу получает 429.
# Точный возврат даёт проба (раз в 5 минут): как только Go отвечает, она снимает деградацию
# сама, так что перебор в 14d ни на что не влияет.
# Снимаем устаревшие алиасы, если остались в открытом шелле: иначе
# при следующем source интерактивный bash разворачивает алиас в строке `oc-ds() {`
# и падает с "syntax error near unexpected token `('".
unalias oc-ds 2>/dev/null || true
oc-ds() {
  OPENCODE_CONFIG="$HOME/.config/opencode/profiles/deepseek.jsonc" \
    ZEN_FAILOVER_RULES='opencode-go=openai/gpt-6-luna;openai=opencode/<id>' \
    ZEN_FAILOVER_RESET_OPENCODE_GO=14d \
    opencode "$@"
}
# isolated sandbox for experiments (own config + sessions DB)
alias oc-sandbox='$HOME/sources/opencode-config-sandbox/bin/oc-sandbox'

# pdca-fleet: N независимых PDCA-циклов — ворктри + N сессий opencode (скрипт, не скилл)
alias oc-fleet='$HOME/.config/opencode/tools/pdca-fleet.sh'

# Branch-name completion for git-switch / gcd (same as `git switch`)
if ! declare -F __git_complete >/dev/null 2>&1; then
    [ -r /usr/share/bash-completion/completions/git ] && . /usr/share/bash-completion/completions/git
fi
if declare -F __git_complete >/dev/null 2>&1; then
    __git_complete gcd _git_switch
    __git_complete git-switch _git_switch
fi
