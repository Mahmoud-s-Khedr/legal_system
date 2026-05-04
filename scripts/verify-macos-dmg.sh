#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: bash scripts/verify-macos-dmg.sh <dmg-path>" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DMG_PATH="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
MOUNT_ROOT="$(mktemp -d -t elms-dmg-verify-XXXXXX)"
MOUNT_POINT="$MOUNT_ROOT/mount"

cleanup() {
  # Unconditionally attempt to detach. 
  # -force ensures it drops even if the Node script left a lingering file handle.
  hdiutil detach "$MOUNT_POINT" -quiet -force >/dev/null 2>&1 || true

  rm -rf "$MOUNT_ROOT"
}

trap cleanup EXIT

mkdir -p "$MOUNT_POINT"

echo "Mounting DMG: $DMG_PATH"
hdiutil attach "$DMG_PATH" -mountpoint "$MOUNT_POINT" -nobrowse -readonly >/dev/null

node "$ROOT_DIR/scripts/verify-packaged-desktop-tree.mjs" --search-root "$MOUNT_POINT"

echo "macOS DMG payload verified."
