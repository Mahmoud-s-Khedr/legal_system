# 07 — Authentication Internals

This document covers the full authentication and authorization stack: the two runtime modes (`AUTH_MODE`), the JWT token flow, cookie security, password policy, rate limiting, the `injectTenant` middleware, RBAC permission enforcement, and the firm lifecycle write guard.

## Table of Contents

- [Auth Modes Overview](#auth-modes-overview)
- [CLOUD Mode — JWT + Redis Flow](#cloud-mode--jwt--redis-flow)
  - [Login](#login)
  - [Refresh](#refresh)
  - [Logout](#logout)
- [LOCAL Mode — In-Memory Sessions](#local-mode--in-memory-sessions)
  - [Setup Endpoint](#setup-endpoint)
- [Auth Routes Reference](#auth-routes-reference)
- [Cookie Security](#cookie-security)
- [Password Policy](#password-policy)
- [Rate Limiting](#rate-limiting)
- [Session Hydration — sessionContext Plugin](#session-hydration--sessioncontext-plugin)
- [injectTenant Middleware](#injecttenant-middleware)
- [requireAuth Middleware](#requireauth-middleware)
- [RBAC — requirePermission Middleware](#rbac--requirepermission-middleware)
- [firmLifecycleWriteGuard](#firmlifecyclewriteguard)
- [SessionUser Shape](#sessionuser-shape)

---

## Auth Modes Overview

The backend selects an authentication implementation at startup based on the `AUTH_MODE` environment variable. The choice is made in `createAuthService.ts`:

```typescript
if (env.AUTH_MODE === AuthMode.LOCAL) {
  return createLocalAuthService(env);
}
return createCloudAuthService(app, env);
```

| Mode | Value | Session storage | Use case |
|------|-------|----------------|----------|
| Cloud | `CLOUD` | Redis (refresh token) + JWT (access token) | SaaS, hosted deployments |
| Local | `LOCAL` | In-process `Map` | Desktop (Tauri) single-tenant |

See [Environment Variables](./03-environment-variables.md) for all related variables.

---

## CLOUD Mode — JWT + Redis Flow

The cloud auth service (`cloudAuthService.ts`) issues two tokens on every successful authentication event (login, register, accept-invite, refresh).

### Login

1. The client sends `POST /api/auth/login` with `{ email, password }`.
2. The handler calls `authService.login()`.
3. `cloudAuthService` looks up the user by email (excluding soft-deleted), verifies the bcrypt hash, then calls `issueTokens(userId)`.
4. `issueTokens` signs a **JWT access token** (RS256, `expiresIn: ACCESS_TOKEN_TTL_MINUTES minutes`) containing the full session payload:
   - `sub` — user ID
   - `firmId`, `editionKey`, `lifecycleStatus`, `trialEndsAt`, `graceEndsAt`
   - `roleId`, `roleKey`
   - `email`
   - `permissions` — full array of permission strings from the role
5. A **refresh token** UUID is generated with `randomUUID()` and stored in Redis under the key `refresh:<uuid>` with a TTL of `REFRESH_TOKEN_TTL_DAYS * 86400` seconds. The value stored is `userId`.
6. Both tokens are returned to `setCookies()` which writes them as HttpOnly cookies (see [Cookie Security](#cookie-security)).

The JWT is signed using `@fastify/jwt` registered in `plugins/auth.ts`:

```typescript
await app.register(jwt, {
  secret: { private: env.JWT_PRIVATE_KEY, public: env.JWT_PUBLIC_KEY },
  sign: { algorithm: "RS256" }
});
```

In development, keys are auto-generated via `generateKeyPairSync`. In production you **must** set `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY`. Generate them with:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
openssl rsa -in private.pem -pubout -out public.pem
```

### Refresh

`POST /api/auth/refresh`:

1. Reads `elms_refresh_token` from request cookies.
2. Looks up `refresh:<token>` in Redis. If missing or expired, throws `"Refresh token expired"`.
3. **Rotates the token**: deletes the old Redis key and calls `issueTokens(userId)` to issue a new access token and a new refresh token UUID.
4. Sets both new cookies in the response.

This implements **refresh token rotation** — each refresh consumes the old token.

### Logout

`POST /api/auth/logout`:

1. Reads `elms_refresh_token` from cookies.
2. Deletes `refresh:<token>` from Redis (invalidates the server-side session).
3. Calls `clearCookies()` to unset both `elms_access_token` and `elms_refresh_token` cookies.

---

## LOCAL Mode — In-Memory Sessions

The local auth service (`localAuthService.ts`) uses a `LocalSessionStore` singleton — an in-process `Map<sessionId, { userId, createdAt }>`.

On login:
1. Verifies credentials with bcrypt (same as cloud).
2. Creates a UUID session ID via `localSessionStore.create(userId)`.
3. Sets the `elms_local_session` cookie.

Session TTL is controlled by `LOCAL_SESSION_TTL_HOURS` (default: 12). The TTL is checked on every `resolve()` call — expired entries are evicted lazily.

LOCAL mode does **not** support `refresh`, `register`, or `acceptInvite` — these routes return `405 Method Not Allowed` when the corresponding service method is absent.

### Setup Endpoint

Because local mode is single-tenant (desktop), a first-run setup flow exists:

- `GET /api/auth/setup` — returns `{ needsSetup: true }` if no firm row exists yet.
- `POST /api/auth/setup` — creates the firm, settings, and first admin user atomically, then issues a session.

The setup endpoint is only available when `authService.setup` is defined (LOCAL mode). In CLOUD mode it returns `405`.

---

## Auth Routes Reference

All routes live in `packages/backend/src/modules/auth/auth.routes.ts`.

| Method | Path | Rate Limit | Available in |
|--------|------|-----------|--------------|
| `POST` | `/api/auth/login` | 10 req/min | CLOUD + LOCAL |
| `POST` | `/api/auth/register` | 5 req/min | CLOUD only |
| `GET` | `/api/auth/setup` | — | LOCAL only |
| `POST` | `/api/auth/setup` | — | LOCAL only |
| `POST` | `/api/auth/accept-invite` | — | CLOUD only |
| `POST` | `/api/auth/refresh` | — | CLOUD only |
| `POST` | `/api/auth/logout` | — | CLOUD + LOCAL |
| `GET` | `/api/auth/me` | — | CLOUD + LOCAL |

`GET /api/auth/me` returns the current session from `request.sessionUser` as populated by the session context plugin. It does not hit the database.

---

## Cookie Security

Cookies are set by the `setCookies()` helper in `auth.routes.ts` using the following options for every cookie:

```typescript
reply.setCookie(name, value, {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  secure: env.NODE_ENV === "production"
});
```

| Cookie | Mode | Content | TTL |
|--------|------|---------|-----|
| `elms_access_token` | CLOUD | Signed RS256 JWT | `ACCESS_TOKEN_TTL_MINUTES` (default 15 min) |
| `elms_refresh_token` | CLOUD | UUID (Redis key reference) | `REFRESH_TOKEN_TTL_DAYS` (default 30 days) |
| `elms_local_session` | LOCAL | UUID (in-memory session ID) | `LOCAL_SESSION_TTL_HOURS` (default 12 h) |

The `secure` flag is set only when `NODE_ENV=production`, ensuring cookies work over plain HTTP in local development. `SameSite=lax` prevents cross-site request forgery while allowing top-level navigations.

---

## Password Policy

Password validation is enforced at the Zod schema level in `utils/passwordPolicy.ts`:

```typescript
export const newPasswordSchema = z.string().min(8, "Password must be at least 8 characters.");
```

This schema is applied to `register`, `setup`, and `accept-invite` payloads. The login endpoint accepts any non-empty password and fails at bcrypt comparison time rather than schema validation.

Passwords are hashed with `bcryptjs` at a cost factor of **12** before storage.

---

## Rate Limiting

Rate limits are declared inline as Fastify route config and processed by the `@fastify/rate-limit` plugin (registered in `plugins/rateLimit.ts`):

| Route | Limit | Window |
|-------|-------|--------|
| `POST /api/auth/login` | 10 requests | 1 minute |
| `POST /api/auth/register` | 5 requests | 1 minute |

Exceeding a limit returns `HTTP 429 Too Many Requests`.

---

## Session Hydration — sessionContext Plugin

The `plugins/sessionContext.ts` plugin registers a Fastify `onRequest` hook that runs before every route handler. It reads the appropriate cookie and populates `request.sessionUser`:

- **CLOUD**: Verifies the JWT in `elms_access_token` using the RS256 public key. On success the decoded JWT payload is used directly as the session user (no database call).
- **LOCAL**: Looks up the UUID in `elms_local_session` via `localSessionStore.resolve()`. If the session is valid, loads the full user + role + permissions from the database.

If no valid session is found, `request.sessionUser` is set to `null`. This is not an error at this stage — individual routes enforce authentication via `requireAuth`.

---

## injectTenant Middleware

`middleware/injectTenant.ts` registers an `onRequest` hook that runs before session hydration:

```typescript
app.addHook("onRequest", async (request) => {
  delete request.headers["x-firm-id"];
});
```

This strips any client-supplied `x-firm-id` header, preventing tenant impersonation. The actual `firmId` always comes from the authenticated session (`request.sessionUser.firmId`), never from request input.

---

## requireAuth Middleware

`middleware/requireAuth.ts` is a Fastify preHandler that gates routes requiring an authenticated session:

```typescript
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.sessionUser) {
    await reply.status(401).send({ message: "Authentication required" });
  }
}
```

Usage in a route:

```typescript
app.get("/api/cases", { preHandler: requireAuth }, handler);
```

---

## RBAC — requirePermission Middleware

`middleware/requirePermission.ts` extends `requireAuth` with a permission check:

```typescript
export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.sessionUser) {
      return reply.status(401).send({ message: "Authentication required" });
    }
    if (!request.sessionUser.permissions.includes(permission)) {
      return reply.status(403).send({ message: "Forbidden" });
    }
  };
}
```

The permissions array on `sessionUser` is derived at token-issue time from `role.permissions` (CLOUD) or loaded fresh from the database on each request (LOCAL). This means permission changes take effect on the next login in CLOUD mode.

The full list of 69 permission strings is defined in `packages/backend/src/config/constants.ts` under `DEFAULT_PERMISSIONS`. Permissions follow the pattern `<resource>:<action>`, for example:

| Domain | Permissions |
|--------|------------|
| `firms` | `firms:read` |
| `users` | `users:create`, `users:read`, `users:update`, `users:delete` |
| `cases` | `cases:create`, `cases:read`, `cases:update`, `cases:assign`, `cases:status`, `cases:delete` |
| `documents` | `documents:create`, `documents:read`, `documents:update`, `documents:delete` |
| `invoices` | `invoices:create`, `invoices:read`, `invoices:update`, `invoices:delete` |
| `library` | `library:read`, `library:manage` |
| `roles` | `roles:create`, `roles:read`, `roles:update`, `roles:delete` |

Usage in a route:

```typescript
app.delete("/api/cases/:id", { preHandler: requirePermission("cases:delete") }, handler);
```

---

## firmLifecycleWriteGuard

`middleware/firmLifecycleWriteGuard.ts` registers a `preHandler` hook that blocks write operations for firms in certain lifecycle states:

```typescript
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const BLOCKED_STATUSES = new Set([
  FirmLifecycleStatus.SUSPENDED,
  FirmLifecycleStatus.PENDING_DELETION
]);
const ALLOWED_WRITE_PATHS = new Set(["/api/auth/logout"]);
```

When a firm's `lifecycleStatus` is `SUSPENDED` or `PENDING_DELETION`, all mutating HTTP methods return `HTTP 423 Locked` with the message `"Firm subscription is not active for write operations"`. Logout is explicitly exempted so users can always sign out.

The guard only fires when a session user is present — unauthenticated requests pass through to the `requireAuth` check downstream.

---

## SessionUser Shape

The `SessionUser` type (from `@elms/shared`) carries all data routes need to authorize requests without additional database queries:

```typescript
interface SessionUser {
  id: string;
  firmId: string;
  editionKey: string;
  lifecycleStatus: FirmLifecycleStatus;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  roleId: string;
  roleKey: string;
  email: string;
  fullName: string;
  preferredLanguage: string;
  permissions: string[];
}
```

In CLOUD mode this entire shape is encoded directly in the JWT claims. In LOCAL mode it is reconstructed from the database on each request via `getUserWithRoleAndPermissions()`.

---

Related: [Environment Variables](./03-environment-variables.md) | [Testing](./08-testing.md)
