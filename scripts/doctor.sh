#!/usr/bin/env bash
# Preflight host check for zas-wrapper.
# Verifies every prerequisite needed by `moon run :install` + `moon run :up`.

set -uo pipefail

FAIL=0

red()    { printf '\033[31m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

# Compare semver-ish version strings. Returns 0 if $1 >= $2.
version_ge() {
    [ "$1" = "$(printf '%s\n%s' "$1" "$2" | sort -V | tail -n1)" ]
}

check_tool() {
    local name=$1 min=$2 version_cmd=$3 install_hint=$4
    local detected
    detected=$(eval "$version_cmd" 2>/dev/null || true)

    if [ -z "$detected" ]; then
        red "  ✗ $name: missing (need >= $min)"
        echo "    install: $install_hint"
        FAIL=$((FAIL+1))
        return
    fi

    if [ -n "$min" ] && ! version_ge "$detected" "$min"; then
        red "  ✗ $name: $detected (need >= $min)"
        echo "    upgrade: $install_hint"
        FAIL=$((FAIL+1))
        return
    fi

    green "  ✓ $name: $detected"
}

echo "==> checking host prerequisites"

check_tool "docker compose" "2.22.0" \
    "docker compose version --short 2>/dev/null | head -1" \
    "upgrade Docker Desktop or install OrbStack (https://orbstack.dev)"

check_tool "node" "22.0.0" \
    "node --version 2>/dev/null | sed 's/^v//'" \
    "brew install node@22 (or use mise/nvm)"

check_tool "python" "3.13.0" \
    "python3 --version 2>/dev/null | awk '{print \$2}'" \
    "brew install python@3.13 (or use uv python install 3.13)"

check_tool "uv" "0.5.0" \
    "uv --version 2>/dev/null | awk '{print \$2}'" \
    "curl -LsSf https://astral.sh/uv/install.sh | sh"

check_tool "moon" "1.30.0" \
    "moon --version 2>/dev/null | awk '{print \$2}'" \
    "brew install moonrepo/tap/moon (or curl -fsSL https://moonrepo.dev/install/moon.sh | bash)"

echo
if [ "$FAIL" -gt 0 ]; then
    red "==> $FAIL prerequisite(s) failed. Fix the items above before running moon run :up."
    exit 1
fi

green "==> all prerequisites satisfied — ready to run moon run :install and moon run :up"
