# ELMS Architecture — 04: Authentication and Security

## Status (as of July 10, 2026)

- `Implemented`: Local auth service and session model (desktop runtime).
- `Implemented`: Cloud auth service — JWT (RS256) access tokens + Redis-backed refresh tokens (hosted runtime).

See [docs/business/SAAS_CONVERSION_PLAN.md](../business/SAAS_CONVERSION_PLAN.md) for the current SaaS conversion plan and gap list, including tenant-isolation hardening work still needed.

## Runtime selection

`packages/backend/src/modules/auth/createAuthService.ts` selects between the local and cloud auth service based on `AUTH_MODE` (`local` | `cloud`) from `packages/backend/src/config/env.ts`.

## Local (desktop) auth flow

- Session cookie: `elms_local_session`
- Session backing store: local session store in backend process/runtime support files
- Local setup flow exists for first-run workspace initialization (`/api/auth/setup` endpoints)

## Cloud (hosted) auth flow

Implemented in `packages/backend/src/modules/auth/cloudAuthService.ts`:

- Access tokens: JWT signed via `@fastify/jwt`, `ACCESS_TOKEN_TTL_MINUTES` (default 15m), includes `firmId`, `editionKey`, `lifecycleStatus`, `roleKey`, `permissions` claims.
- Refresh tokens: random UUID stored in Redis (`refresh:<token>` → userId), `REFRESH_TOKEN_TTL_DAYS` (default 30d).
- Registration creates a `Firm` + `FirmSettings` + admin `User` in one flow, with a 30-day trial (`trialStartedAt`/`trialEndsAt`).
- Invite acceptance, login, refresh, and logout are all implemented and validated (see `cloudAuthService.test.ts` and `auth.routes.test.ts`).

## Security controls in active runtime

- Password hashing via bcrypt.
- Cookie attributes (`HttpOnly`, `SameSite`, secure in production).
- Permission-based authorization (`requirePermission`).
- Firm lifecycle write guard for mutating operations (`firmLifecycleWriteGuard`, HTTP 423 on SUSPENDED/PENDING_DELETION).
- CORS and desktop-origin handling in backend plugins.
- Tenant isolation is currently app-layer only (`injectTenant` middleware + service-layer `where: { firmId }` filters) — PostgreSQL Row-Level Security is not yet implemented; see the SaaS conversion plan's W1 workstream.

## Source of truth

- `packages/backend/src/config/env.ts`
- `packages/backend/src/modules/auth/createAuthService.ts`
- `packages/backend/src/modules/auth/*`
- `packages/backend/src/plugins/sessionContext.ts`
- `packages/backend/src/middleware/*`
