#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCKFILE="$ROOT_DIR/pnpm-lock.yaml"
TMP_DIR="$(mktemp -d -t elms-lockfile-XXXXXX)"
BACKUP_LOCKFILE="$TMP_DIR/pnpm-lock.yaml"

cleanup() {
  if [[ -f "$BACKUP_LOCKFILE" ]]; then
    cp "$BACKUP_LOCKFILE" "$LOCKFILE"
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cp "$LOCKFILE" "$BACKUP_LOCKFILE"

cd "$ROOT_DIR"
pnpm install --lockfile-only --ignore-scripts >/dev/null

if ! cmp -s "$BACKUP_LOCKFILE" "$LOCKFILE"; then
  echo "pnpm-lock.yaml is out of sync with package manifests. Run 'pnpm install' and commit the updated lockfile." >&2
  diff -u "$BACKUP_LOCKFILE" "$LOCKFILE" || true
  exit 1
fi

echo "pnpm-lock.yaml matches the current manifests."
