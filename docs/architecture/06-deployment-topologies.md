# ELMS Architecture — 06: Deployment Topologies

## Status (as of May 18, 2026)

- `Implemented`: Desktop/local topology.
- `Archived Reference`: Cloud Docker topology under `archive/cloud/**`.
- `Planned`: Operational cloud topology re-activation.

## Implemented topology

### Desktop/local

- Tauri shell in `apps/desktop/src-tauri`.
- Local backend runtime and frontend desktop workflow via root scripts (`dev:desktop`, `dev:tauri`).
- Embedded/local data paths and desktop packaging scripts remain the active release path.

### Runtime/auth behavior

- Runtime is local-mode operationally, including when cloud mode is configured.
- Treat cloud auth/runtime as non-operational for current deployment guidance.

## Archived Reference topology

Cloud deployment files exist for reference only:

- `archive/cloud/apps/web/docker-compose.yml`
- `archive/cloud/apps/web/docker-compose.prod.yml`
- `archive/cloud/apps/web/Dockerfile`
- `archive/cloud/apps/web/backend.Dockerfile`
- `archive/cloud/README.md`

These files are not the active production deployment contract at this time.

## Planned

Cloud topology documentation will be re-promoted from archived reference once runtime code supports operational cloud mode again.

## Source of truth

- `apps/desktop/**`
- `archive/cloud/**`
- `packages/backend/src/config/env.ts`
- `packages/backend/src/modules/auth/createAuthService.ts`
- `package.json`
