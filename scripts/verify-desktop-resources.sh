#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_DIR="$ROOT_DIR/apps/desktop/resources/node"
POSTGRES_DIR="$ROOT_DIR/apps/desktop/resources/postgres"
POSTGRES_LAYOUT_FILE="$POSTGRES_DIR/.layout.env"

is_safe_relative_path() {
  local path="$1"

  [[ -n "$path" ]] || return 1
  [[ "$path" != /* ]] || return 1
  [[ "$path" != "." ]] || return 1
  [[ "$path" != *"/.."* ]] || return 1
  [[ "$path" != ".."* ]] || return 1
  [[ "$path" != *"../"* ]] || return 1
  [[ "$path" != *"/./"* ]] || return 1
  [[ "$path" != "./"* ]] || return 1
  [[ "$path" != *"/." ]] || return 1
}

require_real_resources() {
  local dir="$1"
  local label="$2"

  if [[ -f "$dir/placeholder" ]]; then
    echo "$label resources still contain the placeholder marker at $dir/placeholder" >&2
    exit 1
  fi

  local real_files
  real_files="$(find "$dir" -type f ! -name '.gitkeep' | wc -l | tr -d ' ')"
  if [[ "$real_files" -eq 0 ]]; then
    echo "$label resources are empty: expected bundled runtime files under $dir" >&2
    exit 1
  fi
}

require_postgres_structure() {
  [[ -f "$POSTGRES_LAYOUT_FILE" ]] || {
    echo "PostgreSQL resources are missing the layout manifest at $POSTGRES_LAYOUT_FILE" >&2
    exit 1
  }

  # shellcheck disable=SC1090
  source "$POSTGRES_LAYOUT_FILE"

  resolve_layout_dir() {
    local relative="$1"
    local label="$2"
    local resolved

    if ! is_safe_relative_path "$relative"; then
      echo "PostgreSQL layout manifest contains an unsafe $label path: $relative" >&2
      exit 1
    fi

    resolved="$POSTGRES_DIR/$relative"
    if [[ "$resolved" != "$POSTGRES_DIR"/* ]]; then
      echo "PostgreSQL layout manifest resolves $label outside the bundle root: $resolved" >&2
      exit 1
    fi

    printf '%s\n' "$resolved"
  }

  local bindir
  local sharedir
  local pkglibdir
  local runtimelibdir
  bindir="$(resolve_layout_dir "${POSTGRES_BIN_DIR:-}" "POSTGRES_BIN_DIR")"
  sharedir="$(resolve_layout_dir "${POSTGRES_SHARE_DIR:-}" "POSTGRES_SHARE_DIR")"
  pkglibdir="$(resolve_layout_dir "${POSTGRES_PKGLIB_DIR:-}" "POSTGRES_PKGLIB_DIR")"
  runtimelibdir="$(resolve_layout_dir "${POSTGRES_RUNTIME_LIB_DIR:-}" "POSTGRES_RUNTIME_LIB_DIR")"

  if [[ ! -d "$bindir" ]]; then
    echo "PostgreSQL resources are missing the bundled binary directory at $bindir" >&2
    exit 1
  fi

  if [[ ! -d "$pkglibdir" ]]; then
    echo "PostgreSQL resources are missing the compiled extension directory at $pkglibdir" >&2
    exit 1
  fi

  if [[ ! -d "$sharedir/timezonesets" ]]; then
    echo "PostgreSQL resources are missing the compiled shared-data directory at $sharedir/timezonesets" >&2
    exit 1
  fi

  local pkglib_files
  pkglib_files="$(find "$pkglibdir" -mindepth 1 -maxdepth 1 -type f | wc -l | tr -d ' ')"
  if [[ "$pkglib_files" -eq 0 ]]; then
    echo "PostgreSQL resources contain an empty compiled extension directory at $pkglibdir" >&2
    exit 1
  fi

  local runtime_lib_files
  runtime_lib_files="$(find "$runtimelibdir" -mindepth 1 -maxdepth 1 -type f | wc -l | tr -d ' ')"
  if [[ "$runtime_lib_files" -eq 0 ]]; then
    echo "PostgreSQL resources contain an empty runtime library directory at $runtimelibdir" >&2
    exit 1
  fi
}

require_real_resources "$NODE_DIR" "Node.js"
require_real_resources "$POSTGRES_DIR" "PostgreSQL"
require_postgres_structure

echo "Desktop runtime resources verified."
