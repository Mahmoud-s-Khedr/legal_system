#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: restore-postgres.sh <backup.sql.gz>" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/apps/web/docker-compose.prod.yml}"
POSTGRES_DB="${POSTGRES_DB:-elms_cloud}"
POSTGRES_USER="${POSTGRES_USER:-elms}"
BACKUP_PATH="$1"

if [[ ! -f "$BACKUP_PATH" ]]; then
  echo "backup not found: $BACKUP_PATH" >&2
  exit 1
fi

gunzip -c "$BACKUP_PATH" | docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" "$POSTGRES_DB"

printf 'Restored backup: %s\n' "$BACKUP_PATH"
