#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/apps/web/docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/.backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
POSTGRES_DB="${POSTGRES_DB:-elms_cloud}"
POSTGRES_USER="${POSTGRES_USER:-elms}"
LOCAL_RETENTION_DAYS="${LOCAL_RETENTION_DAYS:-7}"

mkdir -p "$BACKUP_DIR"

DUMP_PATH="$BACKUP_DIR/elms-${TIMESTAMP}.sql.gz"

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$DUMP_PATH"

find "$BACKUP_DIR" -type f -name 'elms-*.sql.gz' -mtime +"$LOCAL_RETENTION_DAYS" -delete

if [[ -n "${BACKUP_UPLOAD_COMMAND:-}" ]]; then
  eval "$BACKUP_UPLOAD_COMMAND \"$DUMP_PATH\""
fi

printf 'Created backup: %s\n' "$DUMP_PATH"
