# SaaS Next Steps

> **Superseded:** the canonical, current plan is [docs/business/SAAS_CONVERSION_PLAN.md](../business/SAAS_CONVERSION_PLAN.md). This file is kept for historical detail only.

## Goal

Convert ELMS from desktop-first local runtime into a production SaaS for Egyptian law firms, using the current cloud auth/runtime activation as the foundation.

## Current State

- Cloud auth/runtime is now operational in code.
- SaaS registration, invite acceptance, refresh, and browser onboarding now work at the auth layer.
- Desktop and SaaS setup flows are separated in the UI.
- Backend and frontend package typechecks pass for the implemented changes.

## Recommended Next Steps

### 1. Stabilize the hosted runtime

- Define the active web deployment contract outside `archive/cloud/**`.
- Create production-ready env docs for (planned, at time of writing):
  - `AUTH_MODE=cloud`
  - `FRONTEND_APP_URL`
  - `COOKIE_DOMAIN`
  - `ALLOWED_ORIGINS`
  - `DATABASE_URL`
  - `REDIS_URL`
  - JWT keys
  - SMTP
  - R2
- Stand up a real staging topology:
  - frontend static host
  - backend API
  - Redis
  - PostgreSQL
  - document worker path
- Verify end-to-end browser login, registration, invite flow, logout, and session refresh in staging.

### 2. Finish browser-first frontend cleanup

- Audit remaining desktop-specific frontend code under:
  - [packages/frontend/src/lib](/home/mk/Projects/CV_projects/legal_system/packages/frontend/src/lib)
  - [packages/frontend/src/components/shared](/home/mk/Projects/CV_projects/legal_system/packages/frontend/src/components/shared)
- Ensure no browser code path depends on Tauri-only behavior at runtime.
- Add explicit tests for:
  - cloud bootstrap
  - refresh after expired access token
  - SaaS registration flow
  - login page behavior when `needsSetup=false`

### 3. Secure tenant isolation for SaaS

- Add PostgreSQL RLS for all firm-scoped tables.
- Keep app-layer `firmId` enforcement and validate DB-layer protection with tests.
- Review superadmin endpoints in `packages/backend/src/modules/firms/firms.routes.ts` (file has since been renamed from `admin.routes.ts`).
- Add stronger audit coverage for:
  - admin access
  - billing state changes
  - document access
  - user and role management

### 4. Make storage and async jobs production-safe

- Move SaaS environments to `STORAGE_DRIVER=r2`.
- Validate document upload, extraction, preview, and retrieval in hosted mode.
- Separate the worker process clearly from API runtime if needed for production concurrency.
- Add operational checks for queue failures, OCR failures, and preview failures.

### 5. Productize the Egypt SaaS onboarding

- Default SaaS onboarding to:
  - Arabic
  - `Africa/Cairo`
  - `EGP`
  - firm account abstraction
- Review setup and settings UX for Egyptian firms:
  - firm profile
  - users and roles
  - lookups
  - billing settings
  - portal settings
- Add seeded demo/staging data shaped like Egyptian firms, courts, and workflows.

### 6. Decide billing rollout

- Recommended immediate path: manual billing for pilot customers.
- Keep Stripe code optional for later rollout, but do not block launch on it.
- If online subscription billing is needed before launch:
  - harden checkout flow
  - validate webhook lifecycle behavior
  - add billing portal/account management
  - test lifecycle transitions against firm access rules

### 7. Add SaaS release operations

- Add or harden:
  - staging deploy pipeline
  - smoke tests after deploy
  - backup and restore procedure
  - Sentry/runtime monitoring
  - uptime health checks
  - incident logging
- Promote cloud deployment docs from reference to active docs.

## Suggested Execution Order

1. Hosted staging environment
2. Browser runtime cleanup and SaaS auth e2e
3. R2 storage and async-job validation
4. Tenant hardening with RLS
5. Egypt-specific onboarding and firm settings polish
6. Billing rollout decision
7. Observability and release automation

## What To Implement Next

If continuing immediately, the best next implementation batch is:

1. Create the active staging deployment contract and env docs.
2. Wire and test hosted browser auth end-to-end.
3. Switch staged file storage to R2 and validate document workflows.

