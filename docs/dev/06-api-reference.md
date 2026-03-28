# API Reference

## Base URL

| Environment | Base URL |
|---|---|
| Local cloud dev | `http://localhost:7854` |
| Local desktop runtime | `http://127.0.0.1:7854` |

All backend routes are under `/api/*`.

## Authentication

ELMS uses cookie-based auth.

- Cloud mode (`AUTH_MODE=cloud`): access + refresh token cookies.
- Local mode (`AUTH_MODE=local`): local session cookie.

Cookie constants are defined in `packages/backend/src/config/constants.ts`.

## OpenAPI / Swagger

Swagger UI is available in non-production environments at `/docs` on the backend host.

## Health Check

- `GET /api/health`
- Returns overall status plus checks for database and (cloud mode) Redis/queue depth.

## Route Groups (Registered in `createApp`)

The following prefixes are implemented by route modules in `packages/backend/src/modules/**`:

- `/api/auth`
- `/api/firms`
- `/api/roles`
- `/api/users`
- `/api/invitations`
- `/api/clients`
- `/api/cases`
- `/api/hearings`
- `/api/tasks`
- `/api/dashboard`
- `/api/documents`
- `/api/search`
- `/api/lookups`
- `/api/invoices`
- `/api/expenses`
- `/api/notifications`
- `/api/templates`
- `/api/reports`
- `/api/library`
- `/api/research`
- `/api/import`
- `/api/portal/auth`
- `/api/portal`
- `/api/integrations/google-calendar`
- `/api/powers`

## Notes on Availability

- Some backend capabilities may not be currently exposed in frontend navigation.
- Route-level permissions are enforced server-side in module routes/services.

## Source of truth

- `packages/backend/src/app.ts`
- `packages/backend/src/modules/**/*.routes.ts`
- `packages/backend/src/config/constants.ts`
- `packages/backend/src/config/env.ts`
