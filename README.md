# ELMS — Electronic Legal Management System

Monorepo for a legal practice management system with a desktop/local runtime as the active production path.

## Runtime status (as of May 18, 2026)

- `Implemented`: Desktop/local runtime (`AUTH_MODE=local`) and Tauri packaging.
- `Archived Reference`: Cloud deployment assets under `archive/cloud/**`.
- `Planned`: Re-activating operational cloud auth/runtime.

Backend code currently forces local auth service even if `AUTH_MODE=cloud` is configured (deprecated/non-operational):
- `packages/backend/src/config/env.ts`
- `packages/backend/src/modules/auth/createAuthService.ts`

## What is implemented in active runtime

Based on current code (`packages/backend/src/app.ts`, `packages/frontend/src/router.tsx`, `packages/backend/prisma/schema.prisma`):

- Authentication and sessions through active local auth service (`/api/auth/*`)
- Firm/user/role/invitation modules and permissions
- Clients, cases, hearings, tasks
- Documents upload + OCR + search
- Billing (invoices + expenses)
- Notifications (in-app/email/SMS/desktop channel paths)
- Reports, templates, lookups
- Law library and AI research modules
- Client portal routes (`/api/portal*` and `/portal/*`)
- Desktop app packaging via Tauri (`apps/desktop`)

## Workspace layout

```text
apps/
  desktop/   Tauri shell and desktop packaging scripts
archive/
  cloud/     Archived cloud Dockerfiles/compose/scripts (reference only)
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
- Rust/Cargo (desktop build only)
- Redis (`Archived Reference`: previously used for cloud auth and queue-backed cloud flows)

## Local development (active)

```bash
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm --filter @elms/backend prisma migrate dev
pnpm seed:dev
pnpm dev:desktop
```

Seed options:
- `ELMS_SEED_PROFILE=minimal|full` (default `full`)
- `ELMS_SEED_VALUE=<seed-string>` for deterministic generation
- `ELMS_SEED_INCLUDE_INTEGRATIONS=true|false` (default `true`)

Useful alternatives:
- `pnpm dev:desktop` (backend local mode + frontend desktop host)
- `pnpm dev:tauri` (run desktop shell)

## Core scripts

- `pnpm validate` full local quality gate
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm release:desktop:linux`
- `pnpm release:desktop:local`
- `pnpm docs:verify`
- `pnpm structure:audit`
- `pnpm structure:check`

## Documentation

- Developer docs: [docs/dev/](docs/dev/)
- Architecture docs: [docs/architecture/](docs/architecture/)
- Business docs (code-truth constrained): [docs/business/](docs/business/)
- User docs index: [docs/user/index.md](docs/user/index.md)
- Documentation truth map: [docs/_inventory/source-of-truth.md](docs/_inventory/source-of-truth.md)

## Source of truth

Use the following as canonical references when updating docs:

- `packages/backend/src/app.ts`
- `packages/frontend/src/router.tsx`
- `packages/backend/prisma/schema.prisma`
- `packages/backend/src/config/env.ts`
- `packages/backend/src/modules/auth/createAuthService.ts`
- `package.json` + workspace `package.json` files
- `.github/workflows/*`
