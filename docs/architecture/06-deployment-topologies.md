# ELMS Architecture — 06: Deployment Topologies

## Status (as of July 10, 2026)

- `Implemented`: Hosted topology under `ops/**` (VPS Docker Compose + Caddy).
- `Archived Reference`: Older cloud Docker topology under `archive/cloud/**`, superseded by `ops/**`.

See [docs/business/SAAS_CONVERSION_PLAN.md](../business/SAAS_CONVERSION_PLAN.md) for the current SaaS conversion plan and gap list.

## Implemented topologies

### Hosted (`ops/**`)

- Single-VPS Docker Compose stack: PostgreSQL, Redis, MinIO (S3-compatible object storage), Fastify backend, Nginx-served React frontend, Caddy edge proxy with automatic Let's Encrypt TLS.
- `ops/docker-compose.prod.yml` is the production stack definition; `ops/docker-compose.dev.yml` the dev variant.
- `ops/README.md` documents the deployment steps end to end (build images, run migrations, start stack, backup/restore).
- Cloud auth (`AUTH_MODE` set to `cloud`) is operational — see `packages/backend/src/modules/auth/cloudAuthService.ts` for the full JWT + Redis-backed session implementation.
- Default billing posture is manual/beta (`SAAS_BILLING_MODE=manual`); Stripe checkout/webhook code exists but is gated behind explicit config.

## Archived Reference topology

Older cloud deployment files, superseded by `ops/**`:

- `archive/cloud/apps/web/docker-compose.yml`
- `archive/cloud/apps/web/docker-compose.prod.yml`
- `archive/cloud/apps/web/Dockerfile`
- `archive/cloud/apps/web/backend.Dockerfile`
- `archive/cloud/README.md`

These files are reference-only and are not the active production deployment contract.

## Source of truth

- `ops/**`
- `archive/cloud/**`
- `packages/backend/src/config/env.ts`
- `packages/backend/src/modules/auth/createAuthService.ts`
- `package.json`
