# API Reference

## Base URL

| Environment | Base URL |
|---|---|
| Local development (cloud mode) | `http://localhost:7854` |
| Local development (desktop/tauri) | `http://127.0.0.1:7854` |
| Production | Configured per deployment |

All API routes are prefixed with `/api`.

---

## Authentication

ELMS uses **cookie-based authentication**. All mutating and protected endpoints require a valid session cookie, which is set automatically by the login/register/setup flows.

**Cloud mode (`AUTH_MODE=CLOUD`):**

- `access_token` cookie — short-lived JWT (default 15 minutes), verified with RSA-2048
- `refresh_token` cookie — long-lived token (default 30 days), used by `POST /api/auth/refresh` to issue a new access token
- Both cookies are `httpOnly`, `SameSite=Lax`, and `Secure` in production

**Local/desktop mode (`AUTH_MODE=LOCAL`):**

- `local_session` cookie — maps to an in-memory session (default 12-hour TTL)
- No JWT cryptographic verification; session data is stored server-side

All cookies are set with `path=/`.

---

## Content type

Requests with a body must send `Content-Type: application/json`. The `apiFetch` wrapper in the frontend sets this header automatically for non-`FormData` bodies. File uploads use `multipart/form-data` (the browser sets the boundary automatically; do not set `Content-Type` manually for uploads).

---

## Swagger UI

An interactive API explorer is available at `http://localhost:7854/docs` in all non-production environments. It is generated from the Fastify JSON Schema declarations on each route and reflects the exact request and response shapes.

---

## Health check

```
GET /api/health
```

Returns the status of all critical dependencies. This endpoint does not require authentication.

**Response:**

```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok",
  "queue": {
    "waiting": 0,
    "active": 0
  }
}
```

A non-`"ok"` value in any field indicates that the corresponding dependency is unavailable.

---

## Route modules

The following table lists all 23 route groups registered in the application.

| # | Prefix | Module file | Description |
|---|---|---|---|
| 1 | `/api/auth` | `modules/auth/auth.routes.ts` | Authentication — login, register, setup, invite acceptance, refresh, logout, current session |
| 2 | `/api/firms` | `modules/firms/` | Firm profile and settings management |
| 3 | `/api/roles` | `modules/roles/` | RBAC role CRUD and permission assignment |
| 4 | `/api/users` | `modules/users/` | User management within a firm |
| 5 | `/api/invitations` | `modules/invitations/` | Staff invitation lifecycle |
| 6 | `/api/clients` | `modules/clients/` | Client records and contacts |
| 7 | `/api/cases` | `modules/cases/cases.routes.ts` | Case management including parties, assignments, court progression, and status history |
| 8 | `/api/hearings` | `modules/hearings/` | Case session (hearing) scheduling |
| 9 | `/api/tasks` | `modules/tasks/` | Task management |
| 10 | `/api/dashboard` | `modules/dashboard/` | Aggregated dashboard statistics |
| 11 | `/api/documents` | `modules/documents/` | Document upload, versioning, and OCR extraction |
| 12 | `/api/search` | `modules/search/` | Full-text search across cases, clients, and documents |
| 13 | `/api/lookups` | `modules/lookups/` | Configurable lookup/dropdown values |
| 14 | `/api/invoices`, `/api/expenses` | `modules/billing/billing.routes.ts` | Invoices, invoice items, payments, expense records, invoice PDF export, and per-case billing summary |
| 15 | `/api/notifications` | `modules/notifications/` | In-app notifications and notification preferences |
| 16 | `/api/templates` | `modules/templates/` | Document template CRUD |
| 17 | `/api/reports` | `modules/reports/` | Report execution and custom report builder |
| 18 | `/api/library` | `modules/library/` | Law library document management, categories, tags, annotations, and legislation articles |
| 19 | `/api/research` | `modules/research/` | AI-assisted legal research sessions |
| 20 | `/api/import` | `modules/import/` | Bulk data import (clients, cases) |
| 21 | `/api/portal` | `modules/portal/` | Client self-service portal endpoints |
| 22 | `/api/portal-auth` | `modules/portal/` | Client portal authentication |
| 23 | `/api/integrations/google-calendar` | `modules/integrations/` | Google Calendar OAuth and event sync |

---

## Module endpoint details

### Auth — `POST|GET /api/auth/*`

| Method | Path | Auth required | Rate limit | Description |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | No | 10/min | Authenticate with email + password; sets session cookies |
| `POST` | `/api/auth/register` | No | 5/min | Create a new firm and admin user (cloud mode only) |
| `GET` | `/api/auth/setup` | No | — | Returns `{ needsSetup: boolean }` (local mode only) |
| `POST` | `/api/auth/setup` | No | — | First-run setup: creates the firm and first user (local mode only) |
| `POST` | `/api/auth/accept-invite` | No | — | Accept a staff invitation and set a password (cloud mode only) |
| `POST` | `/api/auth/refresh` | No | — | Issue a new access token from the refresh token (cloud mode only) |
| `POST` | `/api/auth/logout` | No | — | Clears session cookies |
| `GET` | `/api/auth/me` | No | — | Returns the current session user or `null` |

