# ELMS Architecture — 04: Authentication and Security

## Status (as of May 18, 2026)

- `Implemented`: Local auth service and session model.
- `Archived Reference`: Legacy cloud JWT+Redis auth narrative.
- `Planned`: Cloud auth/runtime re-activation.

## Current runtime truth

Backend startup normalizes auth behavior to local runtime:

- `packages/backend/src/config/env.ts` warns that `AUTH_MODE=cloud` is deprecated/non-operational and forces `AUTH_MODE=local`.
- `packages/backend/src/modules/auth/createAuthService.ts` always returns local auth service and logs warning when non-local mode is configured.

## Implemented auth flow

- Session cookie: `elms_local_session`
- Session backing store: local session store in backend process/runtime support files
- Local setup flow exists for first-run workspace initialization (`/api/auth/setup` endpoints)
- Auth/session context and permission checks remain active through middleware/plugins

## Security controls in active runtime

- Password hashing via bcrypt.
- Cookie attributes (`HttpOnly`, `SameSite`, secure in production).
- Permission-based authorization (`requirePermission`).
- Firm lifecycle write guard for mutating operations.
- CORS and desktop-origin handling in backend plugins.

## Archived Reference

Cloud JWT access/refresh token narratives, Redis-backed refresh semantics, and cloud-only production claims in older docs should be treated as archived reference until cloud runtime is re-enabled in code.

## Planned

When cloud runtime is restored, this page should be updated with verified JWT/refresh/Redis operational details tied to active implementation.

## Source of truth

- `packages/backend/src/config/env.ts`
- `packages/backend/src/modules/auth/createAuthService.ts`
- `packages/backend/src/modules/auth/*`
- `packages/backend/src/plugins/sessionContext.ts`
- `packages/backend/src/middleware/*`
