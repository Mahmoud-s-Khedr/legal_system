# ELMS — Electronic Legal Management System

Monorepo for a legal practice management system with cloud and desktop deployments.

## What is implemented

Based on current code (`packages/backend/src/app.ts`, `packages/frontend/src/router.tsx`, `packages/backend/prisma/schema.prisma`):

- Authentication: cloud and local modes (`/api/auth/*`)
- Firm/user/role/invitation management
- Clients, cases, hearings, tasks
- Documents upload + OCR + search
- Billing (invoices + expenses)
- Notifications (in-app/email/SMS/desktop channel paths)
- Reports, templates, lookups
- Law library and AI research backend modules
- Client portal routes (`/api/portal*` and `/portal/*`)
- Desktop app packaging via Tauri (`apps/desktop`)

## Workspace layout

```text
apps/
  desktop/   Tauri shell and desktop packaging scripts
  web/       Dockerfiles + compose for web deployment
packages/
  backend/   Fastify API + Prisma + jobs
  frontend/  React SPA
  shared/    Shared DTOs, enums, and types
docs/
  user/ architecture/ dev/ business/ _inventory/
scripts/
  backup, restore, desktop packaging, deploy utilities
```

## Prerequisites

- Node.js 22+
- pnpm 10.x
- PostgreSQL (required for backend runtime)
- Redis (required for cloud auth mode and queue-backed flows)
- Rust/Cargo (desktop build only)

## Local development

```bash
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm --filter @elms/backend prisma migrate dev
pnpm seed:dev:cloud
pnpm dev:web
```

Useful alternatives:

- `pnpm dev:desktop` (backend local mode + frontend desktop host)
- `pnpm dev:tauri` (run desktop shell)

## Core scripts

- `pnpm validate` full local quality gate
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm release:web`
- `pnpm release:desktop:linux`
- `pnpm release:desktop:local`
- `pnpm docs:verify`

## Documentation

- Developer docs: [docs/dev/](docs/dev/)
- Architecture docs: [docs/architecture/](docs/architecture/)
- Business docs (code-truth constrained): [docs/business/](docs/business/)
- User docs index: [docs/user/index.md](docs/user/index.md)
- Documentation truth map: [docs/_inventory/source-of-truth.md](docs/_inventory/source-of-truth.md)

## Adding a new database migration

After adding a migration with `prisma migrate dev`, update the `LATEST_MIGRATION_NAME` constant in [apps/desktop/src-tauri/src/sidecar.rs](apps/desktop/src-tauri/src/sidecar.rs) to match the new migration folder name (e.g. `"0014_your_migration_name"`). This constant is used to skip the `prisma migrate deploy` step on subsequent startups when no new migrations are pending — keeping app startup fast.

## Source of truth

Use the following as canonical references when updating docs:

- `packages/backend/src/app.ts`
- `packages/frontend/src/router.tsx`
- `packages/backend/prisma/schema.prisma`
- `packages/backend/src/config/env.ts`
- `package.json` + workspace `package.json` files
- `.github/workflows/*`
