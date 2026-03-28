# ELMS Architecture — 03: Data Flow

This document traces the complete request lifecycle through the ELMS stack, using `GET /api/cases` as a representative authenticated read request. It covers both the happy path (authenticated, authorised) and the two main failure paths (unauthenticated, unauthorised).

---

## 1. Plugin Registration Order

Before tracing requests, it is important to understand the order in which Fastify plugins are registered in `app.ts`. Every incoming request passes through these layers in sequence:

| Order | Plugin | Purpose |
|---|---|---|
| 1 | `@fastify/cookie` | Parses `Cookie` header into `request.cookies` |
| 2 | `@fastify/cors` | Sets CORS headers, rejects disallowed origins |
| 3 | `@fastify/rate-limit` | Enforces per-route and global rate limits |
| 4 | `@fastify/multipart` | Parses multipart form data (max 50 MB) |
| 5 | `@fastify/jwt` | Registers `request.jwtVerify()` using RS256 |
| 6 | `sessionContext` | Decodes `elms_access_token` (CLOUD) or `elms_local_session` (LOCAL) into `req.session` |
| 7 | `firmLifecycleWriteGuard` | Blocks write methods (POST/PUT/PATCH/DELETE) on SUSPENDED or PENDING_DELETION firms with HTTP 423 |
| 8 | `errorHandler` | Catches all unhandled errors, serialises them into a consistent JSON response |
| 9 | `injectTenant` | Strips `X-Firm-ID` from external requests; injects `firmId` from `req.session` into every request context |

Route-level `preHandler` hooks (`requireAuth`, `requirePermission`) run after all global plugins, immediately before the route handler.

---

## 2. Happy Path — Authenticated GET /api/cases

```mermaid
sequenceDiagram
    autonumber
    participant Browser
    participant Nginx
    participant Cookie as "@fastify/cookie"
    participant RateLimit as "@fastify/rate-limit"
    participant SessionCtx as "sessionContext"
    participant LifecycleGuard as "firmLifecycleWriteGuard"
    participant InjectTenant as "injectTenant"
    participant RequireAuth as "requireAuth (preHandler)"
    participant RequirePerm as "requirePermission (preHandler)"
    participant Handler as "cases route handler"
    participant Service as "cases.service"
    participant Prisma as "Prisma Client"
    participant PG as "PostgreSQL"

    Browser->>Nginx: GET /api/cases?status=ACTIVE\nCookie: elms_access_token=<JWT>
    Nginx->>Cookie: Proxy to Fastify :7854\n(preserves Cookie header)

    Note over Cookie: Parses cookies into request.cookies

    Cookie->>RateLimit: Pass through
    Note over RateLimit: Global rate limit check passes\n(not a login/register route)

    RateLimit->>SessionCtx: Pass through
    Note over SessionCtx: Reads elms_access_token cookie\nCalls request.jwtVerify()\nPopulates req.session = { userId, firmId, roleId, ... }

    SessionCtx->>LifecycleGuard: Pass through
    Note over LifecycleGuard: Method is GET — write guard skipped

    LifecycleGuard->>InjectTenant: Pass through
    Note over InjectTenant: Strips X-Firm-ID if present\nInjects req.session.firmId into request context

    InjectTenant->>RequireAuth: Pass through (preHandler[0])
    Note over RequireAuth: req.session is populated → passes\nAttaches sessionUser to request

    RequireAuth->>RequirePerm: Pass through (preHandler[1])
    Note over RequirePerm: Checks sessionUser.permissions\nincludes "cases:read" → passes

    RequirePerm->>Handler: Invokes route handler
    Note over Handler: Reads query params (status, page, limit)\nCalls cases.service.listCases(sessionUser, filters, pagination)

    Handler->>Service: listCases(actor, filters, pagination)
    Note over Service: Constructs Prisma query\nAlways includes where: { firmId: actor.firmId }

    Service->>Prisma: prisma.case.findMany({\n  where: { firmId, status },\n  include: { client, assignments },\n  skip, take\n})

    Prisma->>PG: SELECT ... FROM "Case"\nWHERE "firmId" = $1 AND "status" = $2\nLIMIT $3 OFFSET $4

    PG-->>Prisma: Result rows
    Prisma-->>Service: Typed Case[] array
    Service-->>Handler: { data: CaseDto[], total, page, limit }
    Handler-->>RequirePerm: HTTP 200 JSON response
    RequirePerm-->>RequireAuth: (pass-through)
    RequireAuth-->>InjectTenant: (pass-through)
    InjectTenant-->>LifecycleGuard: (pass-through)
    LifecycleGuard-->>SessionCtx: (pass-through)
    SessionCtx-->>RateLimit: (pass-through)
    RateLimit-->>Cookie: (pass-through)
    Cookie-->>Nginx: HTTP 200 { data: [...], total, page, limit }
    Nginx-->>Browser: HTTP 200 JSON
```

---

## 3. Unauthenticated Path — Missing or Expired Token

```mermaid
sequenceDiagram
    autonumber
    participant Browser
    participant Nginx
    participant SessionCtx as "sessionContext"
    participant RequireAuth as "requireAuth (preHandler)"
    participant ErrorHandler as "errorHandler"

    Browser->>Nginx: GET /api/cases\n(no cookie, or expired JWT)
    Nginx->>SessionCtx: Proxy to Fastify

    Note over SessionCtx: elms_access_token absent or jwtVerify() throws\nreq.session remains null/undefined

    SessionCtx->>RequireAuth: Reaches preHandler[0]
    Note over RequireAuth: req.session is null\nThrows Fastify error { statusCode: 401 }

    RequireAuth->>ErrorHandler: Error propagated to errorHandler
    Note over ErrorHandler: Serialises to { statusCode: 401, message: "Unauthorized" }

    ErrorHandler-->>Nginx: HTTP 401 JSON
    Nginx-->>Browser: HTTP 401 { statusCode: 401, message: "Unauthorized" }
```

