# Architecture Internals

This document explains the structural patterns used inside the backend and frontend packages, how the two sides share types, and how key cross-cutting concerns (session resolution, PWA caching, code splitting) work.

---

## Backend

### Module pattern

Every feature domain lives in its own directory under `packages/backend/src/modules/<domain>/`. The canonical layout is:

```
modules/cases/
├── cases.routes.ts    # Fastify route registrations, input validation (Zod), middleware wiring
└── cases.service.ts   # Business logic, Prisma queries, audit logging
```

`routes.ts` files are thin: they parse request bodies with Zod schemas, call service functions, and apply middleware via `preHandler` arrays. All database access and domain logic live in the corresponding `service.ts`. This separation keeps routes unit-testable independently of Fastify.

Additional files appear in larger modules:

- `auth/` has `createAuthService.ts`, `localSessionStore.ts`, `sessionUser.ts` — the auth service is a factory because its implementation differs between `CLOUD` and `LOCAL` modes.
- `billing/` has `invoice.pdf.ts` — PDF generation is isolated from billing logic.
- `integrations/` holds the Google Calendar OAuth flow.

### Fastify plugin registration order

The application factory in `packages/backend/src/app.ts` registers plugins in the following order, which determines the request lifecycle:

1. `@fastify/cookie` — makes `request.cookies` available
2. `@fastify/cors` — handles preflight and cross-origin headers
3. `@fastify/rate-limit` — per-route and global rate limiting (backed by Redis)
4. `@fastify/multipart` — enables file upload parsing
5. `@fastify/jwt` — registers `app.jwt.verify()`; does **not** enforce authentication on its own
6. `sessionContext` — a `preHandler` hook that populates `request.sessionUser`
7. `firmLifecycleWriteGuard` — blocks mutating requests for suspended or pending-deletion firms
8. `errorHandler` — normalises unhandled errors into consistent JSON responses
9. `injectTenant` — convenience hook that attaches the tenant/firm context to the request
10. Route modules (23 groups) — registered last after all plugins are in place

Swagger UI (`@fastify/swagger` + `@fastify/swagger-ui`) is conditionally registered only when `NODE_ENV !== 'production'` and is available at `GET /docs`.

### `sessionContext` — how session resolution works

`packages/backend/src/plugins/sessionContext.ts` decorates every request with a `sessionUser` property:

```typescript
app.decorateRequest("sessionUser", null);
app.addHook("preHandler", async (request) => {
  request.sessionUser = await resolveSessionUser(app, env, request.cookies);
});
```

The resolution strategy is determined by `AUTH_MODE`:

**`CLOUD` mode** — reads the `access_token` cookie, verifies it as a JWT signed with the RSA key pair, and fetches the user with their role and permissions from PostgreSQL using the `sub` claim (user UUID). Audience is `"elms-api"`, issuer is `COOKIE_DOMAIN`.

**`LOCAL` mode** — reads the `local_session` cookie, looks it up in the in-memory `localSessionStore`, and fetches the user from PostgreSQL by the stored `userId`. No cryptographic verification is required for the local-only desktop edition.

In both cases, if resolution fails for any reason (missing cookie, expired token, deleted user), `request.sessionUser` is set to `null`. Individual routes enforce authentication by applying the `requireAuth` middleware in their `preHandler` array.

### Background schedulers

`packages/backend/src/server.ts` starts two background processes after the HTTP server binds:

- `startReminderScheduler()` — sends hearing and task reminder notifications on a schedule
- `startEditionLifecycleScheduler()` — advances firm lifecycle states (trial expiry → GRACE → SUSPENDED → PENDING_DELETION)

Both are non-blocking; they start without awaiting.

### Graceful shutdown

The server registers handlers for `SIGTERM` and `SIGINT`. On receipt:

1. `app.close()` — drains in-flight requests and closes Fastify
2. `prisma.$disconnect()` — closes the database connection pool

---

## `@elms/shared` — type sharing between frontend and backend

`packages/shared/src/index.ts` is the single export surface:

```typescript
export * from "./enums/index";
export * from "./types/auth";
export * from "./types/common";
export * from "./dtos/auth";
export * from "./dtos/firms";
export * from "./dtos/users";
export * from "./dtos/roles";
export * from "./dtos/invitations";
export * from "./dtos/clients";
export * from "./dtos/cases";
export * from "./dtos/hearings";
export * from "./dtos/tasks";
export * from "./dtos/dashboard";
export * from "./dtos/documents";
export * from "./dtos/lookups";
export * from "./dtos/billing";
export * from "./dtos/notifications";
```

Both `packages/backend` and `packages/frontend` declare `"@elms/shared": "workspace:*"` in their `package.json` dependencies. The `tsconfig.base.json` path alias resolves `@elms/shared` to `packages/shared/src/index.ts` during development, giving editors and the TypeScript compiler direct source access without a compilation step.

This means a change to a DTO in `@elms/shared` produces type errors in both the backend service and the frontend query layer simultaneously — enforcing contract consistency across the API boundary.

---

## Frontend

### Application bootstrap

`packages/frontend/src/main.tsx` initialises the application:

1. Conditionally initialises **Sentry** (if `VITE_SENTRY_DSN` is set) with a `beforeSend` hook that redacts PII from event payloads before transmission.
2. In non-Tauri environments, calls `startSyncQueueReplay()` to replay any offline-queued mutations accumulated while the user was offline.
3. Renders the React tree: `QueryClientProvider` → `DirectionProvider` → `DesktopBootstrapGate` → `ToastContainer` → `OfflineBanner` → `RouterProvider`.

