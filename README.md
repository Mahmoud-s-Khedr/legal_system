# ELMS — Electronic Legal Management System

Monorepo for a legal practice management system, deployed as a hosted browser runtime for controlled SaaS and paid-beta deployments.

## Runtime status (as of July 10, 2026)

- `Implemented`: Hosted browser runtime (`AUTH_MODE=cloud`) with deployment assets under `ops/**`.
- `Archived Reference`: Older cloud assets under `archive/cloud/**`.

Hosted SaaS billing is currently configured for **manual beta billing by default**. Stripe checkout/webhook flows remain optional and should only be enabled when `SAAS_BILLING_MODE=stripe` is intentionally configured.

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

## Workspace layout

```text
archive/
  cloud/     Archived cloud Dockerfiles/compose/scripts (reference only)
packages/
  backend/   Fastify API + Prisma + jobs
  frontend/  React SPA
  shared/    Shared DTOs, enums, and types
docs/
  user/ architecture/ dev/ business/ _inventory/
scripts/
  backup, restore, deploy utilities
```

## Prerequisites

- Node.js 22+
- pnpm 10.x
- PostgreSQL (required for backend runtime)
- Redis (`Archived Reference`: previously used for cloud auth and queue-backed cloud flows)

## Local development

```bash
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm --filter @elms/backend prisma migrate dev
pnpm seed:dev
pnpm dev
```

Seed options:
- `ELMS_SEED_PROFILE=minimal|full` (default `full`)
- `ELMS_SEED_VALUE=<seed-string>` for deterministic generation
- `ELMS_SEED_INCLUDE_INTEGRATIONS=true|false` (default `true`)

## Hosted deployment

The active hosted deployment contract lives under `ops/**`.

- `ops/README.md` documents the VPS/container topology and rollout steps.
- `ops/.env.production.example` defines the hosted environment contract.
- `SAAS_BILLING_MODE=manual` is the default hosted beta posture.

## Core scripts

- `pnpm validate` full local quality gate
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
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
