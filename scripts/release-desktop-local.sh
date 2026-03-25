#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGETS="${DESKTOP_RELEASE_TARGETS:-linux,windows}"
LINUX_BUNDLES="${DESKTOP_BUNDLES:-deb,rpm}"
VERIFY_BUNDLES="${VERIFY_LINUX_BUNDLES:-$LINUX_BUNDLES}"
RESTORE_LINUX_RESOURCES=0

has_target() {
  local needle="$1"
  [[ ",$TARGETS," == *",$needle,"* ]]
}

cleanup() {
  local status=$?

  if [[ "$RESTORE_LINUX_RESOURCES" == "1" ]]; then
    echo "Restoring Linux desktop runtime resources ..."
    if ! bash "$ROOT_DIR/scripts/bundle-linux-deps.sh" || ! node "$ROOT_DIR/scripts/verify-desktop-resources.mjs"; then
      echo "Failed to restore Linux desktop runtime resources after Windows packaging." >&2
      exit 1
    fi
  fi

  exit "$status"
}
trap cleanup EXIT

cd "$ROOT_DIR"

echo "Installing workspace dependencies with frozen lockfile ..."
pnpm install --frozen-lockfile

echo "Checking desktop packaging host prerequisites for targets: $TARGETS"
bash "$ROOT_DIR/scripts/check-desktop-packaging-host.sh" --targets "$TARGETS"

echo "Generating Prisma client ..."
pnpm prisma:generate

if has_target linux; then
  echo "Building Linux desktop installers for bundles: $LINUX_BUNDLES"
  DESKTOP_BUNDLES="$LINUX_BUNDLES" pnpm --filter @elms/desktop package:linux

  echo "Verifying Linux desktop installers for bundles: $VERIFY_BUNDLES"
  VERIFY_LINUX_BUNDLES="$VERIFY_BUNDLES" bash "$ROOT_DIR/scripts/verify-linux-packages.sh"
fi

if has_target windows; then
  if has_target linux; then
    RESTORE_LINUX_RESOURCES=1
  fi

  echo "Building and verifying Linux-hosted Windows desktop installer"
  pnpm --filter @elms/desktop package:windows:cross
fi

echo "Local desktop release flow completed for targets: $TARGETS"
