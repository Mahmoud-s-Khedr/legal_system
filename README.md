# ELMS — Electronic Legal Management System

**Version 0.1.0** · Arabic-first legal practice management for MENA law firms · offline desktop + cloud SaaS

---

## What Is ELMS?

ELMS is a production-grade, multi-tenant legal practice management platform built for Arabic-speaking law firms in Egypt and the MENA region. It covers the complete firm workflow — clients, cases, court hearings, documents, billing, AI-assisted legal research, and a searchable law library — in a fully RTL-native interface.

ELMS ships in two deployment models: a **cloud SaaS** (Docker, multi-firm) and a **standalone desktop app** (Tauri 2, fully offline, single firm). Both run from the same codebase.

---

## Key Features

- **Arabic-first UI** — native RTL layout, Arabic/English/French i18n, Egyptian court terminology
- **Offline desktop** — self-contained Tauri app with embedded PostgreSQL and Node.js; no internet required
- **Case & client management** — individual, company, and government clients; full case lifecycle with court stage tracking
- **Hearings & calendar** — session scheduling, automatic reminders, Google Calendar sync
- **Document management** — upload, version, OCR (Tesseract + Google Vision), and full-text search across all files
- **Billing & invoicing** — invoice lifecycle, payment recording, expense tracking, online payments (Connect Misr / Paymob)
- **Law library** — hierarchical legislation taxonomy, article indexing, annotations, case-law linking
- **AI research assistant** — Anthropic Claude with retrieval-augmented generation from firm library, SSE streaming, citation chips
- **Multi-tenancy & RBAC** — firm isolation, 5 system roles, 69 permissions, custom role builder
- **Multi-channel notifications** — in-app, email (SMTP / Resend), SMS (Twilio), desktop OS push
- **Edition-based licensing** — 5 tiers from solo offline to enterprise, seat limits, feature gates, trial lifecycle
- **Client portal** — read-only client-facing view of cases, hearings, and shared documents

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | Fastify 5, Node.js 22 |
| ORM / DB | Prisma 6, PostgreSQL 16 |
| Queue / Cache | BullMQ, Redis 7 |
| Frontend | React 18, Vite 7, TanStack Router, TanStack Query, Zustand 5 |
| Desktop shell | Tauri 2 (Rust) |
| AI | Anthropic Claude API (claude-sonnet-4-6) |
| Storage | Local filesystem or Cloudflare R2 |
| OCR | Tesseract.js or Google Cloud Vision |
| Monorepo | pnpm 10.27.0 + Turborepo 2 |
| Language | TypeScript 5.9 (strict) |

---

## Monorepo Structure

```
elms/
├── apps/
│   ├── desktop/          # Tauri 2 desktop application
│   └── web/              # Docker Compose + Nginx for cloud deployment
├── packages/
│   ├── backend/          # @elms/backend — Fastify REST API, Prisma, BullMQ workers
│   ├── frontend/         # @elms/frontend — React SPA (serves both cloud and desktop)
│   └── shared/           # @elms/shared — DTOs, enums, TypeScript types
├── docs/
│   ├── dev/              # Developer documentation (12 guides)
│   ├── architecture/     # Architecture documentation (13 docs)
│   ├── business/         # Business & strategy documentation (9 docs)
│   └── user/             # End-user documentation (24 guides)
├── scripts/              # Build, deployment, and maintenance scripts
├── tests/
│   ├── e2e/              # Playwright end-to-end tests
│   └── load/             # k6 load tests
├── .env.example          # Environment variable template
└── turbo.json            # Turborepo build pipeline
```

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22.x | Required |
| pnpm | 10.27.0 | `npm install -g pnpm@10.27.0` |
| PostgreSQL | 16.x | Required for cloud/web mode |
| Redis | 7.x | Required for cloud/web mode |
| Rust + Cargo | stable | Required for desktop build only |

---

## Quick Start — Cloud / Web

```bash
# 1. Clone and install
git clone <repository-url> elms
cd elms
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, REDIS_URL, AUTH_MODE=CLOUD, and any optional integrations

# 3. Set up the database
pnpm prisma:generate
pnpm --filter @elms/backend prisma migrate dev

# 4. Seed development data
pnpm seed:dev:cloud

# 5. Start development servers
pnpm dev:web
# Backend: http://localhost:7854  |  Frontend: http://localhost:5174
# Swagger UI: http://localhost:7854/docs
```

