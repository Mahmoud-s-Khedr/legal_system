# Scalability & Security (Code-Truth)

## Security controls present in code

- Cookie-based authentication for cloud/local modes.
- Permission checks and role-based authorization paths.
- Tenant injection and firm-scoped data access patterns.
- Optional Sentry initialization for monitoring.

## Scalability-relevant implementation points

- Cloud mode supports Redis-backed queue/session flows.
- Backend is modular and stateless at request layer aside from configured datastores.
- Queue-based extraction paths exist for document workloads.

## Source of truth

- `packages/backend/src/plugins/*`
- `packages/backend/src/middleware/*`
- `packages/backend/src/modules/roles/*`
- `packages/backend/src/modules/notifications/*`
- `packages/backend/src/jobs/*`
- `packages/backend/src/monitoring/sentry.ts`