---

## 4. Authorisation Failure Path — Missing Permission

```mermaid
sequenceDiagram
    autonumber
    participant Browser
    participant Nginx
    participant SessionCtx as "sessionContext"
    participant RequireAuth as "requireAuth (preHandler)"
    participant RequirePerm as "requirePermission (preHandler)"
    participant ErrorHandler as "errorHandler"

    Browser->>Nginx: GET /api/cases\nCookie: elms_access_token=<JWT>\n(user does NOT have cases:read)
    Nginx->>SessionCtx: Proxy to Fastify

    Note over SessionCtx: JWT valid\nreq.session populated\nbut sessionUser.permissions excludes "cases:read"

    SessionCtx->>RequireAuth: preHandler[0]
    Note over RequireAuth: req.session present → passes

    RequireAuth->>RequirePerm: preHandler[1]
    Note over RequirePerm: sessionUser.permissions does NOT include "cases:read"\nThrows { statusCode: 403, message: "Forbidden" }

    RequirePerm->>ErrorHandler: Error propagated
    ErrorHandler-->>Nginx: HTTP 403 JSON
    Nginx-->>Browser: HTTP 403 { statusCode: 403, message: "Forbidden" }
```

---

## 5. Write Request — firmLifecycleWriteGuard Blocking Path

```mermaid
sequenceDiagram
    autonumber
    participant Browser
    participant Nginx
    participant SessionCtx as "sessionContext"
    participant LifecycleGuard as "firmLifecycleWriteGuard"
    participant ErrorHandler as "errorHandler"

    Browser->>Nginx: POST /api/cases\nCookie: elms_access_token=<JWT>\n(firm is SUSPENDED)
    Nginx->>SessionCtx: Proxy to Fastify

    Note over SessionCtx: JWT valid\nreq.session.firm.lifecycleStatus = "SUSPENDED"

    SessionCtx->>LifecycleGuard: Pass through
    Note over LifecycleGuard: Method is POST (write)\nfirm.lifecycleStatus is SUSPENDED\nThrows { statusCode: 423, message: "Firm is suspended" }

    LifecycleGuard->>ErrorHandler: Error propagated
    ErrorHandler-->>Nginx: HTTP 423 JSON
    Nginx-->>Browser: HTTP 423 { statusCode: 423, message: "Firm is suspended" }
```

---

## 6. Token Refresh Flow (CLOUD Mode)

When the `elms_access_token` JWT has expired (15-minute TTL) but a valid refresh token exists in Redis, the frontend initiates a silent refresh before retrying the original request.

```mermaid
sequenceDiagram
    autonumber
    participant Browser
    participant TanStackQuery as "TanStack Query"
    participant Nginx
    participant SessionCtx as "sessionContext"
    participant RequireAuth as "requireAuth"
    participant AuthService as "auth.service"
    participant Redis

    Browser->>TanStackQuery: Data fetch triggered
    TanStackQuery->>Nginx: GET /api/cases (expired access token)
    Nginx->>SessionCtx: Proxy
    Note over SessionCtx: jwtVerify() throws — token expired
    SessionCtx->>RequireAuth: req.session null
    RequireAuth-->>Browser: HTTP 401

    Browser->>Nginx: POST /api/auth/refresh\n(sends refresh token UUID from elms_refresh_token cookie)
    Nginx->>AuthService: Proxy
    AuthService->>Redis: GET refresh:<uuid>
    Redis-->>AuthService: { userId, firmId } (if not expired)
    Note over AuthService: Issues new RS256 JWT\nSets new elms_access_token cookie\nRotates refresh token in Redis
    AuthService-->>Browser: HTTP 200 + new Set-Cookie headers

    Browser->>TanStackQuery: Retry original request
    TanStackQuery->>Nginx: GET /api/cases (new valid access token)
    Nginx-->>Browser: HTTP 200 { data: [...] }
```

---

## 7. Key Design Points

**firmId is always injected, never trusted from the client.** The `injectTenant` plugin strips any `X-Firm-ID` header that arrives from outside (e.g., a forged request). The `firmId` that reaches every service function comes exclusively from the validated session token.

**Permission strings follow `resource:action` format.** The `requirePermission` middleware receives a string like `"cases:read"` and checks it against `sessionUser.permissions`, which is an array of strings loaded at session decode time. See [04-auth-and-security.md](./04-auth-and-security.md) for the full RBAC model.

**Error serialisation is centralised.** All thrown errors pass through the `errorHandler` plugin. Route handlers and services throw typed Fastify HTTP errors; the handler maps them to consistent `{ statusCode, message, code? }` JSON objects. Stack traces are never sent to clients in production.

**Multi-tenancy at the Prisma layer.** Even if a bug in a middleware layer allowed `firmId` to be spoofed, every `prisma.entity.findMany` call in the service layer includes `where: { firmId: actor.firmId }`. Cross-firm data leakage requires bypassing both the middleware and the ORM query construction.

---

## Related Documents

- [01-system-overview.md](./01-system-overview.md) — Container diagram showing Nginx → Backend → PostgreSQL
- [04-auth-and-security.md](./04-auth-and-security.md) — JWT keys, cookie settings, RBAC model
- [05-multi-tenancy.md](./05-multi-tenancy.md) — firmId enforcement and lifecycle guard detail

## Source of truth

- `docs/_inventory/source-of-truth.md`

