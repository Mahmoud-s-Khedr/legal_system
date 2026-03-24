#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${DESKTOP_VERIFY_LOG_DIR:-$ROOT_DIR/.logs}"
LOG_FILE="$LOG_DIR/desktop-runtime-smoke.log"
HEALTH_URL="${DESKTOP_HEALTH_URL:-http://127.0.0.1:7854/api/health}"
POSTGRES_PORT="${DESKTOP_POSTGRES_PORT:-5433}"
TIMEOUT_SECONDS="${DESKTOP_VERIFY_TIMEOUT_SECONDS:-180}"

mkdir -p "$LOG_DIR"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required" >&2
  exit 1
fi

if ! command -v pg_isready >/dev/null 2>&1; then
  echo "pg_isready is required (install PostgreSQL client/server binaries)" >&2
  exit 1
fi

cd "$ROOT_DIR"

pnpm --filter @elms/desktop tauri dev --no-watch >"$LOG_FILE" 2>&1 &
TAURI_PID=$!

cleanup() {
  if kill -0 "$TAURI_PID" >/dev/null 2>&1; then
    kill "$TAURI_PID" >/dev/null 2>&1 || true
    wait "$TAURI_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

end_time=$((SECONDS + TIMEOUT_SECONDS))
backend_ready=false

while (( SECONDS < end_time )); do
  if ! kill -0 "$TAURI_PID" >/dev/null 2>&1; then
    echo "Desktop shell exited before becoming healthy. See $LOG_FILE" >&2
    tail -n 120 "$LOG_FILE" >&2 || true
    exit 1
  fi

  if curl --silent --fail "$HEALTH_URL" | grep -q '"ok":true'; then
    backend_ready=true
    break
  fi

  sleep 2
done

if [[ "$backend_ready" != "true" ]]; then
  echo "Timed out waiting for backend health at $HEALTH_URL. See $LOG_FILE" >&2
  tail -n 120 "$LOG_FILE" >&2 || true
  exit 1
fi

if ! pg_isready -h 127.0.0.1 -p "$POSTGRES_PORT" -U elms >/dev/null 2>&1; then
  echo "Embedded PostgreSQL is not ready on port $POSTGRES_PORT. See $LOG_FILE" >&2
  tail -n 120 "$LOG_FILE" >&2 || true
  exit 1
fi

echo "Desktop runtime verification passed: backend and embedded PostgreSQL are healthy."