`DesktopBootstrapGate` handles the Tauri-specific startup sequence (waiting for the embedded backend to be ready before rendering routes).

### TanStack Router — route structure

Routes are registered in `packages/frontend/src/router.tsx` using `@tanstack/react-router`'s code-based route tree. The route hierarchy is:

```
/ (root)
├── /                    → LandingRedirect (auto-redirects based on auth state)
├── /login               → LoginPage
├── /register            → RegisterPage (cloud only)
├── /setup               → SetupPage (local/desktop first-run wizard)
├── /accept-invite       → AcceptInvitePage
├── /portal/login        → PortalLoginPage (client portal)
├── /portal/accept-invite → PortalAcceptInvitePage
├── /portal              → PortalLayout (protected by portalAuthStore)
│   ├── /dashboard       → PortalDashboardPage
│   └── /cases/:caseId   → PortalCasePage
└── /app                 → ProtectedRoute (enforces staff authentication)
    ├── /dashboard
    ├── /clients, /clients/new, /clients/:clientId, /clients/:clientId/edit
    ├── /cases, /cases/new, /cases/:caseId
    ├── /hearings, /hearings/new, /hearings/:hearingId/edit
    ├── /tasks, /tasks/new, /tasks/:taskId
    ├── /users, /users/new, /users/:userId          (PermissionGate: users:read)
    ├── /invitations, /invitations/new              (PermissionGate: invitations:read)
    ├── /settings                                   (PermissionGate: settings:read)
    ├── /settings/lookups, /settings/lookups/:entity (PermissionGate: lookups:manage)
    ├── /settings/roles, /settings/roles/new, /settings/roles/:roleId/edit
    ├── /settings/notifications
    ├── /documents, /documents/new
    ├── /search
    ├── /invoices, /invoices/new, /invoices/:invoiceId (PermissionGate: invoices:read)
    ├── /expenses                                   (PermissionGate: expenses:read)
    ├── /notifications
    ├── /reports, /reports/builder                  (PermissionGate: reports:read)
    ├── /research, /research/:sessionId             (PermissionGate: research:use)
    ├── /library, /library/documents/:documentId, /library/search, /library/admin, /library/upload
    ├── /import                                     (PermissionGate: clients:create)
    └── /templates, /templates/new, /templates/:templateId/edit
```

`ProtectedRoute` calls `authStore.bootstrap()` on mount. If the user is not authenticated after bootstrapping, it redirects to `/login`. Per-route permission checks are applied via the `PermissionGate` component wrapper.

### Zustand stores

Three global stores manage client-side state:

**`authStore`** (`packages/frontend/src/store/authStore.ts`)

Manages the staff authentication lifecycle. Exposes `user: SessionUser | null`, `mode: AppAuthMode | null`, and `needsSetup: boolean`. Key actions:

- `bootstrap()` — calls `GET /api/auth/me`; in `LOCAL` mode also calls `GET /api/auth/setup` to determine if the first-run wizard is needed. Deduplicates concurrent bootstrap calls with a module-level promise.
- `login()`, `register()`, `setup()`, `acceptInvite()` — POST to the corresponding auth endpoints and update the store.
- `logout()` — POSTs to `/api/auth/logout` and clears user state.

The `useHasPermission(permission)` hook reads from `user.permissions` to perform client-side capability checks.

**`portalAuthStore`** (`packages/frontend/src/store/portalAuthStore.ts`)

Manages client-portal authentication separately from staff auth. Stores `PortalUser | null` (with `clientId`, `firmId`, `name`). Calls `/api/portal/auth/*` endpoints.

**`toastStore`** (`packages/frontend/src/store/toastStore.ts`)

Manages a list of `Toast` items (`id`, `message`, `variant: success | error | info`). Toasts are auto-dismissed after 4 seconds with a 250 ms exit animation window. Components use `addToast(message, variant)` to trigger notifications.

### Vite code splitting

`packages/frontend/vite.config.ts` configures manual chunk splitting to produce predictable, cacheable bundles:

| Chunk name | Contents |
|---|---|
| `vendor-react` | React, React DOM |
| `vendor-tanstack` | TanStack Router, TanStack Query |
| `vendor-i18n` | i18n runtime library |
| `locale-ar` | Arabic locale data |
| `locale-fr` | French locale data |
| `vendor-pdf` | PDF rendering dependencies |
| `vendor` | All other third-party dependencies |

### PWA and offline behaviour

The service worker uses a **NetworkFirst** strategy for all `/api/` requests with a 5-second network timeout, a 200-entry cache, and a maximum age of 24 hours. This means:

- Online: requests go directly to the network; the response is cached.
- Offline or network timeout: the cached response is served.

The update mode is `autoUpdate`, so the service worker is replaced silently. The `OfflineBanner` component listens for the browser's `offline` event and renders a banner. The `syncQueue` module queues mutations made offline and replays them when connectivity is restored (non-Tauri environments only).

---

## Related

- [Getting Started](./01-getting-started.md)
- [Environment Variables](./03-environment-variables.md) — `AUTH_MODE`, JWT key configuration
- [Database](./05-database.md) — Prisma schema and multi-tenancy
- [API Reference](./06-api-reference.md) — route modules and endpoint details

## Source of truth

- `docs/_inventory/source-of-truth.md`

