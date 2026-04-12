# ELMS — Executive Summary (Code-Truth)

ELMS is a legal practice management system implemented as a pnpm monorepo with shared backend/frontend contracts and two runtime topologies:

- Cloud/web deployment (`archive/cloud/apps/web`, Docker-based)
- Desktop deployment (`apps/desktop`, Tauri-based)

Current shipped implementation includes:

- Multi-tenant backend with firm/user/role/invitation domains
- Case, client, hearing, task, document, billing, report, and notification domains
- Library and research modules in backend
- Portal auth and portal read paths

This summary intentionally excludes market sizing, sales claims, or future roadmap assertions that are not verifiable from repository code.

## Source of truth

- `packages/backend/src/app.ts`
- `packages/backend/src/modules/**`
- `packages/frontend/src/router.tsx`
- `archive/cloud/apps/web/*`
- `apps/desktop/*`
