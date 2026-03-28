# ELMS — Core Value Proposition (Implementation-Based)

## What the codebase currently delivers

- Single codebase serving web and desktop deployment modes
- Role/permission-based access controls and firm-scoped data handling
- End-to-end legal workflow modules (clients, cases, hearings, tasks, documents, billing)
- Configurable lookup tables, templates, and reports
- Optional integrations and channels gated by environment/configuration and edition policy

## Operational value expressed as implemented capabilities

- Centralized case operations: backend modules + frontend routes cover day-to-day legal workflow screens.
- Data model consistency: Prisma schema + shared DTOs unify API and UI contracts.
- Deployment flexibility: cloud Docker stack and local desktop runtime exist in the same repository.

## Source of truth

- `packages/backend/prisma/schema.prisma`
- `packages/shared/src/dtos/**`
- `packages/backend/src/modules/**`
- `packages/frontend/src/routes/**`
- `packages/backend/src/modules/editions/editionPolicy.ts`
