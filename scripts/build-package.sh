#!/usr/bin/env bash
# Builds the distributable Vale package. The archive is what users install, so
# the license travels inside it -- same reason vale-cli/Microsoft copies LICENSE
# into its style folder before zipping.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="${1:-$root/dist}"
build="$(mktemp -d)"
trap 'rm -rf "$build"' EXIT
mkdir -p "$out"
rm -f "$out/Deslop.zip"
cp -R "$root/Deslop" "$build/Deslop"
cp "$root/LICENSE" "$build/Deslop/LICENSE"
( cd "$build" && zip -qr "$out/Deslop.zip" Deslop -x "*.DS_Store" )
echo "$out/Deslop.zip"
