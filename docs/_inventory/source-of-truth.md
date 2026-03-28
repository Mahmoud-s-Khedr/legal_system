# Source of Truth Inventory

This document defines which code locations are authoritative for documentation claims.

## Scope

- Applies to all files under `docs/` and root `README.md`.
- Codebase is the only truth source for technical and product capability claims.
- If a claim cannot be traced to code/config in this repository, remove it or label it explicitly as non-implementation context.

## Canonical Sources

### Runtime architecture and route registration

- Backend app bootstrap and route registration:
  - `packages/backend/src/app.ts`
- Route implementations:
  - `packages/backend/src/modules/**/*.routes.ts`
- Health endpoint behavior:
  - `packages/backend/src/app.ts` (`GET /api/health`)

### Frontend user-visible workflows

- Router and route gating:
  - `packages/frontend/src/router.tsx`
- UI screens (availability in shipped UI):
  - `packages/frontend/src/routes/**`

### Data model and business enums

- Database schema and enums:
  - `packages/backend/prisma/schema.prisma`
- Shared DTO/contracts:
  - `packages/shared/src/dtos/**`
- Shared enums/types:
  - `packages/shared/src/enums/**`

### Configuration and environment variables

- Backend env schema:
  - `packages/backend/src/config/env.ts`
- Default cloud env values:
  - `.env.example`
- Default desktop env values:
  - `apps/desktop/.env.desktop.example`

### Editions, permissions, and feature gates

- Edition features and limits:
  - `packages/backend/src/modules/editions/editionPolicy.ts`
- Cookie names and default permissions:
  - `packages/backend/src/config/constants.ts`

### Build, test, and operational commands

- Root workspace scripts:
  - `package.json`
- Package scripts:
  - `packages/*/package.json`
  - `apps/*/package.json`
- Operational/release scripts:
  - `scripts/**`
- CI workflows:
  - `.github/workflows/**`

## Documentation Conventions

- Every technical doc should include a **Source of truth** section that points to relevant repository paths.
- Unsupported claims are removed instead of guessed.
- Future/planned items must be clearly separated from shipped implementation details; in code-strict docs, omit them.
- User docs must not describe UI flows that are not currently reachable from `packages/frontend/src/router.tsx`.

## Verification Gate

Run:

```bash
pnpm docs:verify
```

Current checks:

- Broken relative Markdown links (including anchors).
- Referenced `pnpm` scripts exist in workspace package scripts.
- API route groups documented in `docs/dev/06-api-reference.md` map to real backend route prefixes.
- Env vars documented in `docs/dev/03-environment-variables.md` exist in backend env schema (with small explicit allowlist for literals).
