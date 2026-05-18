# ELMS — Deployment Models (Code-Truth)

## Status taxonomy

- `Implemented`: Active desktop/local runtime.
- `Archived Reference`: Cloud deployment assets and legacy cloud procedures.
- `Planned`: Future cloud runtime re-activation work.

## Implemented

- Desktop shell: Tauri app in `apps/desktop/src-tauri`.
- Local backend/frontend desktop workflows via root scripts (`dev:desktop`, `dev:tauri`, desktop release scripts).
- Desktop example environment in `apps/desktop/.env.desktop.example`.
- Backend startup forces local auth service for runtime behavior.

## Archived Reference

- Infrastructure artifacts for historic cloud deployment:
  - `archive/cloud/apps/web/docker-compose.yml`
  - `archive/cloud/apps/web/docker-compose.prod.yml`
  - `archive/cloud/apps/web/Dockerfile`
  - `archive/cloud/apps/web/backend.Dockerfile`
- These assets are reference-only and not the active production path.

## Planned

- Operational cloud runtime/auth re-activation from current codebase.

## Source of truth

- `archive/cloud/apps/web/*`
- `apps/desktop/*`
- `package.json`
- `packages/backend/src/config/env.ts`
- `packages/backend/src/modules/auth/createAuthService.ts`
