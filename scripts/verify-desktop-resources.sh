#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_DIR="$ROOT_DIR/apps/desktop/resources/node"
POSTGRES_DIR="$ROOT_DIR/apps/desktop/resources/postgres"

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
  local pkglibdir="$POSTGRES_DIR/lib64/pgsql"
  local sharedir="$POSTGRES_DIR/share/pgsql/timezonesets"

  if [[ ! -d "$pkglibdir" ]]; then
    echo "PostgreSQL resources are missing the compiled extension directory at $pkglibdir" >&2
    exit 1
  fi

  if [[ ! -d "$sharedir" ]]; then
    echo "PostgreSQL resources are missing the compiled shared-data directory at $sharedir" >&2
    exit 1
  fi
}

require_real_resources "$NODE_DIR" "Node.js"
require_real_resources "$POSTGRES_DIR" "PostgreSQL"
require_postgres_structure

echo "Desktop runtime resources verified."
