# ELMS — Deployment Models (Code-Truth)

## Cloud/Web model

- Infrastructure artifacts: `apps/web/docker-compose.yml`, `apps/web/docker-compose.prod.yml`, `apps/web/Dockerfile`, `apps/web/backend.Dockerfile`.
- Backend and frontend run as separate services.
- Cloud mode uses `AUTH_MODE=cloud` and may use Redis-backed flows.

## Desktop model

- Desktop shell: Tauri app in `apps/desktop/src-tauri`.
- Local backend/frontend desktop workflows are exposed via root scripts (`dev:desktop`, `dev:tauri`, desktop release scripts).
- Desktop example environment is defined in `apps/desktop/.env.desktop.example`.

## Shared codebase model

- Both deployment models consume the same backend/frontend/shared packages in this monorepo.

## Source of truth

- `apps/web/*`
- `apps/desktop/*`
- `package.json`
- `packages/backend/src/config/env.ts`
