# ELMS — Scale-to-Zero Migration Report
## Converting the Desktop/Local Runtime to a Deployed Web Application

**Report Date:** 2026-06-27
**Codebase Version:** `0.1.0`
**Author:** Generated via codebase analysis
**Scope:** All packages in the pnpm monorepo (`packages/backend`, `packages/frontend`, `packages/shared`, `apps/desktop`)

**Status:** Historical/archived planning report — the desktop app has since been removed and the migration this document proposed is now largely complete; see [docs/business/SAAS_CONVERSION_PLAN.md](../business/SAAS_CONVERSION_PLAN.md) for the current state.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Snapshot](#2-current-architecture-snapshot)
3. [What "Scale-to-Zero" Means for This System](#3-what-scale-to-zero-means-for-this-system)
4. [Gap Analysis — Desktop vs. Web](#4-gap-analysis--desktop-vs-web)
5. [Migration Steps](#5-migration-steps)
6. [Infrastructure Reference Architecture](#6-infrastructure-reference-architecture)
7. [Environment Variable Reference](#7-environment-variable-reference)
8. [Known Limitations and Deferred Work](#8-known-limitations-and-deferred-work)
9. [Rollback Plan](#9-rollback-plan)
10. [File Change Index](#10-file-change-index)

---

## 1. Executive Summary

ELMS (Electronic Legal Management System) is a **fully-featured multi-tenant legal practice management platform** built as a pnpm monorepo. Its backend is a **Fastify 5** REST API using **Prisma ORM** against PostgreSQL, and its frontend is a **React 18 SPA** (TanStack Router, TanStack Query, Ant Design, i18next).

The system was architected from the start to support two deployment topologies from a single codebase:

| Topology | Status (as of 2026-05-18) |
|---|---|
| **Desktop / Local** (Tauri 2, embedded PostgreSQL, in-memory sessions) | ✅ **Active production path** |
| **Cloud / Web** (Docker, managed PostgreSQL, Redis, Caddy/Nginx reverse proxy) | 🗄️ **Archived reference — non-operational in code** |

This report documents **every concrete step** required to convert the running desktop application into a fully web-deployed, multi-tenant SaaS application. The cloud infrastructure scaffolding already exists in `archive/cloud/`, which significantly reduces the migration effort. The primary work is:

1. Re-activating the cloud auth code path (currently hard-forced to `local`).
2. Removing/conditionally-branching around Tauri-specific frontend code.
3. Wiring real infrastructure: managed PostgreSQL, Redis, R2 storage, and a reverse proxy.
4. Hardening environment configuration for production.

> **Effort estimate:** A developer already familiar with this codebase should be able to complete Steps 1–16 in approximately **3–5 working days** with a pre-provisioned cloud environment.

---

## 2. Current Architecture Snapshot

### 2.1 Monorepo Layout

```
elms/
├── apps/
│   └── desktop/          # Tauri 2 Rust shell — DESKTOP ONLY
├── archive/
│   └── cloud/            # Archived Docker/Caddy configs — reference for web migration
├── packages/
│   ├── backend/          # Fastify 5 REST API, Prisma, BullMQ jobs
│   ├── frontend/         # React 18 SPA
│   └── shared/           # TypeScript DTOs, enums, Zod schemas
├── docs/
│   └── architecture/     # 13 architecture docs (authoritative)
└── scripts/              # Build, release, seed, perf utilities
```

### 2.2 Backend Modules (25 domain modules registered in `app.ts`)

| Module | Purpose |
|---|---|
| `auth` | Login, logout, setup, invite-accept |
| `firms` | Firm CRUD, settings |
| `roles` | Role and permission management |
| `users` | User CRUD and management |
| `invitations` | Cloud invite flow |
| `clients` | Client CRM |
| `cases` | Case lifecycle, assignments |
| `hearings` | Hearing scheduling |
| `tasks` | Task management |
| `dashboard` | Analytics and aggregates |
| `documents` | Upload, OCR, versioning, full-text search |
| `search` (global) | Cross-entity search |
| `lookups` | Firm-configurable lookup tables |
| `locations` | Egyptian governorate data |
| `billing` | Invoices, expenses |
| `notifications` | Multi-channel dispatch hub |
| `templates` | Document template generation |
| `reports` | Analytics exports |
| `library` | Law Library |
| `research` | AI research (Claude/Anthropic SSE streaming) |
| `import` | Data import utilities |
| `portal` | Client portal auth and views |
| `integrations` (Google Calendar) | Calendar sync |
| `powers` | Powers of attorney |
| `editions` / `license` | Edition policy and licensing |

### 2.3 The Critical Blockers (Code-Level)

There are **two files** that actively prevent cloud auth from working, identified in `README.md` as canonical source of truth:

**File 1: `packages/backend/src/config/env.ts` — Line 122**

```typescript
// Current code (blocks cloud):
const normalizedAuthMode = parsed.AUTH_MODE === AuthMode.CLOUD ? AuthMode.LOCAL : parsed.AUTH_MODE;
if (parsed.AUTH_MODE === AuthMode.CLOUD && !warnedAboutCloudAuthMode) {
  console.warn("[backend-startup] AUTH_MODE=cloud is deprecated and non-operational; forcing LOCAL mode");
}
```

**File 2: `packages/backend/src/modules/auth/createAuthService.ts`**

```typescript
// Current code (always returns local auth):
export function createAuthService(app: FastifyInstance, env: AppEnv): AuthService {
  if (env.AUTH_MODE !== AuthMode.LOCAL) {
    app.log.warn({ configuredAuthMode: env.AUTH_MODE },
      "Cloud auth mode is deprecated and non-operational; local auth service forced");
  }
  return createLocalAuthService(env);  // always local — never routes to cloud
}
```

### 2.4 Current Session Store (Desktop-Only)

`localSessionStore.ts` persists sessions to a JSON file at `.elms/local-session-store.json`. This is **not viable for web** because:
- It is in-process and not shared across multiple backend instances.
- It is file-system backed — unsuitable for containerised deployments.
- It uses a single `elms_local_session` cookie with no expiry rotation.

### 2.5 Async Job Architecture (Desktop vs. Cloud)

The extraction dispatcher (`packages/backend/src/jobs/extractionDispatcher.ts`) already contains the full bifurcation logic:

```typescript
if (env.STORAGE_DRIVER === "local") {
  setImmediate(() => { void runExtraction(documentId, env, storage); });  // desktop inline
} else {
  await getExtractionQueue(env).add("extract", { documentId, firmId });   // cloud BullMQ
}
```

Switching `STORAGE_DRIVER` to `r2` automatically routes through BullMQ — **no code change needed here**.

### 2.6 Frontend Tauri Dependencies

The frontend has two categories of Tauri-specific code:

1. **Hard Tauri API imports** — `@tauri-apps/api` (file system, dialog, native notifications)
2. **Conditional runtime branching** — `"__TAURI_INTERNALS__" in window` guards in `main.tsx`, `api.ts`, `desktopBackup.ts`, `desktopDownloads.ts`, `ppoScreenshotEvents.ts`

The conditional guards mean much of the desktop-specific code is already safely gated and will be unreachable in a browser context. However, some components import Tauri APIs at the module level which will fail to resolve in a non-Tauri build.

---

## 3. What "Scale-to-Zero" Means for This System

"Scale to zero" refers to deploying on infrastructure with no minimum running instances — billing and resource consumption only occur when requests are being handled.

### Target Deployment Model

| Component | Recommended Service | Scale-to-Zero |
|---|---|---|
| Backend API | Railway / Render / Fly.io / AWS ECS Fargate | ✅ Yes |
| Frontend SPA | Cloudflare Pages / Vercel / Netlify | ✅ Yes (CDN-edge) |
| PostgreSQL | Neon (serverless Postgres) / Railway | ✅ Yes (Neon scales to zero) |
| Redis | Upstash (serverless Redis) | ✅ Yes (per-request billing) |
| File Storage | Cloudflare R2 | ✅ Yes (per-request) |
| BullMQ Workers | Co-located with backend container | ✅ Yes |
| Email | Resend (SMTP relay) or Sendgrid | ✅ Yes |
| SMS | Twilio | ✅ Yes |

> **Important:** The backend is a long-lived Fastify HTTP server. True serverless (Lambda-style) function deployment is NOT recommended because:
> - BullMQ workers require persistent Redis connections.
> - In-memory rate-limiting state is process-scoped.
> - Prisma cold start times are significant on Lambda.
>
> Use **container-based scale-to-zero** (Railway, Render, Fly.io) rather than function-based serverless (Lambda, Vercel Functions).

---

## 4. Gap Analysis — Desktop vs. Web (planned, at time of writing)

| Concern | Desktop (Current) | Web (Required) | Gap |
|---|---|---|---|
| **Auth mode (planned change)** | `AUTH_MODE=local` (forced in code) | `AUTH_MODE=cloud` | ⚠️ Code change required |
| **Session store** | In-memory + JSON file | Redis (refresh tokens) | ⚠️ Redis required |
| **JWT keys** | Auto-generated dev RSA keys | Persistent RSA key pair | ⚠️ Config required |
| **Database** | Embedded PG on port 5433 | Managed PG on port 5432 | ✅ Config only |
| **File storage** | Local filesystem `./uploads` | Cloudflare R2 | ⚠️ Config only |
| **Async jobs** | `setImmediate` inline | BullMQ + Redis | ✅ Auto-switches with storage driver |
| **Worker process** | Runs inside Fastify process | Separate container/process | ⚠️ Deployment config required |
| **Reverse proxy** | None (localhost only) | Caddy/Nginx + TLS | ⚠️ Infrastructure required |
| **CORS** | `tauri://localhost` origins | Production domain | ⚠️ Config change required |
| **Multi-firm registration** | Single firm, local setup | Cloud register endpoint | ✅ Code exists in `cloudAuthService.ts` |
| **Tauri APIs (frontend)** | Used throughout | Must be absent/guarded | ⚠️ Code audit + build config |
| **Desktop-only components** | `DesktopBootstrapGate`, backup, license | Not rendered in browser | ⚠️ Conditional guards needed |
| **Email notifications** | Optional (SMTP config) | Required for invite flow | ⚠️ Config required |
| **License enforcement** | Desktop license file | Edition/subscription DB field | ✅ DB-driven, works in cloud |
| **OCR (Tesseract)** | Ships with desktop bundle | Installed in container image | ⚠️ Dockerfile dependency |
| **LibreOffice (DOCX preview)** | Available on user machine | Must be in container | ⚠️ Dockerfile dependency |

---

## 5. Migration Steps

---

### Step 1 — Re-activate Cloud Authentication

This is the single most important step. Two source files enforce the local-only restriction.

#### Change 1: `packages/backend/src/config/env.ts`

Remove the (deprecated) forced override that converted `AUTH_MODE=cloud` to `AUTH_MODE=local`:

```diff
- let warnedAboutCloudAuthMode = false;
  ...
- const normalizedAuthMode = parsed.AUTH_MODE === AuthMode.CLOUD ? AuthMode.LOCAL : parsed.AUTH_MODE;
-
- if (parsed.AUTH_MODE === AuthMode.CLOUD && !warnedAboutCloudAuthMode) {
-   console.warn("[backend-startup] AUTH_MODE=cloud is deprecated and non-operational; forcing LOCAL mode");
-   warnedAboutCloudAuthMode = true;
- }
+ const normalizedAuthMode = parsed.AUTH_MODE;
```

The `baseSchema` already declares `AUTH_MODE: z.nativeEnum(AuthMode).default(AuthMode.LOCAL)`, so setting `AUTH_MODE=cloud` in the environment worked once this planned override removal landed. No other changes to this file were needed.

#### Change 2: `packages/backend/src/modules/auth/createAuthService.ts`

Re-activate routing between local and cloud auth services:

```diff
  import { AuthMode } from "@elms/shared";
  import type { FastifyInstance } from "fastify";
  import type { AppEnv } from "../../config/env.js";
  import type { AuthService } from "./auth.types.js";
  import { createLocalAuthService } from "./localAuthService.js";
+ import { createCloudAuthService } from "./cloudAuthService.js";

  export function createAuthService(app: FastifyInstance, env: AppEnv): AuthService {
-   if (env.AUTH_MODE !== AuthMode.LOCAL) {
-     app.log.warn(
-       { configuredAuthMode: env.AUTH_MODE },
-       "Cloud auth mode is deprecated and non-operational; local auth service forced"
-     );
-   }
-   return createLocalAuthService(env);
+   if (env.AUTH_MODE === AuthMode.CLOUD) {
+     app.log.info({ authMode: env.AUTH_MODE }, "using cloud auth service");
+     return createCloudAuthService(app, env);
+   }
+   app.log.info({ authMode: env.AUTH_MODE }, "using local auth service");
+   return createLocalAuthService(env);
  }
```

> **Note:** `cloudAuthService.ts` is fully implemented — JWT signing, Redis refresh token storage, register, login, logout, and refresh flows are all complete. It simply was not being called.

---

### Step 2 — Switch Session and Token Model

With `AUTH_MODE=cloud` (planned), the cloud auth service uses:

- **Access token:** RS256 JWT in `HttpOnly` cookie `accessToken` (15-minute TTL)
- **Refresh token:** UUID stored in Redis as `refresh:<uuid>` → `userId` (30-day TTL)

The existing `sessionContext.ts` plugin already handles both modes via `env.AUTH_MODE`. No changes are needed there.

**Cookie attributes to verify for production** in `packages/backend/src/plugins/sessionContext.ts`:

```typescript
httpOnly: true,
secure: env.NODE_ENV === "production",   // HTTPS only in prod
sameSite: "lax",
domain: env.COOKIE_DOMAIN,
```

Set `COOKIE_DOMAIN` to your production domain (e.g., `elms.yourfirm.com` or `.elms.app`).

---

### Step 3 — Re-enable Redis for Jobs and Tokens

Redis is required for:
1. **Refresh token storage** — `cloudAuthService.ts` uses `ioredis`
2. **BullMQ job queues** — extraction, library extraction, DOCX preview, and reminder scan

```bash
# Environment variable:
REDIS_URL=redis://your-redis-host:6379
# Or with auth/TLS (Upstash):
REDIS_URL=rediss://:your-password@your-instance.upstash.io:6380
```

`ioredis` is already in `packages/backend/package.json`. No code changes needed.

**Recommended managed Redis providers (scale-to-zero):**

| Provider | Free Tier | Notes |
|---|---|---|
| **Upstash** | 10k commands/day | True per-request billing; TLS by default; use `rediss://` URL |
| **Railway** | Shared with app plan | Simple; good for staging |
| **Redis Cloud** | 30 MB free | Good for production |

---

### Step 4 — Switch Storage Driver to Cloudflare R2

The storage adapter factory in `packages/backend/src/storage/index.ts` already supports both local and R2:

```typescript
export function createStorageAdapter(env: AppEnv): IStorageAdapter {
  if (env.STORAGE_DRIVER === "local") return new LocalStorageAdapter(env);
  if (env.STORAGE_DRIVER === "r2") return new R2StorageAdapter(env);
  throw new Error(`Unknown STORAGE_DRIVER: ${env.STORAGE_DRIVER}`);
}
```

**Environment variables required:**

```bash
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_BUCKET=elms-documents
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_PUBLIC_DOMAIN=https://your-r2-public-bucket-domain.com
```

**Important side effect:** Setting `STORAGE_DRIVER=r2` automatically routes document extraction through BullMQ instead of `setImmediate`. This is the correct cloud behaviour. No code change needed.

**Cloudflare R2 setup:**
1. Go to Cloudflare dashboard → R2 → Create bucket (e.g., `elms-documents`)
2. Create an R2 API token with Object Read & Write permission scoped to that bucket
3. Enable public access on the bucket or configure a custom domain for `R2_PUBLIC_DOMAIN`

---

### Step 5 — Deploy PostgreSQL as a Managed Service

The Prisma schema is standard PostgreSQL 16. Any managed PostgreSQL 14+ service works.

```bash
DATABASE_URL=postgresql://elms:strongpassword@your-db-host:5432/elms_cloud?schema=public
```

**Scale-to-zero options:**

| Provider | Notes |
|---|---|
| **Neon** | True serverless Postgres; scales to zero; generous free tier; connection pooling built-in |
| **Railway** | Provisioned with deploy button; simple |
| **Supabase** | Full-featured; pauses on inactivity in free tier |
| **PlanetScale** | MySQL-only — **not compatible** |

**Connection pool tuning:**

```bash
DATABASE_URL=postgresql://...?connection_limit=25&pool_timeout=15
```

For Neon/connection-pooled providers, set `connection_limit=5` and let the provider's pooler manage real connections.

> **⚠️ Do NOT use the desktop port (5433).** Cloud deployments use standard PostgreSQL port 5432.

---

### Step 6 — Remove Tauri-Specific Frontend Code

#### 6.1 Files Requiring Action

| File | Tauri Usage | Action |
|---|---|---|
| `src/lib/api.ts` | `__TAURI_INTERNALS__` guard, `VITE_DESKTOP_SHELL` env var | ✅ Already guarded — safe |
| `src/lib/desktopBackup.ts` | `@tauri-apps/api` dialog, fs | ⚠️ Wrap in Tauri guard or remove from web build |
| `src/lib/desktopDownloads.ts` | `@tauri-apps/api` fs | ⚠️ Same as above |
| `src/lib/ppoScreenshotEvents.ts` | Tauri event listener | ⚠️ Guard or stub |
| `src/components/shared/DesktopBootstrapGate.tsx` | Desktop startup gate | ⚠️ Must render children unconditionally in browser |
| `src/pwa/offlineBanner.tsx` | PWA offline banner | ✅ Safe — no Tauri dependency |
| `src/pwa/syncQueue.ts` | IndexedDB sync queue | ✅ Already guarded in `main.tsx` |

#### 6.2 Build Configuration for Web

Set these Vite environment variables to `false`/`""` for the web build:

```bash
# In .env for web deployment:
VITE_DESKTOP_SHELL=false
VITE_DESKTOP_RUNTIME_VARIANT=web
VITE_API_BASE_URL=/api
```

The `api.ts` client already uses `VITE_DESKTOP_SHELL` to branch behavior:
```typescript
const isDesktopShell = import.meta.env.VITE_DESKTOP_SHELL === "true";
```

With this set to `false`, the desktop-specific URL probing, local session token headers, and bootstrap polling are all bypassed automatically.

#### 6.3 DesktopBootstrapGate Short-Circuit

`DesktopBootstrapGate.tsx` gates the app behind a startup check that polls `/api/health` and waits for the Tauri sidecar. In a web context, add a short-circuit:

```typescript
// Add near the top of DesktopBootstrapGate component:
if (!isDesktopShell) {
  return <>{children}</>;
}
```

#### 6.4 Vite Config Update

For the web build, update `packages/frontend/vite.config.ts` to allow binding to all interfaces (not just `127.0.0.1`):

```typescript
export default defineConfig(({ mode }) => ({
  // ...existing config...
  server: {
    host: mode === "desktop" ? "127.0.0.1" : "0.0.0.0",
    port: 5173
  }
}));
```

---

### Step 7 — Containerise the Backend

The archived Dockerfile at `archive/cloud/apps/web/backend.Dockerfile` provides the correct pattern. Create an updated version:

**`packages/backend/Dockerfile` (production):**

```dockerfile
FROM node:22-alpine AS base
WORKDIR /workspace
RUN corepack enable

# System dependencies for OCR and DOCX preview
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-ara \
    tesseract-ocr-data-eng \
    tesseract-ocr-data-fra \
    libreoffice \
    python3

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/backend/package.json packages/backend/package.json
COPY packages/frontend/package.json packages/frontend/package.json
RUN pnpm install --frozen-lockfile --filter @elms/backend --filter @elms/shared

COPY packages/shared/ packages/shared/
COPY packages/backend/ packages/backend/
RUN pnpm prisma:generate && pnpm --filter @elms/backend build

# Production image (multi-stage)
FROM node:22-alpine
WORKDIR /workspace
RUN corepack enable
RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-ara tesseract-ocr-data-eng libreoffice

COPY --from=base /workspace/packages/backend/dist/ ./packages/backend/dist/
COPY --from=base /workspace/packages/backend/node_modules/ ./packages/backend/node_modules/
COPY --from=base /workspace/packages/backend/prisma/ ./packages/backend/prisma/
COPY --from=base /workspace/node_modules/ ./node_modules/
COPY packages/backend/*.traineddata ./packages/backend/

EXPOSE 7854
CMD ["node", "packages/backend/dist/cloud/server.js"]
```

> **Note:** `packages/backend/dist/cloud/server.js` is the cloud entry point. Confirm this path in `tsup.config.ts` — the backend has separate `cloud` and `desktop` build outputs.

---

### Step 8 — Containerise and Serve the Frontend

The frontend builds to `packages/frontend/dist/` as static assets. Serve with Caddy:

**`Dockerfile.frontend`:**

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/frontend/package.json packages/frontend/package.json
RUN pnpm install --frozen-lockfile --filter @elms/frontend --filter @elms/shared

COPY packages/shared/ packages/shared/
COPY packages/frontend/ packages/frontend/
RUN pnpm prisma:generate && pnpm --filter @elms/frontend build

FROM caddy:2-alpine
COPY --from=builder /workspace/packages/frontend/dist /srv
COPY archive/cloud/apps/web/Caddyfile /etc/caddy/Caddyfile
```

**Vite build environment variables** (pass at Docker build time):

```bash
VITE_API_BASE_URL=/api          # Relative — Caddy proxies /api to backend
VITE_DESKTOP_SHELL=false
VITE_SENTRY_DSN=https://...     # Optional
VITE_FOOTER_NAME="Your Firm"
```

---

### Step 9 — Wire the Reverse Proxy / TLS

The archived `archive/cloud/apps/web/Caddyfile` provides automatic HTTPS via Let's Encrypt. Move it to the active deployment path:

**`Caddyfile` (production template):**

```caddyfile
{$ELMS_DOMAIN} {
    tls {$ACME_EMAIL}

    handle /api/* {
        reverse_proxy backend:7854
    }

    handle {
        root * /srv
        try_files {path} /index.html
        file_server
    }
}
```

**`docker-compose.prod.yml`** already exists at `archive/cloud/apps/web/docker-compose.prod.yml`. Move it to an active location (`ops/docker-compose.prod.yml`) and update image names to match your registry.

---

### Step 10 — Run the Extraction Worker as a Separate Process

In cloud mode, document extraction runs through BullMQ. The worker entrypoints already exist in the compiled output:

```
packages/backend/dist/cloud/jobs/extractionWorker.js
packages/backend/dist/cloud/jobs/libraryExtractionWorker.js
packages/backend/dist/cloud/jobs/docxPreviewWorker.js
```

**Option A — Same container, shell script (simplest for staging):**

```bash
# entrypoint.sh
#!/bin/sh
node packages/backend/dist/cloud/jobs/extractionWorker.js &
node packages/backend/dist/cloud/jobs/libraryExtractionWorker.js &
node packages/backend/dist/cloud/jobs/docxPreviewWorker.js &
node packages/backend/dist/cloud/server.js
```

**Option B — Separate `worker` service in docker-compose (recommended for production):**

```yaml
extraction-worker:
  image: elms-backend:${VERSION}
  command: ["node", "packages/backend/dist/cloud/jobs/extractionWorker.js"]
  environment:
    REDIS_URL: ${REDIS_URL}
    DATABASE_URL: ${DATABASE_URL}
    STORAGE_DRIVER: r2
    # ... R2 vars, EXTRACTION_WORKER_CONCURRENCY
  depends_on:
    redis:
      condition: service_healthy
    postgres:
      condition: service_healthy
  restart: unless-stopped
```

This allows independent horizontal scaling. Each worker runs with `concurrency: 3` (configurable via `EXTRACTION_WORKER_CONCURRENCY`).

---

### Step 11 — Configure Environment Variables for Production

**Generate JWT keys (required for production):**

```bash
# Generate RSA 2048 private key
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt_private.pem

# Derive public key
openssl rsa -pubout -in jwt_private.pem -out jwt_public.pem
```

**Complete production `.env` for cloud (planned template, at time of writing):**

```bash
# Runtime mode
NODE_ENV=production
AUTH_MODE=cloud # planned
STORAGE_DRIVER=r2

# Server
HOST=0.0.0.0
BACKEND_PORT=7854

# Database — use managed PostgreSQL
DATABASE_URL=postgresql://elms:STRONG_PASSWORD@your-db.neon.tech:5432/elms_cloud?schema=public&connection_limit=25

# Redis — use managed Redis (Upstash recommended)
REDIS_URL=rediss://:PASSWORD@your-instance.upstash.io:6380

# Auth
COOKIE_DOMAIN=.elms.yourfirm.com
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=30
JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...

# CORS
ALLOWED_ORIGINS=https://elms.yourfirm.com

# File storage — Cloudflare R2
MAX_UPLOAD_BYTES=52428800
R2_ACCOUNT_ID=your_account_id
R2_BUCKET=elms-documents
R2_ACCESS_KEY_ID=your_r2_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret
R2_PUBLIC_DOMAIN=https://pub-xxx.r2.dev

# OCR and AI
OCR_BACKEND=tesseract
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
AI_MONTHLY_LIMIT=500

# Email (SMTP or Resend relay)
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=re_your_resend_api_key
SMTP_FROM=noreply@elms.yourfirm.com

# SMS (optional)
SMS_PROVIDER=none

# Monitoring
SENTRY_DSN=https://xxx@oyyy.ingest.sentry.io/zzz

# Workers
EXTRACTION_WORKER_CONCURRENCY=3
```

---

### Step 12 — Configure CORS and Cookie Security

The CORS plugin (`packages/backend/src/plugins/cors.ts`) reads `env.ALLOWED_ORIGINS` as a comma-separated list. In production:

```bash
ALLOWED_ORIGINS=https://elms.yourfirm.com
```

The desktop Tauri origins (`tauri://localhost`, `http://tauri.localhost`) must be **removed** from the production web `.env`.

**Cookie domain** — Set to your apex domain with a leading dot for subdomain coverage:

```bash
COOKIE_DOMAIN=.yourfirm.com
```

---

### Step 13 — Set Up Email and SMS Notifications

Email is required for the invitation flow in cloud mode. Without SMTP, users cannot receive invite links.

**Using Resend (recommended):**

```bash
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=re_xxxx
SMTP_FROM=noreply@yourdomain.com
```

**Using SendGrid:**

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxx
SMTP_FROM=noreply@yourdomain.com
```

**SMS (optional):** Set `SMS_PROVIDER=twilio` and fill `SMS_ACCOUNT_SID`, `SMS_AUTH_TOKEN`, `SMS_FROM_NUMBER` to enable SMS for editions with the `sms_reminders` feature.

---

### Step 14 — Enable Sentry Error Monitoring

**Backend:**

```bash
SENTRY_DSN=https://xxx@oyyy.ingest.sentry.io/zzz
```

The backend already calls `initializeBackendMonitoring(env, app)` in `app.ts`.

**Frontend (build-time variable):**

```bash
VITE_SENTRY_DSN=https://xxx@oyyy.ingest.sentry.io/zzz
```

The frontend already initialises Sentry in `main.tsx` with PII scrubbing.

---

### Step 15 — Run Database Migrations in Production

The archived docker-compose already has a `migrate` service. For manual deployments:

```bash
# Apply pending migrations against production database
DATABASE_URL="postgresql://..." pnpm --filter @elms/backend prisma migrate deploy
```

> **⚠️ Never run `prisma migrate dev` in production.** Use `prisma migrate deploy`.

---

### Step 16 — Update CI/CD Pipeline

The existing `.github/workflows/ci.yml` handles linting, type checking, tests, and builds. Add a cloud deployment workflow:

**`.github/workflows/deploy-cloud.yml`:**

```yaml
name: Deploy Cloud
on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10.27.0

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma:generate
      - run: pnpm build

      - name: Build and push backend Docker image
        run: |
          docker build -f packages/backend/Dockerfile \
            -t your-registry/elms-backend:${{ github.sha }} .
          docker push your-registry/elms-backend:${{ github.sha }}

      - name: Build and push frontend Docker image
        run: |
          docker build -f Dockerfile.frontend \
            -t your-registry/elms-frontend:${{ github.sha }} .
          docker push your-registry/elms-frontend:${{ github.sha }}

      - name: Run migrations
        run: |
          DATABASE_URL="${{ secrets.DATABASE_URL }}" \
          pnpm --filter @elms/backend exec prisma migrate deploy

      - name: Deploy
        run: railway up  # or: fly deploy, render deploy
```

---

### Step 17 — Registration and Multi-Tenancy Readiness

In cloud mode, new firms register via `POST /api/auth/register` (implemented in `cloudAuthService.ts`). Each firm gets:

- A `Firm` record with a unique slug
- A `FirmSettings` record (timezone, currency, preferred language)
- A system admin `Role`
- The first `User` (firm admin)
- A 30-day trial period (`trialStartedAt`, `trialEndsAt`)

**Multi-tenant isolation** is enforced via the `injectTenant` middleware that strips externally-supplied `X-Firm-ID` headers and injects `firmId` from the JWT claim. This is already production-ready.

**Invitation flow:** New users join via `POST /api/auth/accept-invite` (in `cloudAuthService.ts`). Requires email to be configured (Step 13).

---

### Step 18 — Licensing and Edition Enforcement

Desktop licensing (`DESKTOP_LICENSE_PUBLIC_KEY`, `.elms.license` file) is not relevant for web deployment. Cloud licensing is purely DB-driven:

- Each `Firm` has an `editionKey` field: `solo_offline`, `solo_online`, `local_firm_offline`, `local_firm_online`, or `enterprise`
- Edition-gated features are checked at service layer against `actor.firm.editionKey`
- The firm lifecycle scheduler transitions firms through `ACTIVE → GRACE → SUSPENDED → PENDING_DELETION` based on `trialEndsAt` and `graceEndsAt`

For a SaaS web deployment, integrate a payment provider (Stripe, Paymob) to automatically upgrade `editionKey` on subscription events. `PAYMOB_API_KEY` is already declared in `.env.example`.

---

### Step 19 — Security Hardening Checklist

```
☐ JWT_PRIVATE_KEY and JWT_PUBLIC_KEY set (never auto-generated in production)
☐ DATABASE_URL uses a strong password — not the dev defaults (elms:elms)
☐ REDIS_URL uses TLS (rediss://) in production
☐ ALLOWED_ORIGINS set to production domain only (no Tauri origins)
☐ COOKIE_DOMAIN set to production domain
☐ NODE_ENV=production (enables secure cookies, disables dev key generation)
☐ DESKTOP_LICENSE_PUBLIC_KEY removed or left empty (not needed for web)
☐ ELMS_ENABLE_SWAGGER=false (or unset) — disabled in production by default
☐ Rate limiting is active (@fastify/rate-limit is registered in app.ts)
☐ CORS restricted to production origins only
☐ HTTPS enforced by Caddy/Nginx (not by the Node.js process itself)
☐ R2 bucket set to private — only backend accesses it directly
☐ SENTRY_DSN set for both frontend and backend
☐ MAX_UPLOAD_BYTES configured (default 50 MB)
☐ AI_MONTHLY_LIMIT configured per expected firm usage
☐ Log driver set to json-file with rotation in docker-compose
```

---

### Step 20 — Smoke Test and Go-Live

**Pre-launch smoke tests:**

```bash
# Health check
curl https://elms.yourfirm.com/api/health
# Expected: { "ok": true, "status": "ok", "checks": { "db": "ok" } }

# Register a new firm
curl -X POST https://elms.yourfirm.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firmName":"Test Firm","email":"admin@testfirm.com","fullName":"Admin User","password":"securepassword"}'

# Login
curl -X POST https://elms.yourfirm.com/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"admin@testfirm.com","password":"securepassword"}'

# Access protected route
curl https://elms.yourfirm.com/api/users/me -b cookies.txt

# Upload a document
curl -X POST https://elms.yourfirm.com/api/documents \
  -b cookies.txt \
  -F "file=@test.pdf" \
  -F "name=Test Document"
```

**User acceptance tests:**
- Register a new firm → login → create a client → create a case → upload a document → verify OCR extraction completes (check `extractionStatus` on document)
- Invite a second user → accept invite via email link → verify multi-user access
- Test notification preferences → trigger a hearing reminder scan

---

## 6. Infrastructure Reference Architecture

```
                                Internet
                                   │
                        ┌──────────┴──────────┐
                        │   Caddy Edge (TLS)   │
                        │   Port 80/443        │
                        └──────────┬──────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                     │
       /api/* → Backend:7854  /* → Frontend:80    (WS future)
              │                    │
    ┌─────────┴──────┐    ┌────────┴────────┐
    │  Fastify 5 API  │    │  React SPA      │
    │  (Node 22)      │    │  (Static files) │
    └────────┬────────┘    └─────────────────┘
             │
    ┌────────┼───────────────┐
    │        │               │
  PG 5432  Redis 6379     R2 Storage
  (Neon/   (Upstash)     (Cloudflare)
  Supabase)
             │
    ┌────────┴────────┐
    │ BullMQ Workers  │
    │ - extraction    │
    │ - library       │
    │ - docx-preview  │
    │ - reminders     │
    └─────────────────┘
```

---

## 7. Environment Variable Reference

| Variable | Required for Web | Desktop Value | Cloud Web Value |
|---|---|---|---|
| `NODE_ENV` | ✅ | `development` | `production` |
| `AUTH_MODE` | ✅ | `local` | `cloud` |
| `STORAGE_DRIVER` | ✅ | `local` | `r2` |
| `DATABASE_URL` | ✅ | `...5433/elms_cloud` | `...5432/elms_cloud` |
| `REDIS_URL` | ✅ | Not used | `rediss://...upstash.io:6380` |
| `JWT_PRIVATE_KEY` | ✅ | Auto-generated | RSA 2048 PEM |
| `JWT_PUBLIC_KEY` | ✅ | Auto-generated | Derived PEM |
| `COOKIE_DOMAIN` | ✅ | `localhost` | `.yourfirm.com` |
| `ALLOWED_ORIGINS` | ✅ | `tauri://localhost,...` | `https://elms.yourfirm.com` |
| `R2_ACCOUNT_ID` | ✅ | — | Cloudflare account ID |
| `R2_BUCKET` | ✅ | — | `elms-documents` |
| `R2_ACCESS_KEY_ID` | ✅ | — | R2 API key |
| `R2_SECRET_ACCESS_KEY` | ✅ | — | R2 API secret |
| `R2_PUBLIC_DOMAIN` | ✅ | — | `https://pub-xxx.r2.dev` |
| `SMTP_HOST` | ✅ (for invites) | — | `smtp.resend.com` |
| `SMTP_PORT` | ✅ | `587` | `465` |
| `SMTP_USER` | ✅ | — | `resend` |
| `SMTP_PASS` | ✅ | — | Resend API key |
| `SMTP_FROM` | ✅ | — | `noreply@yourfirm.com` |
| `ANTHROPIC_API_KEY` | Optional | — | `sk-ant-...` |
| `SENTRY_DSN` | Optional | — | Sentry DSN |
| `VITE_DESKTOP_SHELL` | ✅ (frontend) | `true` | `false` |
| `VITE_API_BASE_URL` | ✅ (frontend) | `http://127.0.0.1:7854` | `/api` |
| `VITE_SENTRY_DSN` | Optional | — | Sentry DSN |
| `DESKTOP_LICENSE_PUBLIC_KEY` | ❌ Not needed | Set | Omit |
| `DESKTOP_FRONTEND_URL` | ❌ Not needed | `http://127.0.0.1:5173` | Omit |
| `DESKTOP_BACKEND_URL` | ❌ Not needed | `http://127.0.0.1:7854` | Omit |

---

## 8. Known Limitations and Deferred Work

| Limitation | Impact | Resolution Path |
|---|---|---|
| No WebSocket / SSE for real-time notifications | Desktop OS channel is a no-op in cloud mode | Implement SSE endpoint or WebSocket for real-time in-app notifications |
| Single Redis instance (no Sentinel/Cluster) | Auth refresh single point of failure | Configure Redis Sentinel or use Upstash (auto-HA) |
| No per-firm storage quota | Unlimited R2 usage | Implement per-firm quota tracking and enforcement |
| Tesseract WASM in Node.js worker | High memory on large PDFs | Use Google Vision API (`OCR_BACKEND=google_vision`) or dedicated OCR service |
| No built-in BullMQ dashboard | Cannot inspect queue depth from UI | Mount `@bull-board/fastify` plugin in development |
| LibreOffice DOCX preview in container | Large container image (~500 MB) | Use a dedicated DOCX preview microservice (Gotenberg) |
| AI usage counted at query time | Extra COUNT query per research request | Cache in Redis counter keyed by `firmId:year:month` |
| No rate limit on document uploads | Potential storage abuse | Add per-firm daily upload limits |
| `register` endpoint needs strict rate limiting | Abuse potential | Add strict rate limiting (5 req/min per IP) on `/api/auth/register` |
| No read replicas | All DB load on one node | Add replica and route SELECT queries via Prisma read replicas |
| DOCX preview binary path (`libreoffice`) hardcoded | May differ by OS | Make `DOCX_PREVIEW_BIN` explicit in environment |

---

## 9. Rollback Plan

The desktop build is fully independent of the cloud deployment. If the cloud migration encounters issues:

1. The desktop application continues to function without any changes.
2. The cloud activation changes are minimal — only 2 source files changed.
3. To rollback cloud auth: revert `env.ts` and `createAuthService.ts` to the previous versions.
4. Data migrated to managed PostgreSQL can be exported with `pg_dump` and restored to the desktop embedded PostgreSQL.

**No destructive changes are required to the existing desktop workflow during this migration.**

---

## 10. File Change Index

### Files that MUST be changed (code changes)

| File | Change | Priority |
|---|---|---|
| `packages/backend/src/config/env.ts` | Remove forced `AUTH_MODE=local` override | 🔴 Critical |
| `packages/backend/src/modules/auth/createAuthService.ts` | Re-enable cloud auth service routing | 🔴 Critical |

### Files that MUST be changed (build/config)

| File | Change | Priority |
|---|---|---|
| `packages/frontend/.env.production` (new) | Set `VITE_DESKTOP_SHELL=false`, `VITE_API_BASE_URL=/api` | 🔴 Critical |
| `.env.production` (new) | Full production environment configuration | 🔴 Critical |
| `packages/backend/Dockerfile` (new) | Production backend image with Tesseract/LibreOffice | 🔴 Critical |
| `Dockerfile.frontend` (new) | Frontend static asset image | 🔴 Critical |

### Files that SHOULD be changed (frontend guards)

| File | Change | Priority |
|---|---|---|
| `packages/frontend/src/components/shared/DesktopBootstrapGate.tsx` | Short-circuit when `VITE_DESKTOP_SHELL=false` | 🟡 Important |
| `packages/frontend/src/lib/desktopBackup.ts` | Guard Tauri API calls behind `isDesktopShell` | 🟡 Important |
| `packages/frontend/src/lib/desktopDownloads.ts` | Same as above | 🟡 Important |
| `packages/frontend/src/lib/ppoScreenshotEvents.ts` | Guard Tauri event listener | 🟡 Important |

### Files that can be PROMOTED from archive

| File | Action | Priority |
|---|---|---|
| `archive/cloud/apps/web/docker-compose.prod.yml` | Promote to `ops/docker-compose.prod.yml` | 🟡 Important |
| `archive/cloud/apps/web/Caddyfile` | Promote to active config | 🟡 Important |
| `archive/cloud/apps/web/backend.Dockerfile` | Use as reference for new Dockerfile | 🟢 Reference |
| `archive/cloud/apps/web/.env.production.example` | Promote and expand as `.env.production.example` | 🟢 Reference |

### Files that require NO changes

| File | Why |
|---|---|
| `packages/backend/src/storage/index.ts` | Already switches on `STORAGE_DRIVER` env var |
| `packages/backend/src/jobs/extractionDispatcher.ts` | Already switches on `STORAGE_DRIVER` env var |
| `packages/backend/src/modules/auth/cloudAuthService.ts` | Fully implemented, just not called |
| `packages/backend/prisma/schema.prisma` | Standard PostgreSQL — works for both topologies |
| `packages/backend/src/middleware/injectTenant.ts` | Multi-tenancy enforcement already production-ready |
| `packages/frontend/src/pwa/syncQueue.ts` | Already guarded for browser-only use |
| `packages/frontend/src/main.tsx` | Already correctly guards sync queue with `__TAURI_INTERNALS__` check |
| `packages/shared/` | Pure TypeScript — no deployment dependency |

---

*End of Report*

> **Source of truth for this report:**
> - `packages/backend/src/app.ts`
> - `packages/backend/src/config/env.ts`
> - `packages/backend/src/modules/auth/createAuthService.ts`
> - `packages/frontend/src/router.tsx`
> - `packages/backend/prisma/schema.prisma`
> - `docs/architecture/01-system-overview.md` through `13-scalability-and-limits.md`
> - `archive/cloud/apps/web/docker-compose.prod.yml`
> - `package.json` (root workspace)
