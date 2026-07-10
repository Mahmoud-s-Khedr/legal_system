# ELMS SaaS Remaining Work

> **Superseded:** the canonical, current plan is [docs/business/SAAS_CONVERSION_PLAN.md](../business/SAAS_CONVERSION_PLAN.md). This file is kept as a running, more granular work tracker.

Last updated 2026-07-10, after the desktop-removal + platform-operator-dashboard work session.

---

## 🔴 Blocking — must fix before anything else is usable

### 0. Tenant session hook-ordering bug (discovered this session, NOT yet fixed)

`packages/backend/src/plugins/sessionContext.ts` registers the request's session resolver as a `preHandler` hook. Fastify runs `preValidation` hooks (including every route's `preValidation: [requireAuth, requirePermission(...)]` guard) **before** any `preHandler` hook. Result: **every permission-gated tenant route currently rejects a valid, correctly-authenticated user with 401** — confirmed live by logging in as a real seeded user and hitting `GET /api/invoices`.

This is not new from this session — it predates it — but it means the live application is currently non-functional for any authenticated action beyond login itself. It was never caught because the backend test suite mocks Fastify and never exercises real hook execution order.

- **Fix**: change `app.addHook("preHandler", ...)` → `app.addHook("preValidation", ...)` in `sessionContext.ts` (same one-line fix already applied to the new `operatorSessionContext.ts` this session, and verified live).
- **Do this first.** Nothing else here matters if authenticated users can't use the app.

---

## ✅ Completed this session

- **Desktop app fully removed.** `apps/desktop/` (Tauri/Rust) deleted wholesale; all Tauri bridge code, LAN/local-IP backend-exposure feature, desktop backup/download settings UI, and hash-based routing stripped from `packages/frontend`. Desktop-only env vars and CORS carve-outs removed from the backend. Root `dev` now launches a plain web dev flow. Verified: 513 backend tests / 300 frontend tests pass, both typecheck/lint/build clean.
- **Platform-operator (SaaS admin) dashboard built.** New `OperatorUser` identity fully isolated from tenant `User`/`Firm` (separate JWT signing key + audience + cookie); `/api/operator/*` routes for firms list/detail, manual MRR editing, suspend/reinstate/extend-trial; `/operator/*` frontend route tree with its own login/layout/dashboard/firms pages. Isolation verified live: a tenant cookie cannot reach `/api/operator/*` and vice versa (401 both directions).
- **Manual MRR field** added to `Firm` (`Decimal(12,2)`) since Stripe cannot settle to Egyptian merchant accounts — matches the SaaS plan's guidance to not invest further in Stripe as the primary Egypt billing rail.
- **Migration history consolidated.** The previous 35 migrations had accumulated drift against `schema.prisma` (pre-existing, unrelated to this session) that broke `prisma migrate dev`. Confirmed with the user that no production/staging database has this history applied yet, so it was reset to a single `20260710140940_init` baseline migration. **If any other environment (staging, another dev machine) had the old history applied, it must be rebuilt from scratch against this new baseline — do not attempt to reconcile the two histories.**
- Fixed a real leftover bug from the desktop-removal work: `.env.local.example`'s `DATABASE_URL` pointed at the old desktop-embedded-Postgres port (5433) instead of the standard dev port (5432) that `ops/docker-compose.dev.yml` expects.

---

## Remaining Work

### 1. Database-level tenant isolation

- Add PostgreSQL Row-Level Security for firm-scoped tables.
- Define how request/transaction tenant context is set for Prisma-backed queries (e.g. `SET LOCAL app.current_firm_id` inside a `$transaction`).
- Audit raw SQL/report/export queries for tenant leakage risk — `packages/backend/src/modules/firms/` (now removed) and any raw SQL/report code are the highest-risk spots.
- Add negative tests proving cross-firm reads/writes fail at DB level, not only service level.
- Still not started.

### 2. Hosted auth and session hardening

