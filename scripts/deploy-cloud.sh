#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/apps/web/docker-compose.prod.yml}"
BACKEND_IMAGE="${BACKEND_IMAGE:-elms-backend:local}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-elms-frontend:local}"
BUILD_LOCAL_IMAGES="${BUILD_LOCAL_IMAGES:-1}"

cd "$ROOT_DIR"

if [[ "$BUILD_LOCAL_IMAGES" == "1" ]]; then
	pnpm --filter @elms/web docker:build:backend
	docker tag elms-backend:local "$BACKEND_IMAGE"
	pnpm --filter @elms/web docker:build:frontend
	docker tag elms-frontend:local "$FRONTEND_IMAGE"
fi

BACKEND_IMAGE="$BACKEND_IMAGE" FRONTEND_IMAGE="$FRONTEND_IMAGE" docker compose -f "$COMPOSE_FILE" pull postgres redis edge
BACKEND_IMAGE="$BACKEND_IMAGE" FRONTEND_IMAGE="$FRONTEND_IMAGE" docker compose -f "$COMPOSE_FILE" run --rm migrate
BACKEND_IMAGE="$BACKEND_IMAGE" FRONTEND_IMAGE="$FRONTEND_IMAGE" docker compose -f "$COMPOSE_FILE" up -d postgres redis backend web edge
docker compose -f "$COMPOSE_FILE" ps
