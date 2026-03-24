# ELMS Architecture — 01: System Overview

## 1. Introduction

ELMS (Electronic Legal Management System) is a multi-tenant legal practice management platform designed for Egyptian and MENA law firms. It is delivered in two distinct deployment topologies that share a single codebase:

- **Cloud deployment**: Docker-based, internet-connected, multi-firm SaaS model.
- **Desktop deployment**: Tauri 2 packaged native application, fully offline-capable, single-firm per installation.

The system is structured as a pnpm monorepo with three packages:

| Package | Role |
|---|---|
| `@elms/backend` | Fastify 5 REST API, business logic, Prisma ORM |
| `@elms/frontend` | React 18 SPA, TanStack Router, TanStack Query |
| `@elms/shared` | TypeScript types, enums, Zod schemas shared across packages |

---

## 2. C4 Level 1 — System Context Diagram

```mermaid
C4Context
    title ELMS — System Context

    Person(lawyer, "Lawyer / Paralegal", "Uses ELMS to manage cases, documents, billing, and research")
    Person(client, "Firm Client", "Receives invoices and accesses the client portal")
    Person(admin, "Firm Admin", "Configures the firm, manages users and roles")

    System(elms, "ELMS", "Legal practice management system. Manages cases, documents, billing, AI research, and notifications.")

    System_Ext(anthropic, "Anthropic Claude API", "Provides LLM inference for AI legal research")
    System_Ext(googleVision, "Google Cloud Vision API", "Optional OCR backend for scanned documents")
    System_Ext(smtp, "SMTP / Resend", "Outbound email delivery")
    System_Ext(twilio, "Twilio", "SMS notification delivery")
    System_Ext(sentry, "Sentry", "Error monitoring for frontend and backend")
    System_Ext(r2, "Cloudflare R2", "Object storage for uploaded documents (cloud mode)")

    Rel(lawyer, elms, "Uses", "HTTPS / Tauri WebView")
    Rel(client, elms, "Accesses portal", "HTTPS")
    Rel(admin, elms, "Administers", "HTTPS / Tauri WebView")
    Rel(elms, anthropic, "Streams LLM completions", "HTTPS / SSE")
    Rel(elms, googleVision, "OCR requests", "HTTPS")
    Rel(elms, smtp, "Sends email notifications", "SMTP / HTTPS")
    Rel(elms, twilio, "Sends SMS notifications", "HTTPS")
    Rel(elms, sentry, "Reports errors and traces", "HTTPS")
    Rel(elms, r2, "Stores and retrieves files", "S3-compatible API")
```

---

## 3. C4 Level 2 — Container Diagrams

### 3.1 Cloud Deployment Containers

```mermaid
C4Container
    title ELMS — Cloud Containers

    Person(user, "User", "Browser-based access")

    Container(nginx, "Nginx", "nginx:1.27-alpine", "Reverse proxy. Terminates TLS in production, routes /api to backend, all other paths to frontend. Port 8080 (dev) / 443 (prod).")
    Container(frontend, "Frontend SPA", "node:22-alpine / Vite 7", "React 18 SPA served as static assets. Communicates with backend exclusively via /api. Port 5173.")
    Container(backend, "Backend API", "node:22-alpine / Fastify 5", "REST API. Handles auth, multi-tenancy, business logic, file uploads. Port 7854.")
    ContainerDb(postgres, "PostgreSQL", "postgres:16-alpine", "Primary relational database. All tenant data. Port 5432.")
    ContainerDb(redis, "Redis", "redis:7-alpine", "Refresh token store (CLOUD auth). BullMQ job queue broker. Port 6379.")
    Container(worker, "Extraction Worker", "node:22-alpine", "Standalone BullMQ worker process. Dequeues document extraction jobs from Redis. Runs OCR / parsing. Concurrency: 3.")

    Rel(user, nginx, "HTTPS requests", "TCP 8080 / 443")
    Rel(nginx, frontend, "Proxies static asset requests", "HTTP")
    Rel(nginx, backend, "Proxies /api/* requests", "HTTP")
    Rel(backend, postgres, "Reads/writes data", "TCP 5432 / Prisma")
    Rel(backend, redis, "Stores refresh tokens, enqueues jobs", "TCP 6379")
    Rel(worker, redis, "Dequeues extraction jobs", "TCP 6379 / BullMQ")
    Rel(worker, postgres, "Updates document records", "TCP 5432 / Prisma")
```

