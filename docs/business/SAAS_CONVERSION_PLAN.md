# ELMS: Desktop-to-SaaS Conversion Plan (Egyptian Market)

**This is the canonical, current plan for converting ELMS from a desktop app into a SaaS product for Egyptian law firms.** It supersedes `docs/planning/saas-plan.md`, `docs/planning/saas_remaining_work.md`, and `docs/planning/saas_transformation_report.md` — those files are kept for history but should not be treated as current.

Written 2026-07-10, based on direct inspection of the codebase (schema, auth service, billing code, deployment configs) rather than inherited claims from prior planning docs.

---

## 1. Executive summary

ELMS already has a working multi-tenant cloud backend and a real, documented single-VPS deployment (`ops/**`) — this is not a green-field conversion, it's a hardening and completion effort. Cloud JWT+Redis auth, tenant-scoped Prisma schema, a tenant-injection middleware, Stripe billing scaffolding, R2/S3 storage support, and Egypt-appropriate defaults (Arabic, `Africa/Cairo`, EGP) are all present in code today.

Current stage: **paid-beta-capable, not public-self-serve-ready.** The three biggest blockers to a genuine "high-quality" launch are:

1. **Tenant isolation is app-layer only** — no database-level enforcement (PostgreSQL RLS), so a single missed `where: { firmId }` filter anywhere in the codebase is a cross-firm data leak.
2. **No viable self-serve payment rail for Egypt** — the existing billing code is built around Stripe, which cannot settle payouts to an Egyptian merchant account. This is a dead end for real launch, not just a hardening task.
3. **No staging environment or observability** — changes go straight from dev to a single production VPS with no smoke tests, no error tracking wired up, no restore-tested backups.

---

## 2. Current state assessment

### 2.1 What's real (verified directly against code)

