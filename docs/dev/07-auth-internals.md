# 07 — Authentication Internals

## Status (as of May 18, 2026)

- `Implemented`: Local auth service and local session flow.
- `Archived Reference`: Legacy cloud auth flow (JWT + Redis refresh).
- `Planned`: Cloud auth/runtime re-activation.

## Runtime selection truth

Authentication service creation is currently local-only in effective runtime behavior:

- If non-local auth mode is configured, backend logs warning and forces local auth service behavior.
- `AUTH_MODE=cloud` is deprecated/non-operational in startup logic.

## Implemented endpoints and behavior

Auth routes are still registered under `/api/auth/*`; operational behavior is local-service based:

- `POST /api/auth/login`
- `GET /api/auth/setup`
- `POST /api/auth/setup`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Route-level availability can still include cloud-era handlers, but active runtime behavior should be documented as local-operational until cloud mode is restored.

## Implemented security and authorization internals

- Session hydration via `sessionContext` plugin.
- Tenant header hardening via `injectTenant`.
- `requireAuth` and `requirePermission` enforcement.
- `firmLifecycleWriteGuard` for write-lock states.
- Cookie and rate-limit plugins remain active.

## Archived Reference

JWT access/refresh rotation and Redis token store details are historical implementation context, not current operational contract.

## Planned

When cloud runtime is re-enabled, restore detailed cloud flow sections and update route availability matrix with operational mode semantics.

## Source of truth

- `packages/backend/src/config/env.ts`
- `packages/backend/src/modules/auth/createAuthService.ts`
- `packages/backend/src/modules/auth/auth.routes.ts`
- `packages/backend/src/plugins/sessionContext.ts`
- `packages/backend/src/middleware/*.ts`