All responses conform to `AuthResponseDto` from `@elms/shared` (shape: `{ session: { mode, user } }`).

### Cases — `GET|POST|PUT|DELETE|PATCH /api/cases/*`

All endpoints require `requireAuth`. Required permission is noted in brackets.

| Method | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/api/cases` | `cases:read` | Paginated list of cases for the current firm |
| `POST` | `/api/cases` | `cases:create` | Create a new case |
| `GET` | `/api/cases/:id` | `cases:read` | Fetch a single case with full detail |
| `PUT` | `/api/cases/:id` | `cases:update` | Update case metadata |
| `DELETE` | `/api/cases/:id` | `cases:delete` | Soft-delete a case |
| `GET` | `/api/cases/:id/status-history` | `cases:read` | List all status transitions for a case |
| `PATCH` | `/api/cases/:id/status` | `cases:status` | Change the case status with an optional note |
| `POST` | `/api/cases/:id/parties` | `cases:update` | Add a party to a case |
| `DELETE` | `/api/cases/:id/parties/:partyId` | `cases:update` | Remove a party |
| `POST` | `/api/cases/:id/assignments` | `cases:assign` | Assign a staff member to a case |
| `DELETE` | `/api/cases/:id/assignments/:assignmentId` | `cases:assign` | Remove a case assignment |
| `GET` | `/api/cases/:id/courts` | `cases:read` | List court stages for a case (ordered by `stageOrder`) |
| `POST` | `/api/cases/:id/courts` | `cases:update` | Add a court stage |
| `PUT` | `/api/cases/:id/courts/:courtId` | `cases:update` | Update a court stage |
| `DELETE` | `/api/cases/:id/courts/:courtId` | `cases:update` | Remove a court stage |
| `PATCH` | `/api/cases/:id/courts/reorder` | `cases:update` | Reorder court stages by supplying an ordered array of IDs |
| `GET` | `/api/cases/:id/billing` | `invoices:read` | Aggregated billing summary for a case |

### Billing — `GET|POST|PUT|DELETE /api/invoices/*` and `/api/expenses/*`

| Method | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/api/invoices` | `invoices:read` | Paginated invoice list with optional filters |
| `POST` | `/api/invoices` | `invoices:create` | Create a DRAFT invoice with line items |
| `GET` | `/api/invoices/:id` | `invoices:read` | Fetch a single invoice with items and payments |
| `PUT` | `/api/invoices/:id` | `invoices:update` | Update a DRAFT invoice |
| `POST` | `/api/invoices/:id/issue` | `invoices:update` | Transition invoice from DRAFT to ISSUED |
| `POST` | `/api/invoices/:id/void` | `invoices:update` | Void an invoice |
| `DELETE` | `/api/invoices/:id` | `invoices:delete` | Delete a DRAFT invoice |
| `POST` | `/api/invoices/:id/payments` | `invoices:update` | Record a payment against an invoice |
| `GET` | `/api/invoices/:id/pdf` | `invoices:read` | Stream an invoice as a PDF attachment |
| `GET` | `/api/expenses` | `expenses:read` | Paginated expense list |
| `POST` | `/api/expenses` | `expenses:create` | Create an expense record |
| `GET` | `/api/expenses/:id` | `expenses:read` | Fetch a single expense |
| `PUT` | `/api/expenses/:id` | `expenses:update` | Update an expense |
| `DELETE` | `/api/expenses/:id` | `expenses:delete` | Delete an expense |

Invoice `amount` fields accept and return decimal strings (e.g. `"1500.00"`) to preserve precision without floating-point rounding.

### Google Calendar — `/api/integrations/google-calendar/*`

Provides OAuth 2.0 authorisation flow and event synchronisation between `CaseSession` records and a user's Google Calendar. Requires `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_OAUTH_REDIRECT_URI` to be configured.

---

## Error responses

All errors return a JSON body with at minimum:

```json
{
  "message": "Human-readable error description"
}
```

Common HTTP status codes:

| Code | Meaning |
|---|---|
| `400` | Validation error (Zod parse failure) |
| `401` | Unauthenticated — no valid session |
| `403` | Insufficient permissions |
| `404` | Resource not found or not accessible to the current firm |
| `405` | Method not applicable in the current `AUTH_MODE` |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

---

## Permission model

Every protected endpoint is guarded by `requirePermission(permissionKey)`. The permission key must be present in the authenticated user's role. The 69 permission strings cover the following domains: `firms`, `settings`, `users`, `roles`, `invitations`, `cases`, `clients`, `hearings`, `tasks`, `dashboard`, `documents`, `reports`, `research`, `lookups`, `invoices`, `expenses`, `templates`, and `library`.

See `packages/backend/src/config/constants.ts` for the full list.

---

## Related

- [Architecture Internals](./04-architecture-internals.md) — plugin registration order, session resolution
- [Environment Variables](./03-environment-variables.md) — `AUTH_MODE`, JWT configuration
- [Database](./05-database.md) — entity relationships referenced in route responses
