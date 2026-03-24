# Getting Started

This guide walks you through cloning the ELMS monorepo, installing dependencies, configuring the environment, running database migrations, seeding initial data, and starting a development server.

---

## Prerequisites

| Tool | Minimum version | Purpose |
|---|---|---|
| Node.js | 22.x | Runtime for backend and frontend tooling |
| pnpm | 10.27.0 | Package manager (workspaces) |
| Rust + Cargo | stable (latest) | Required only for the Tauri desktop build |
| PostgreSQL | 16.x | Primary datastore |
| Redis | 7.x | Session store, BullMQ queue, rate-limit state |

Install pnpm globally if you do not already have it:

```bash
npm install -g pnpm@10.27.0
```

---

## 1. Clone the repository

```bash
git clone <repository-url> legal_system
cd legal_system
```

---

## 2. Install dependencies

```bash
pnpm install
```

`pnpm` respects the `pnpm-workspace.yaml` at the repo root and installs dependencies for all packages (`apps/*`, `packages/*`) in a single pass.

---

## 3. Configure environment variables

Copy the example env file and edit it for your local setup:

```bash
cp .env.example .env
```

At minimum, set `DATABASE_URL` to point at your local PostgreSQL instance. The example uses:

```
DATABASE_URL=postgresql://elms:elms@127.0.0.1:5432/elms_cloud?schema=public
```

All other variables have sensible defaults for local development. See [Environment Variables](./03-environment-variables.md) for the full reference.

> **JWT keys in development** — In `NODE_ENV=development` (the default), RSA-2048 key pairs are auto-generated at startup. You do not need to set `JWT_PRIVATE_KEY` or `JWT_PUBLIC_KEY` locally. They are **required** in production.

---

## 4. Generate the Prisma client

```bash
pnpm prisma:generate
```

This runs `prisma generate` inside `packages/backend` and emits the typed `@prisma/client` into `node_modules`.

---

## 5. Run database migrations

The migration files live at `packages/backend/prisma/migrations/`. Apply them with:

```bash
pnpm --filter @elms/backend exec prisma migrate dev
```

In CI or production deployments use:

```bash
pnpm --filter @elms/backend exec prisma migrate deploy
```

---

## 6. Seed development data

To seed the **cloud** (multi-tenant) database:

```bash
pnpm seed:dev:cloud
```

To seed the **desktop** (local, single-tenant) database (uses `apps/desktop/.env.desktop`):

```bash
pnpm seed:dev
```

Both commands run `packages/backend/prisma/seed.ts` via `tsx`.

---

## 7. Start the development server

### Cloud / web mode

Starts the Fastify backend (cloud env) and the Vite frontend simultaneously:

```bash
pnpm dev:web
```

| Service | Default URL |
|---|---|
| Backend API | `http://localhost:7854` |
| Frontend SPA | `http://localhost:5174` |

The frontend Vite dev server proxies all `/api/` requests to the backend.

### Desktop / Tauri mode

Starts the Fastify backend (local env) and the Vite frontend, then boots the Tauri window:

```bash
pnpm dev:tauri
```

The desktop app embeds its own PostgreSQL instance (port 5433 by default) and runs fully offline.

---

## 8. Verify the backend is healthy

```bash
curl http://localhost:7854/api/health
```

A healthy response looks like:

```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok",
  "queue": { "waiting": 0, "active": 0 }
}
```

---

## 9. Browse the API documentation

Swagger UI is available at `http://localhost:7854/docs` in all non-production environments. It reflects every registered route with request/response schemas.

---

## Desktop packaging prerequisites

Before building Linux desktop installers, bundle the local runtime dependencies:

```bash
bash scripts/bundle-linux-deps.sh
```

---

## Next steps

- [Repository Structure](./02-repo-structure.md)
- [Environment Variables](./03-environment-variables.md)
- [Architecture Internals](./04-architecture-internals.md)
- [Database](./05-database.md)
- [API Reference](./06-api-reference.md)