| Area | Status | Evidence |
|---|---|---|
| Multi-tenancy | Shared-schema, `firmId` FK on ~30 domain models, cascading delete on Firm removal | `packages/backend/prisma/schema.prisma:228-289` |
| Tenant isolation | App-layer only: `injectTenant` middleware strips inbound `X-Firm-ID`, injects session `firmId`; every service query filters `where: { firmId }` | `docs/architecture/05-multi-tenancy.md` (accurate, current) |
| Cloud auth | Full JWT (RS256, `@fastify/jwt`) + Redis-backed refresh tokens, register/login/invite/refresh/logout all implemented | `packages/backend/src/modules/auth/cloudAuthService.ts` |
| Firm lifecycle | `ACTIVE → GRACE → SUSPENDED → PENDING_DELETION` state machine, write-blocked via `firmLifecycleWriteGuard`, daily cron transitions | `docs/architecture/05-multi-tenancy.md` §5 |
| Billing | Stripe checkout session creation + webhook handler exist, gated behind `SAAS_BILLING_MODE` (default `manual`); admin stats endpoint returns `mrr: null` unconditionally | `packages/backend/src/modules/billing/{stripe,stripeWebhook,billing.routes}.ts` — early scaffolding: no plan/price catalog, no billing portal, frontend uses a hardcoded `price_dummy` |
| Deployment | Working single-VPS Docker Compose: Postgres, Redis, MinIO (S3-compatible), Fastify backend, Nginx-served React, Caddy (auto Let's Encrypt TLS) | `ops/docker-compose.prod.yml`, `ops/README.md`, `ops/Caddyfile` |
| Frontend | React + TanStack Router/Query + Zustand + Ant Design + i18next (AR/EN/FR) + `tailwindcss-rtl` — Arabic RTL already built in | `packages/frontend/package.json` |
| Egypt defaults | `FirmSettings` defaults to `currency: "EGP"`, `timezone: "Africa/Cairo"`, `preferredLanguage: AR`; `GovernorateLookup`/`CityLookup` models exist | `schema.prisma`, registration flow |

### 2.2 Known gaps (confirmed from code, consistent with prior planning docs)

1. No PostgreSQL Row-Level Security — tenant isolation is app-layer only, single point of failure.
2. No real staging environment or automated smoke tests.
3. `STORAGE_DRIVER=r2` path not yet validated end-to-end in a hosted setting.
4. Frontend still has live Tauri imports in shared/core modules (`lib/api.ts`, `lib/desktopDownloads.ts`, `lib/desktopBackup.ts`, `DesktopBootstrapGate.tsx`) — this contradicts `saas_transformation_report.md`'s claim that Tauri dependencies were "removed."
5. Router uses `createHashHistory()` (hash-based URLs) — fine for a Tauri webview, wrong for a real SaaS product (bad for SEO, shareable links, analytics).
6. No 2FA, no WAF, no APM, no IaC, no CI-gated deploy pipeline for the hosted target specifically.

### 2.3 Gaps the existing docs miss entirely (Egypt-specific)

7. **Stripe cannot pay out to Egyptian merchants.** Stripe has no supported country entity for Egypt — a firm can accept a card charge via Stripe Checkout, but there is no compliant way to receive settlement into an Egyptian bank account without a foreign entity workaround, which is not realistic for a local SaaS targeting Egyptian law firms. Treating "harden Stripe" as the self-serve billing answer is a dead end for launch in Egypt.
8. No ETA (Egyptian Tax Authority) e-invoicing integration. This applies to invoices *firms* issue to *their own clients* through ELMS, not to ELMS's own SaaS billing — a downstream product feature, not a launch blocker, but relevant to "high-quality for the Egyptian market."
9. No PDPL (Egypt's Personal Data Protection Law, Law 151/2020) data-residency/consent-flow consideration. Legal case data is exactly the kind of sensitive personal data this law covers, and there's currently no stated hosting region or data-processing posture.

---

## 3. Workstreams

### W1 — Tenant isolation hardening (do first, security-critical)
- Add PostgreSQL RLS policies for every `firmId`-scoped table, keyed off a session variable (e.g. `SET app.current_firm_id`) set per request/transaction.
- Define exactly how Prisma sets that session variable per request — likely via `$transaction` + raw `SET LOCAL` at the top of each request-scoped transaction, or a Prisma middleware.
- Add negative tests proving cross-firm reads/writes fail at the DB level even if `injectTenant`/service-layer filtering is bypassed.
- Audit `packages/backend/src/modules/firms/admin.routes.ts` and any raw SQL/report/export queries specifically — these are the most likely places to leak across `firmId`.

### W2 — Browser-first frontend cleanup
- Remove/guard Tauri imports in `lib/api.ts`, `lib/desktopDownloads.ts`, `lib/desktopBackup.ts`, `DesktopBootstrapGate.tsx` so the web bundle never touches `@tauri-apps/api` at runtime (`Dockerfile.frontend` sets `VITE_DESKTOP_SHELL=false` for web builds today, but the import graph itself still couples them).
- Switch router from `createHashHistory()` to browser history for the web build. Keep hash history only for the Tauri build if the webview genuinely requires it — confirm that constraint before assuming it.
- Add tests: cloud bootstrap, refresh-after-expired-token, SaaS registration, login-page behavior when `needsSetup=false`.

### W3 — Staging environment + smoke tests
- Stand up a second environment on the same `ops/docker-compose.prod.yml` contract (separate domain/DB/MinIO bucket).
- Automate a smoke path: register firm → login → create client/case → upload document → invite second user → verify tenant isolation. Wire into CI or a manual-trigger script at minimum.

### W4 — Storage/async job validation
- Validate `STORAGE_DRIVER=r2` end-to-end (upload, OCR extraction, DOCX preview via LibreOffice, retrieval) against MinIO in staging before pointing at real Cloudflare R2 in prod.
- Add health/degraded-state reporting for Redis, queue backlog, worker liveness, object storage reachability (surface on `/api/health` or an ops dashboard).

### W5 — Egypt-market payments
- Default billing posture for launch stays **manual/bank-transfer billing**, invoiced directly by the operator to pilot firms — already the code default (`SAAS_BILLING_MODE=manual`) and the right call. Keep it.
- For self-serve billing, do not invest further in hardening Stripe as the primary rail. Scope integration with a local Egyptian payment gateway that supports EGP settlement to a local merchant account — **Paymob** or **Fawry** are the standard choices for Egyptian SaaS/e-commerce; **PayTabs** as a secondary option. This needs its own scoping task (merchant account requirements, KYC, recurring-billing/tokenization support per gateway) before committing to one.
- Keep the Stripe code path only as an option for a future non-Egypt expansion where settlement outside Egypt is legally straightforward — don't delete it, just don't prioritize it for the Egypt launch.
- Downstream note: firms invoicing *their own clients* through ELMS may eventually need ETA e-invoicing compliance in the product's invoicing module — a later product feature, not a launch blocker for the SaaS conversion itself.

### W6 — Egypt onboarding polish
- Confirm AR/`Africa/Cairo`/EGP defaults flow correctly through the registration UX (already defaulted in schema — verify UX doesn't override them awkwardly).
- Seed realistic Egyptian demo/staging data (courts, governorates/cities — `GovernorateLookup`/`CityLookup` already modeled).
- Add a data-residency/PDPL statement: where is data hosted (VPS provider/region), and does that satisfy Egyptian PDPL requirements for client personal data? If the VPS isn't in-region, evaluate whether that's acceptable for a legal-data product or whether an Egypt/nearby-region host is warranted.

### W7 — Ops hardening / observability
- Wire Sentry (dependency already present — `@sentry/react` and `@sentry/node`) end-to-end with DSNs set in staging/prod.
- Add uptime/health checks and a backup/restore drill (Postgres + MinIO) — `ops/README.md` already documents backup commands; the missing piece is *testing* a restore, not writing new commands.
- Add a deploy runbook: build → migrate → rollout → rollback, based on the existing `ops/docker-compose.prod.yml` `migrate` service.
- Defer CDN, k8s/ECS auto-scaling, IaC (Terraform), WAF, 2FA to a later scale-up phase — explicitly not required for an initial Egyptian-market paid-beta launch.

---

## 4. Explicit non-goals for this phase

No Kubernetes, no multi-region, no metered AI billing, no feature flags, no in-app chat, no impersonation feature. These are enterprise-scale concerns appropriate only after there are paying tenants to justify them — building them now would be over-engineering a single-VPS product that hasn't launched yet.

---

## 5. Suggested execution order

**W1 (tenant isolation) → W2 (frontend cleanup) → W3 (staging) → W4 (storage/jobs) → W5 (Egypt payments scoping) → W6 (Egypt onboarding polish) → W7 (ops hardening)**, with W2–W4 able to run partly in parallel.

---

## 6. Documentation cleanup

- `docs/planning/saas-plan.md`, `docs/planning/saas_remaining_work.md`, `docs/planning/saas_transformation_report.md` — superseded by this document, kept for historical detail.
- `docs/architecture/04-auth-and-security.md`, `docs/architecture/06-deployment-topologies.md` — were stale (asserted cloud mode is non-operational, contradicting actual code); updated to reflect that cloud mode is operational and `ops/**` is the active deployment contract.
- `docs/architecture/05-multi-tenancy.md` — verified accurate, left as-is.
