# Repository Structure

ELMS is a **pnpm monorepo** managed with [Turborepo](https://turbo.build/). All packages declare `"private": true` and are listed under `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

---

## Top-level directory tree

```
legal_system/
├── apps/
│   ├── web/               # Docker + Nginx cloud deployment wrapper
│   └── desktop/           # Tauri 2 desktop application (Rust)
├── packages/
│   ├── backend/           # Fastify REST API (Node.js 22, TypeScript ESM)
│   ├── frontend/          # React 18 SPA (Vite, TanStack Router)
│   └── shared/            # TypeScript DTOs and enums — shared by FE and BE
├── scripts/               # Utility scripts (desktop bundle extras, etc.)
├── tests/
│   ├── e2e/               # Playwright end-to-end tests
│   └── load/              # k6 load test scenarios
├── docs/                  # Developer documentation (this directory)
├── .env.example           # Environment variable template
├── eslint.config.mjs      # Root ESLint configuration
├── package.json           # Root scripts and dev dependencies
├── pnpm-workspace.yaml    # Workspace package globs
├── turbo.json             # Turborepo pipeline configuration
├── tsconfig.base.json     # Shared TypeScript base configuration
└── playwright.config.ts   # Playwright project configuration
```

---

## Package descriptions

### `apps/web`

Contains Docker and Nginx configuration for the cloud SaaS deployment. It provides the `.env.cloud` file that is passed to the backend when running `pnpm dev:web`. It does not contain application source code — that lives in `packages/frontend` and `packages/backend`.

### `apps/desktop`

A [Tauri 2](https://tauri.app/) wrapper that hosts the frontend SPA inside a native OS webview and ships an embedded PostgreSQL instance. The Rust source lives at `apps/desktop/src-tauri/`. It provides `.env.desktop` with `AUTH_MODE=LOCAL`, which enables the local session flow and the single-tenant setup wizard. The desktop build bundles the backend into a single `server.js` file via tsup's `ELMS_BUILD_TARGET=desktop` build target.

### `packages/backend`

The Fastify REST API. Written in TypeScript (ESM), compiled with `tsup`, and run on Node.js 22. Responsibilities:

- HTTP server with 23 route modules (see [API Reference](./06-api-reference.md))
- Prisma ORM with PostgreSQL
- BullMQ task queue backed by Redis
- JWT authentication (cloud) and in-memory local session store (desktop)
- OCR pipeline (Tesseract or Google Vision)
- AI research assistant (Anthropic Claude)
- Background schedulers for reminders and firm lifecycle management

### `packages/frontend`

The React 18 SPA built with Vite. Key technologies:

- [TanStack Router](https://tanstack.com/router) for type-safe client-side routing
- [TanStack Query](https://tanstack.com/query) for data fetching and caching
- [Zustand](https://zustand-demo.pmnd.rs/) for global client state (`authStore`, `portalAuthStore`, `toastStore`)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) for offline support with NetworkFirst caching strategy for `/api/` routes
- Self-hosted WOFF fonts with RTL (Arabic) support via `DirectionProvider`
- Sentry integration with automatic PII scrubbing

### `packages/shared`

Pure TypeScript — no runtime dependencies beyond Zod. Exports are consumed by both the frontend and backend via the `@elms/shared` workspace alias:

- **Enums** — `AuthMode`, `CaseStatus`, `TaskStatus`, `InvoiceStatus`, etc.
- **Types** — `SessionUser`, `AccessTokenClaims`, `AppAuthMode`
- **DTOs** — request/response shapes for auth, firms, users, roles, invitations, clients, cases, hearings, tasks, dashboard, documents, lookups, billing, and notifications

### `scripts/`

Node.js utility scripts that are invoked from package `scripts` fields. Includes the desktop bundle extras assembler.

### `tests/`

- `tests/e2e/` — Playwright tests configured in `playwright.config.ts`
- `tests/load/` — k6 load test scenarios (`api-baseline.js`, `auth.js`, `document-upload.js`)

---

## Turborepo task graph

The pipeline is defined in `turbo.json`:

| Task | Depends on | Cached | Persistent |
|---|---|---|---|
| `build` | `^build` (all package deps must build first) | Yes (`dist/**`, `build/**`, `.turbo/**`) | No |
| `lint` | `^lint` | Yes | No |
| `typecheck` | `^typecheck` | Yes | No |
| `test` | `^test` | Yes | No |
| `dev` | — | No | Yes |

The `^` prefix means a task will not start until the same task has completed successfully in all dependency packages. For example, running `turbo run build` at the repo root ensures `@elms/shared` is compiled before `@elms/backend` or `@elms/frontend` attempt their builds.

Running `pnpm build` at the repo root is equivalent to `turbo run build`.

---

## The `@elms/shared` workspace alias

`tsconfig.base.json` declares a path alias that is inherited by all packages:

```json
{
  "compilerOptions": {
    "paths": {
      "@elms/shared": ["packages/shared/src/index.ts"]
    }
  }
}
```

Both `packages/backend` and `packages/frontend` import shared DTOs and enums directly from source during development:

```typescript
import { CaseStatus, type CaseDto } from "@elms/shared";
```

At build time Turborepo ensures `@elms/shared` is compiled first so the emitted JS is available for downstream packages. At runtime in production the workspace dependency resolves to the compiled output.

---

## Next steps

- [Environment Variables](./03-environment-variables.md)
- [Architecture Internals](./04-architecture-internals.md)
- [Database](./05-database.md)
- [API Reference](./06-api-reference.md)

## Source of truth

- `docs/_inventory/source-of-truth.md`

