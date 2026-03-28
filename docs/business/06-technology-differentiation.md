# ELMS — Technology Differentiation (Code-Truth)

## Implemented technical differentiators

- Monorepo with shared contracts (`@elms/shared`) across backend and frontend.
- Dual deployment topology (web + desktop) from one codebase.
- Modular backend domains with explicit route registration and service boundaries.
- Configurable storage and OCR backends through environment schema.
- Edition-based feature gating in backend policy layer.

## Source of truth

- `pnpm-workspace.yaml`
- `packages/shared/src/index.ts`
- `packages/backend/src/app.ts`
- `packages/backend/src/config/env.ts`
- `packages/backend/src/modules/editions/editionPolicy.ts`
