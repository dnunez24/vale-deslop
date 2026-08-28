#!/usr/bin/env bash
# git post-checkout args: $1 previous HEAD, $2 new HEAD, $3 is 1 for a branch
# checkout and 0 for a file checkout. Only branch checkouts can change
# mise.toml, package.json, or bun.lock, so file checkouts exit immediately.
#
# mise is optional tooling, not a hard dependency: a contributor without it on
# PATH still gets a working checkout, just without the refresh. Failures are
# reported but never fail the hook, because a checkout that aborts on a network
# blip is worse than a stale node_modules.
set -uo pipefail
[ "${3:-0}" = "1" ] || exit 0
command -v mise >/dev/null 2>&1 || exit 0
cd "$(git rev-parse --show-toplevel)" || exit 0
mise install || echo "post-checkout: 'mise install' failed; run it by hand" >&2
mise run deps || echo "post-checkout: 'mise run deps' failed; run it by hand" >&2
exit 0