---

## Quick Start — Desktop (Tauri)

```bash
# 1–4: Same as Cloud Quick Start above (with AUTH_MODE=LOCAL in .env)

# 5. Install the development license
pnpm setup:dev-license

# 6. Start the Tauri desktop app
pnpm dev:tauri
# Opens the native desktop window with embedded backend on http://127.0.0.1:7854
```

> The desktop app bundles its own PostgreSQL and Node.js runtimes. Windows NSIS installers can be cross-built from Fedora/Linux experimentally, but release-quality Windows artifacts should come from Windows CI. macOS installers require a macOS host. For production desktop builds, see [docs/dev/11-desktop-build.md](docs/dev/11-desktop-build.md).

---

## Available Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start the Tauri desktop app (alias for `dev:tauri`) |
| `pnpm dev:tauri` | Start Tauri desktop app with live reload |
| `pnpm dev:web` | Start cloud backend + frontend in parallel |
| `pnpm dev:desktop` | Start local backend + frontend (without Tauri shell) |
| `pnpm dev:full` | Start cloud web stack and Tauri simultaneously |
| `pnpm build` | Build all packages via Turborepo |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm typecheck` | Run TypeScript type checking across all packages |
| `pnpm test` | Run Vitest unit tests across all packages |
| `pnpm test:coverage` | Run unit tests with V8 coverage report |
| `pnpm test:e2e` | Run Playwright end-to-end tests |
| `pnpm test:load` | Run k6 API baseline load test |
| `pnpm test:load:auth` | Run k6 authentication load test |
| `pnpm test:load:upload` | Run k6 document upload load test |
| `pnpm prisma:generate` | Generate the Prisma client |
| `pnpm prisma:seed` | Run the production seed script |
| `pnpm seed:dev` | Seed development data (desktop/local) |
| `pnpm seed:dev:cloud` | Seed development data (cloud PostgreSQL) |
| `pnpm setup:dev-license` | Install the development desktop license |

---

## Testing

```bash
# Unit tests (Vitest)
pnpm test

# Unit tests with coverage
pnpm test:coverage

# End-to-end tests (Playwright)
pnpm test:e2e

# Load tests (requires k6 installed)
pnpm test:load          # API baseline
pnpm test:load:auth     # Authentication flows
pnpm test:load:upload   # Document upload
```

E2E tests run against `http://127.0.0.1:5173` by default. Override with `PLAYWRIGHT_BASE_URL`.

---

## Edition Tiers

| Edition | Deployment | Seats | AI Research | Trial |
|---|---|---|---|---|
| `solo_offline` | Desktop only | 1 | No | 30 days |
| `solo_online` | Cloud | 1 | 500 msg/month | No |
| `local_firm_offline` | Desktop (LAN) | Unlimited | No | No |
| `local_firm_online` | Cloud | Unlimited | 2,000 msg/month | No |
| `enterprise` | Cloud | Unlimited | Unlimited | No |

See [docs/architecture/11-editions-and-licensing.md](docs/architecture/11-editions-and-licensing.md) for the full licensing and lifecycle model.

---

## Documentation

| Audience | Location | Contents |
|---|---|---|
| Developers & contributors | [docs/dev/](docs/dev/) | Setup, repo structure, env vars, API reference, auth internals, testing, contributing, scripts, desktop build, i18n |
| Architects & reviewers | [docs/architecture/](docs/architecture/) | System overview, tech stack rationale, data flow, auth & security, multi-tenancy, deployment topologies, document pipeline, AI research pipeline, async jobs, notifications, editions, CI/CD, scalability |
| Investors & stakeholders | [docs/business/](docs/business/) | Executive summary, value proposition, feature matrix, market fit, deployment models, technology differentiation, roadmap, competitive positioning |
| Law firm staff | [docs/user/](docs/user/) | Installation, first-time setup, case management, hearings, documents, billing, AI research, law library, roles, backup/restore, troubleshooting |
