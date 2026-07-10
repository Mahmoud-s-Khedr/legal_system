# ELMS — Web Dev Environment Guide

This guide sets up a **local development environment that mirrors production as closely as possible**:

| Setting | Dev | Production |
|---|---|---|
| `AUTH_MODE` | `cloud` | `cloud` |
| `STORAGE_DRIVER` | `r2` → MinIO | `r2` → MinIO |
| `REDIS_URL` | local Docker container | local Docker container |
| Database | local Docker container (PostgreSQL 16) | local Docker container (PostgreSQL 16) |
| Backend hot-reload | ✅ tsx watch (no compile step) | ❌ built image |
| Frontend hot-reload | ✅ Vite dev server | ❌ built image + Nginx |
| TLS | ❌ plain HTTP on localhost | ✅ Caddy + Let's Encrypt |
| BullMQ workers | Optional (run separately) | Always running |
| Email | Optional (SMTP empty → silently skipped) | Resend required |

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 22+ | [nodejs.org](https://nodejs.org) |
| pnpm | 10.27.0 | `corepack enable && corepack prepare pnpm@10.27.0 --activate` |
| Docker | 24+ with Compose plugin | [docs.docker.com](https://docs.docker.com) |

---

## First-Time Setup

### Step 1 — Install dependencies

```bash
# From the repo root
pnpm install
pnpm prisma:generate
```

### Step 2 — Start infrastructure

```bash
# Start PostgreSQL + Redis + MinIO (runs in background)
docker compose -f ops/docker-compose.dev.yml up -d
```

Wait ~10 seconds for the containers to be healthy and for MinIO to create the `elms-documents` bucket.

Verify everything is up:

```bash
docker compose -f ops/docker-compose.dev.yml ps
# All services should show "healthy" or "exited 0" (minio-init)
```

### Step 3 — Configure the env file

The backend reads `ops/.env.web-dev`. Review it and optionally fill in optional values:

```bash
# Already provided — works out of the box for basic dev.
# Optionally add:
SMTP_PASS=re_your_resend_key         # For testing invitation emails
ANTHROPIC_API_KEY=sk-ant-...         # For AI research features
```

> **JWT keys** are auto-generated in `NODE_ENV=development`. You don't need to generate them for local dev unless you want stable tokens across server restarts.

### Step 4 — Apply database migrations

```bash
# Run Prisma migrations against the local dev database
DATABASE_URL="postgresql://elms:elms@127.0.0.1:5432/elms_cloud?schema=public" \
  pnpm --filter @elms/backend exec prisma migrate deploy --schema packages/backend/prisma/schema.prisma
```

### Step 5 — Seed the database (optional but recommended)

```bash
pnpm seed:web
```

This populates the database with realistic demo data (firms, users, cases, clients, documents).

### Step 6 — Start the dev servers

```bash
# Terminal 1 — Backend (hot-reload) + Frontend (Vite HMR)
pnpm dev:web
```

The app is now running at:

| Service | URL |
|---|---|
| **App (frontend)** | http://localhost:5173 |
| **API** | http://localhost:7854/api |
| **Swagger UI** | http://localhost:7854/documentation |
| **MinIO Console** | http://localhost:9001 |

---

## Running BullMQ Workers (for document upload / OCR / DOCX preview)

Workers process documents uploaded to MinIO. They are **optional for basic dev** but required to test document upload, OCR extraction, and DOCX preview.

Workers run compiled JS, so you need to build the cloud target first:

```bash
# Terminal 2 — Build cloud output, then start all 3 workers
pnpm dev:web:workers
```

This runs `build:cloud` once, then starts:
- `extraction-worker` — PDF/image OCR via Tesseract
- `library-worker` — Law Library document extraction
- `docx-worker` — DOCX → PDF preview via LibreOffice

> **Note:** Workers require LibreOffice and Tesseract to be installed locally for DOCX preview and OCR. On Linux:
> ```bash
> sudo apt install tesseract-ocr tesseract-ocr-ara tesseract-ocr-eng libreoffice
> ```
> If you skip this, document upload still works — files are stored in MinIO, but OCR extraction will fail/queue without workers. The app remains usable.

---

## Dev Workflow Summary

```
Terminal 1 (always):
  pnpm dev:web                  # backend hot-reload + Vite HMR

Terminal 2 (for document features):
  pnpm dev:web:workers          # BullMQ workers (build once, then watch)

Infrastructure (start once, keep running):
  docker compose -f ops/docker-compose.dev.yml up -d
```

---

## Infrastructure Services

### PostgreSQL
- **Host:** `127.0.0.1:5432`
- **User/Password:** `elms` / `elms`
- **Database:** `elms_cloud`
- Connect with any PostgreSQL client (TablePlus, DBeaver, psql)

```bash
# Quick psql access
docker compose -f ops/docker-compose.dev.yml exec postgres psql -U elms -d elms_cloud
```

### Redis
- **Host:** `127.0.0.1:6379`
- No password in dev

```bash
# Redis CLI
docker compose -f ops/docker-compose.dev.yml exec redis redis-cli
```

### MinIO
- **API:** http://localhost:9000 (used by backend)
- **Console:** http://localhost:9001 (web UI to browse uploaded files)
- **Credentials:** `elms-dev` / `elms-dev-secret`
- **Bucket:** `elms-documents` (auto-created on first start)

Log into the MinIO console at http://localhost:9001 to browse, upload, and delete files directly.

---

## Running DB Migrations After Schema Changes

When `packages/backend/prisma/schema.prisma` changes:

```bash
# Generate and apply migration
DATABASE_URL="postgresql://elms:elms@127.0.0.1:5432/elms_cloud?schema=public" \
  pnpm --filter @elms/backend exec prisma migrate dev --schema packages/backend/prisma/schema.prisma --name describe_your_change

# Regenerate Prisma client
pnpm prisma:generate
```

The backend dev server (`dev:web`) detects the schema change and restarts automatically.

---

## Differences from Production (What's Not Replicated)

| Production Feature | Dev Equivalent | Notes |
|---|---|---|
| Caddy TLS (HTTPS) | Plain HTTP | HTTPS not needed locally |
| `nginx` in frontend container | Vite dev server | HMR, no build step needed |
| `NODE_ENV=production` | `NODE_ENV=development` | Auto-generates JWT keys, relaxed validation |
| Resend email | Empty SMTP → silent skip | Add `SMTP_PASS` to test invites |
| Separate worker containers | `pnpm dev:web:workers` | Same code, different process |
| Caddy access logs | Console stdout | All logs visible in terminal |
| Docker networking | `localhost` | All ports bound to host |

---

## Stopping Dev Environment

```bash
# Stop backend + frontend (Ctrl+C in Terminal 1)

# Stop infrastructure containers (keeps data)
docker compose -f ops/docker-compose.dev.yml stop

# Stop and remove containers + volumes (wipes all dev data)
docker compose -f ops/docker-compose.dev.yml down -v
```

---

## Re-seeding / Resetting Dev Data

```bash
# Reset the database completely
DATABASE_URL="postgresql://elms:elms@127.0.0.1:5432/elms_cloud?schema=public" \
  pnpm --filter @elms/backend exec prisma migrate reset --schema packages/backend/prisma/schema.prisma --force

# Re-seed with demo data
pnpm seed:web
```

---

## Troubleshooting

### Backend fails with "AUTH_MODE=cloud is deprecated"
This warning is gone — `env.ts` was patched. If you see it, ensure you're running from the latest code: `git status`.

### "R2 storage requires R2_ENDPOINT or R2_ACCOUNT_ID"
The `ops/.env.web-dev` file has `R2_ENDPOINT=http://127.0.0.1:9000`. Check that the backend is reading this file (`pnpm dev:web` uses it automatically).

### MinIO bucket not found / upload fails
The `minio-init` container creates the bucket. If it failed:
```bash
docker compose -f ops/docker-compose.dev.yml logs minio-init
docker compose -f ops/docker-compose.dev.yml run --rm minio-init
```

### "ECONNREFUSED redis://127.0.0.1:6379"
Redis container isn't up. Run:
```bash
docker compose -f ops/docker-compose.dev.yml up -d redis
```

### Workers crash with "Cannot find module dist/cloud/jobs/..."
Build the cloud output first:
```bash
pnpm --filter @elms/backend build:cloud
```

### Frontend can't reach the API
The Vite dev server (`packages/frontend/vite.config.ts`) already proxies `/api` to `http://127.0.0.1:7854`. Ensure the backend is running on port 7854.
