#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${DESKTOP_PACKAGE_LOG_DIR:-$ROOT_DIR/.logs}"
DESKTOP_BUNDLES="${DESKTOP_BUNDLES:-appimage,deb,rpm}"
DESKTOP_BUNDLES_SLUG="${DESKTOP_BUNDLES//,/--}"
LOG_FILE="${DESKTOP_PACKAGE_LOG_FILE:-$LOG_DIR/desktop-linux-package-${DESKTOP_BUNDLES_SLUG}.log}"

mkdir -p "$LOG_DIR"

cd "$ROOT_DIR"

bash ./scripts/bundle-linux-deps.sh
node ./scripts/verify-desktop-resources.mjs

set +e
NO_STRIP=1 pnpm --filter @elms/desktop tauri build --bundles "$DESKTOP_BUNDLES" --ci 2>&1 | tee "$LOG_FILE"
status=${PIPESTATUS[0]}
set -e

if [[ "$status" -ne 0 ]]; then
  echo "Linux desktop packaging failed. See $LOG_FILE for the captured linuxdeploy/Tauri output." >&2
  exit "$status"
fi

echo "Linux desktop packaging completed successfully."