### 3.2 Desktop Deployment Containers

```mermaid
C4Container
    title ELMS — Desktop Containers

    Person(user, "User", "Native desktop application")

    Container(tauriShell, "Tauri 2 Rust Shell", "Rust / Tauri 2", "Native application window. Manages OS APIs, desktop notifications, file system access, and the local runtime lifecycle. Spawns Node.js sidecar.")
    Container(webview, "React WebView", "Tauri WebView (system WebView)", "React 18 SPA rendered inside the Tauri window. Uses Tauri JS APIs for OS-level features.")
    Container(sidecar, "Fastify Sidecar", "Bundled Node.js 22 / tsup", "Same Fastify backend as cloud, bundled into dist/server.js. Runs on port 7854. Uses LOCAL auth mode (no Redis).")
    ContainerDb(embeddedPg, "Embedded PostgreSQL", "PostgreSQL 16", "Bundled PostgreSQL instance. Data stored in ~/.local/share/com.elms.desktop/postgres. Port 5433.")

    Rel(user, tauriShell, "Interacts with", "Native OS")
    Rel(tauriShell, webview, "Hosts React app", "Tauri WebView IPC")
    Rel(tauriShell, sidecar, "Spawns and supervises", "Child process / IPC")
    Rel(webview, sidecar, "REST API calls", "HTTP localhost:7854")
    Rel(sidecar, embeddedPg, "Reads/writes data", "TCP 5433 / Prisma")
```

---

## 4. Cloud vs. Desktop Deployment — Narrative Comparison

### 4.1 Networking and Serving

In the **cloud** topology, Nginx acts as the single external entry point. It terminates TLS (via certbot in production), serves frontend static assets, and reverse-proxies all `/api/*` requests to the Fastify backend. The frontend and backend run as separate Docker containers; they never communicate directly outside of the Nginx proxy.

In the **desktop** topology, there is no web server. The Tauri 2 Rust shell spawns a bundled Node.js process (the Fastify sidecar) on `localhost:7854`. The React frontend is loaded directly into the system's WebView engine and calls the sidecar over localhost. No external network access is required for normal operation.

### 4.2 Authentication

The cloud deployment uses **CLOUD auth mode**: RS256 JWT access tokens (15-minute TTL) stored in an `HttpOnly` cookie, backed by UUID refresh tokens persisted in Redis (30-day TTL).

The desktop deployment uses **LOCAL auth mode**: an in-memory session stored in the `elms_local_session` cookie (12-hour TTL). Redis is not required or present.

### 4.3 Storage

Cloud mode uses either the **local filesystem** adapter (for development/testing) or the **Cloudflare R2** adapter for production file storage. The `STORAGE_DRIVER` environment variable selects between them.

Desktop mode always uses the **local filesystem** adapter, writing files relative to `LOCAL_STORAGE_PATH`.

### 4.4 Document Extraction

Cloud mode enqueues extraction jobs into a BullMQ queue backed by Redis. A separate worker process dequeues and processes them at concurrency 3.

Desktop mode runs extraction inline, via `setImmediate`, after the HTTP response is returned to the client. No Redis or separate worker process is involved. See [`extractionDispatcher.ts`](../../packages/backend/src/jobs/extractionDispatcher.ts).

### 4.5 Database

Cloud mode connects to a Docker-managed PostgreSQL 16 instance on port 5432 (`elms_cloud` database).

Desktop mode connects to a bundled PostgreSQL 16 instance on port **5433** (deliberately offset to avoid conflicts with any system-level PostgreSQL). Data is persisted under `~/.local/share/com.elms.desktop/postgres`.

### 4.6 Licensing

