#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
stamp=".vale/.synced"
needs_sync() {
  [ -d .vale/styles/Microsoft ] || return 0
  [ -f "$stamp" ] || return 0
  [ -n "$(find Deslop repo-vocab -newer "$stamp" -print -quit)" ] && return 0
  return 1
}
if needs_sync; then
  vale sync
  mkdir -p .vale && touch "$stamp"
fi
exec vale "${@:-.}"