- **Fix the blocking hook-ordering bug above first.**
- Add deeper integration coverage for cloud auth mode that actually exercises a real Fastify instance (not mocked) — the mocked test suite is exactly why the bug above went undetected. Cover: registration, invite acceptance, access token expiry, refresh token flow, logout/session invalidation.
- Validate production cookie settings (`SameSite`, `secure`, domain scoping) across real hosted origins and subdomains.
- Review suspended/grace firm behavior in browser flows and ensure consistent UX.
- New this session: same integration-testing gap applies to the new operator auth flow — current operator tests are also mocked at the unit level (though live-verified manually this session).

### 3. Hosted storage and async jobs

- Validate `STORAGE_DRIVER=r2` end-to-end in staging.
- Confirm upload, extraction, OCR, preview generation, retrieval, and worker retry behavior.
- Add stronger health/degraded reporting for: Redis, queue backlog, worker liveness, object storage access.
- Add operator-facing logging/runbooks for OCR/preview/queue failures — the new `/operator/*` dashboard is a natural home for this once built out further (currently just firms/stats/lifecycle actions).

### 4. Staging environment and smoke tests

- Stand up a real staging environment that mirrors production topology.
- Add repeatable smoke checks covering: register first firm, login, create client/case, upload document, invite second user, verify tenant isolation, **plus operator login and firm lifecycle actions**.
- Prefer an automated staging smoke path over manual-only verification — this session's live testing (curl against a throwaway local Postgres container) is exactly the kind of check that should be automated and run in CI, since it's what caught the blocking bug.

### 5. SaaS operations hardening

- Add deploy/runbook steps for: image build, migration deploy, rollout, rollback.
- Add monitoring/alerting: frontend Sentry, backend Sentry, uptime/health checks.
- Add tested backup/restore procedures for hosted Postgres and object storage.
- Run at least one restore drill into a non-production environment.
- Add operator bootstrap to the deploy runbook (`ELMS_OPERATOR_BOOTSTRAP_EMAIL`/`ELMS_OPERATOR_BOOTSTRAP_PASSWORD` env-gated seed step, added this session).

### 6. Egypt-market payments

- Do not invest further in Stripe as the primary billing rail — it cannot settle to Egyptian merchant accounts.
- Scope integration with a local Egyptian payment gateway (Paymob or Fawry primary, PayTabs secondary) for eventual self-serve billing — needs its own scoping task (merchant account requirements, KYC, recurring-billing/tokenization support).
- Keep manual/bank-transfer billing (`SAAS_BILLING_MODE=manual`, already the default) as the launch posture.
- The new manual MRR field (this session) is the interim bridge: operator-editable per firm, summed for stats, no gateway integration required yet.

### 7. Platform-operator dashboard follow-ups

- Currently minimal: firms list with inline MRR edit + suspend/reinstate/extend-trial, and a stats overview. No firm detail page, no audit log of operator actions, no graduated operator roles (all operators are equally privileged).
- UI strings are plain English, not run through i18n (reasonable for an internal-only tool, but flag if that changes).
- Needs integration tests that exercise a real Fastify instance + real DB, not just mocked unit tests, given the hook-ordering bug this session exposed.

### 8. Docs cleanup still worth doing

- Update any remaining architecture/auth docs that still imply cloud mode is non-operational.
- Add a concise operator guide for hosted beta support: onboarding a firm, handling login failures, handling invite failures, suspending/reactivating a firm (now doable via `/operator/firms`), diagnosing worker issues.
- This file (`saas_remaining_work.md`) vs. `docs/business/SAAS_CONVERSION_PLAN.md` — consider merging them properly; right now this file is more current on tactical detail, the other on strategic framing.

---

## Suggested Next Order

1. **Fix the tenant session hook-ordering bug (blocking, one line, do immediately).**
2. Add real (non-mocked) integration tests for auth so this class of bug can't recur silently.
3. Database-level tenant isolation / RLS.
4. Staging environment plus automated hosted smoke flows (including operator flows).
5. R2 and worker validation.
6. SaaS ops hardening: monitoring, backups, rollback.
7. Egypt payment gateway scoping (Paymob/Fawry).

## Notes

- Desktop is now **fully removed**, not a parallel supported runtime — this is a change from the previous version of this document. All web/SaaS work can proceed without any desktop-compatibility constraint.
- Current hosted posture is suitable for continued paid-beta hardening once the blocking auth bug is fixed — it is not yet ready for a broad public self-serve launch.