Cloud mode uses subscription-based edition tiers managed in the `Firm` database record (`editionKey`).

Desktop mode no longer blocks startup on a local `elms.license` file. Server-side licensing data still exists for edition and lifecycle logic, but desktop launch is gated by local runtime health only. Desktop upgrades are currently distributed as full installers rather than OTA updates.

### 4.7 System Boundaries

| Boundary | Cloud | Desktop |
|---|---|---|
| External network required | Yes (auth, R2, AI, email, SMS) | No (offline capable) |
| Multi-firm | Yes (multi-tenant, firmId partitioned) | No (single firm per install) |
| TLS termination | Nginx + certbot | Not applicable |
| Redis | Required | Not present |
| BullMQ worker | Separate process | Inline (`setImmediate`) |
| PostgreSQL port | 5432 | 5433 |

---

## 5. Backend Module Overview

The `packages/backend/src/modules/` directory contains one subdirectory per domain module. Modules
planned for upcoming phases are listed as _planned_.

| Module | Status | Purpose |
|--------|--------|---------|
| `auth/` | Shipped | Authentication and session management |
| `billing/` | Shipped | Invoices, payments, expenses |
| `billing/eta/` | Planned (Phase 12) | ETA e-invoicing pipeline — `IETAAdapter`, builders, BullMQ queue |
| `cases/` | Shipped | Case lifecycle, parties, assignments, status history |
| `clients/` | Shipped | Client CRM, contacts, portal access |
| `company-formation/` | Planned (Phase 9) | Company formation module — formations, fee items, status history |
| `documents/` | Shipped | Upload, OCR, versioning, full-text search |
| `documents/ocr/` | Shipped + extending | `VlmOcrAdapter` added in Phase 14 alongside existing adapters |
| `editions/` | Shipped | Edition policy, lifecycle scheduler, license validation |
| `hearings/` | Shipped | Court sessions, scheduling, outcomes |
| `integrations/moj/` | Planned (Phase 17) | MoJ/State Council portal adapter stubs |
| `invitations/` | Shipped | Invite flow for cloud onboarding |
| `library/` | Shipped | Law Library — documents, categories, annotations |
| `lookups/` | Shipped | Firm-customizable lookup tables |
| `notifications/` | Shipped | Dispatch hub, channel implementations |
| `notifications/channels/whatsapp.ts` | Planned (Phase 13) | WhatsApp via Meta Cloud API |
| `portal/` | Shipped + extending | Client portal — auth, views, appointment requests (Phase 10) |
| `reports/` | Shipped + extending | Analytics and exports; new reports in Phase 11 |
| `research/` | Shipped | AI Research — RAG, SSE streaming, sessions, citations |
| `roles/` | Shipped | Role and permission management |
| `tasks/` | Shipped | Task lifecycle, assignments |
| `templates/` | Shipped | Document template generation |
| `users/` | Shipped | User management |

### External System Dependencies (Planned Phases)

| External System | Phase | Env Vars |
|----------------|-------|---------|
| Meta WhatsApp Business API | 13 | `WHATSAPP_PROVIDER`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_TEMPLATE_NAMESPACE` |
| OpenAI / Gemini (VLM OCR) | 14 | `VLM_PROVIDER`, `VLM_API_KEY` |
| Egyptian Tax Authority (ETA) | 12 | `ETA_ADAPTER_TYPE`, `ETA_MIDDLEWARE_API_KEY`, `ETA_TAX_REGISTRATION_NUMBER` |
| Digital Egypt portal | 16 | None (browser link only — no server-side integration) |
| MoJ / State Council portal | 17 | TBD (blocked on government API access) |

---

## 6. Related Documents

- [02-tech-stack-rationale.md](./02-tech-stack-rationale.md) — Why each technology was selected
- [03-data-flow.md](./03-data-flow.md) — Authenticated request lifecycle
- [06-deployment-topologies.md](./06-deployment-topologies.md) — Full environment-variable and service configuration per topology
- [08-product-roadmap.md](../business/08-product-roadmap.md) — Phase-by-phase implementation plan
