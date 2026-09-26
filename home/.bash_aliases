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

# opencode profiles
alias oc-ds='OPENCODE_CONFIG=$HOME/.config/opencode/profiles/deepseek.jsonc opencode -c'
alias oc-gp='OPENCODE_CONFIG=$HOME/.config/opencode/profiles/gp.jsonc opencode -c'
# isolated sandbox for experiments (own config + sessions DB)
alias oc-sandbox='$HOME/sources/opencode-config-sandbox/bin/oc-sandbox'

# Branch-name completion for git-switch / gcd (same as `git switch`)
if ! declare -F __git_complete >/dev/null 2>&1; then
    [ -r /usr/share/bash-completion/completions/git ] && . /usr/share/bash-completion/completions/git
fi
if declare -F __git_complete >/dev/null 2>&1; then
    __git_complete gcd _git_switch
    __git_complete git-switch _git_switch
fi
