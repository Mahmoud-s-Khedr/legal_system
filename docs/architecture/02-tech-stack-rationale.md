# ELMS Architecture — 02: Tech Stack Rationale

Every major technology choice in ELMS was made deliberately. This document records the reasoning behind each decision so that future contributors understand not just what is used, but why.

---

## 1. Fastify 5 over Express

**Chosen:** Fastify 5
**Rejected alternatives:** Express 4/5, Hono, Koa

### Reasons

**Performance.** Fastify is consistently the fastest Node.js HTTP framework in independent benchmarks, achieving throughput roughly 2–3× higher than Express on equivalent workloads. This matters for an API that handles concurrent file uploads, SSE streams (AI research), and BullMQ worker callbacks.

**Schema-first validation.** Fastify's built-in JSON Schema validation (via `@fastify/ajv-compile`) validates request bodies and serialises response objects before they leave the process. This eliminates an entire class of runtime type errors and reduces attack surface for malformed input — without an additional validation middleware layer.

**TypeScript-first plugin system.** Fastify's `FastifyPluginAsync` pattern and `declare module 'fastify'` augmentation allow the plugin registration order (cookie → CORS → rate-limit → multipart → JWT → sessionContext → firmLifecycleWriteGuard → errorHandler → injectTenant) to be fully type-safe. Each plugin decorates `FastifyRequest` or `FastifyInstance` in a way that downstream handlers can depend on.

**Lifecycle hooks.** Fastify's `preHandler` hook array on each route (e.g., `[requireAuth, requirePermission("documents:read")]`) is idiomatic and composable without middleware ordering footguns.

**Active maintenance.** Fastify 5 targets Node.js 20+ and supports native ESM, aligning with the project's `"type": "module"` ESM-first build.

---

## 2. Prisma 6 over Raw SQL or Drizzle

**Chosen:** Prisma 6
**Rejected alternatives:** Drizzle ORM, Kysely, raw `pg` queries

### Reasons

**Type-safe query results.** Prisma generates a fully-typed client from `schema.prisma`. Every `findMany`, `create`, and `update` call returns TypeScript types inferred from the schema, eliminating manual `as` casts and making refactors safe.

**Migration system.** `prisma migrate dev` produces versioned SQL migration files committed to the repository. This gives a reliable, auditable schema history. Drizzle's push-based workflow is less suitable for a team environment with PostgreSQL-in-Docker and embedded PostgreSQL on desktop.

**Prisma Client for multi-tenancy filtering.** Every service function applies a `firmId` filter on every `findMany` and `findUnique` query. Prisma's fluent API makes this consistent and readable (e.g., `where: { firmId: actor.firmId, id }`). With raw SQL, developers would need to remember to add the filter on every query.

**Relation loading.** Prisma's `include` and `select` syntax makes it straightforward to load nested relations (e.g., Case → CaseAssignment → User → Role) without N+1 problems or hand-written joins.

**Full-text search integration.** PostgreSQL `websearch_to_tsquery` is accessible via Prisma's `$queryRaw` escape hatch where needed (search service), while all CRUD operations stay in the type-safe ORM layer.

---

## 3. TanStack Router over React Router

**Chosen:** TanStack Router 1.x
**Rejected alternatives:** React Router 6/7, Wouter

### Reasons

**Type-safe route params and search params.** TanStack Router infers TypeScript types for every route's `params` and `searchParams` from the route definition. A link to `/cases/$caseId` that receives the wrong param type is a compile-time error, not a runtime 404. This is the most impactful difference: React Router requires manual type annotations and is easy to get wrong.

**First-class search param management.** Legal case lists require complex filter state (status, assignee, date range, court). TanStack Router treats search params as validated, structured state rather than raw strings, with schema validation and automatic serialisation/deserialisation. This replaces a separate URL state management library.

**Loader and code-splitting integration.** TanStack Router's route loaders integrate cleanly with TanStack Query's prefetching pattern, making route-level data fetching explicit and testable.

**No server-side rendering requirement.** ELMS is a SPA (React 18 without Next.js — see Section 7). TanStack Router is designed for SPA navigation, whereas React Router 7 increasingly optimises for SSR/RSC patterns that add complexity the project does not need.

---

## 4. Tauri 2 over Electron

**Chosen:** Tauri 2
**Rejected alternatives:** Electron, NW.js

### Reasons

**No bundled Chromium.** Electron ships a full Chromium binary (~150 MB). Tauri uses the operating system's own WebView (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux), which is already present. ELMS desktop installers are therefore dramatically smaller.

**Rust security model.** The Tauri shell is written in Rust, a memory-safe language. The Tauri capability system (`tauri.conf.json` capabilities) restricts exactly which Tauri APIs the WebView JavaScript is allowed to call. This enforces a Content Security Policy at the process level, not just the HTTP header level.

**Explicit IPC surface.** Tauri 2's command system requires every frontend-to-shell call to be declared as a typed Rust command. There is no implicit `node` module access from the WebView. In Electron, the renderer has direct access to Node.js APIs unless `contextIsolation` is carefully configured.

**Sidecar model.** Tauri's sidecar feature allows the Fastify Node.js process to be bundled and supervised by the Rust shell, with automatic restart on crash and clean shutdown on app close. This is cleaner than Electron's `child_process` management pattern.

**Lower memory footprint.** A Rust process managing a system WebView uses significantly less RAM than an Electron main process with a bundled Chromium.

---

## 5. pnpm 10 + Turborepo over npm/yarn

**Chosen:** pnpm 10 + Turborepo
**Rejected alternatives:** npm workspaces, Yarn Berry, Nx

### Reasons

**pnpm workspace efficiency.** pnpm uses a content-addressable store and hard-links packages across projects. In a monorepo with three packages sharing many dependencies (e.g., `zod`, `@fastify/*`, TypeScript), pnpm avoids duplicating packages in `node_modules`. `pnpm install` is significantly faster than `npm install` on a warm cache.

**Strict dependency isolation.** pnpm's non-flat `node_modules` structure means packages cannot accidentally import transitive dependencies they did not declare. This prevents the "phantom dependency" class of bugs common in npm/Yarn workspaces.

**Turborepo build caching.** Turborepo caches the output of `typecheck`, `build`, `lint`, and `test` tasks. If `@elms/shared` has not changed, Turborepo skips rebuilding it. In CI, this reduces the validate pipeline from a full rebuild to only re-running what changed.

**Task dependency graph.** `turbo.json` declares that `@elms/backend#build` depends on `@elms/shared#build`. Turborepo enforces this ordering automatically. With plain npm workspaces scripts, developers must manually maintain build ordering or use `--workspaces` flags.

**Remote caching.** Turborepo supports remote cache backends (Vercel, self-hosted), enabling cache sharing across CI runners and developer machines.

---

## 6. PostgreSQL 16 over MySQL or SQLite

**Chosen:** PostgreSQL 16
**Rejected alternatives:** MySQL 8, SQLite (for cloud), MariaDB

### Reasons

**Full-text search (`tsvector`/`websearch_to_tsquery`).** ELMS's document search and AI research retrieval are built on PostgreSQL's native full-text search. `websearch_to_tsquery` supports the natural query syntax (e.g., `"contract" AND "termination"`) needed for legal document search. MySQL's FULLTEXT is less expressive; SQLite's FTS5 has a separate, non-standard API.

**JSONB columns.** Notification payload metadata, audit log data, and settings overrides use JSONB columns for flexible structured data without separate tables. JSONB is indexable and queryable with operators that have no MySQL equivalent.

**Cascading deletes and referential integrity.** ELMS relies heavily on `onDelete: Cascade` (e.g., deleting a Firm cascades to all its Cases, Documents, Users, etc.). PostgreSQL's constraint engine handles this atomically. SQLite's cascade support historically had edge cases.

**Prisma support maturity.** Prisma's PostgreSQL connector is its most mature and feature-complete implementation. PostgreSQL-specific features (`$queryRaw` with `to_tsquery`, array operators, advisory locks) are supported. The MySQL connector has documented feature gaps.

**Embedded deployment.** PostgreSQL 16 is bundled directly into the desktop application (port 5433). While SQLite would be lighter, it cannot support the full-text search features, concurrent write patterns, or the Prisma migration system at the same level.

---

## 7. React 18 + Vite over Next.js

**Chosen:** React 18 SPA + Vite 7
**Rejected alternatives:** Next.js 14/15 (App Router), Remix

### Reasons

**Offline desktop compatibility.** Next.js's server-side rendering and App Router require a Node.js server process to render pages. The Tauri desktop app serves the frontend from the system WebView loading local files — there is no web server to run Next.js. A plain SPA built by Vite is simply a directory of HTML/JS/CSS assets that Tauri can load directly.

**Single codebase for two targets.** The same `@elms/frontend` package runs inside a browser (cloud) and inside the Tauri WebView (desktop). A Vite SPA works identically in both environments. Next.js's server components, route handlers, and middleware would all need to be stubbed or disabled for the desktop target.

**Vite dev server speed.** Vite uses native ES modules for development, providing near-instant hot module replacement. The Arabic-first UI has many components; fast HMR meaningfully improves developer productivity. Vite 7's build uses Rolldown (Rust-based) for production bundles, improving build times further.

**Simplified deployment.** In cloud mode, Nginx serves Vite's `dist/` output as static files. There is no Node.js process to manage for the frontend. This reduces the Docker container count and eliminates SSR-related failure modes.

**TanStack Router alignment.** TanStack Router is designed for SPAs. Its file-based routing, loader system, and devtools all assume client-side navigation. Next.js's App Router has its own routing conventions that conflict with TanStack Router.

---

## 8. Zustand 5 over Redux

**Chosen:** Zustand 5
**Rejected alternatives:** Redux Toolkit, Jotai, MobX, Recoil

### Reasons

**Minimal boilerplate.** A Redux Toolkit slice for the session store would require: a slice file, selectors, typed `useAppDispatch`/`useAppSelector` hooks, and a store configuration file. The equivalent Zustand store is a single `create<T>()` call with collocated state and actions.

**TypeScript-first API.** Zustand 5's `create<StoreType>()` infers all action and selector types from the store definition. There are no `PayloadAction<T>` generics or `RootState` type exports needed.

**Outside React.** Zustand stores are plain JavaScript objects accessible outside of React components. The backend-facing auth helpers and notification utilities can read session state without `useSelector` or React context.

**Selective re-renders.** Components subscribe to specific slices of state via selector functions (`useSessionStore(s => s.user)`). Only the components that depend on changed state re-render. This is equivalent to `useSelector` in Redux but without the reducer/dispatch ceremony.

**Small bundle size.** Zustand adds ~1 kB to the bundle. Redux Toolkit adds ~11 kB. For a desktop app where bundle size affects startup time, this matters.

---

## 9. Summary Table

| Technology | Chosen | Key Reason |
|---|---|---|
| HTTP framework | Fastify 5 | Performance, schema validation, typed plugin system |
| ORM | Prisma 6 | Type-safe client, migration system, multi-tenancy filtering |
| Frontend router | TanStack Router 1.x | Type-safe params, structured search params |
| Desktop shell | Tauri 2 | No bundled Chromium, Rust security, sidecar model |
| Package manager | pnpm 10 + Turborepo | Workspace efficiency, build caching, task graph |
| Database | PostgreSQL 16 | Full-text search, JSONB, mature Prisma support |
| Frontend build | React 18 + Vite 7 | SPA for offline desktop, fast HMR, static output |
| State management | Zustand 5 | Minimal boilerplate, TypeScript-first |

---

## Related Documents

- [01-system-overview.md](./01-system-overview.md) — System context and container diagrams
- [03-data-flow.md](./03-data-flow.md) — How the plugin stack processes a live request
- [04-auth-and-security.md](./04-auth-and-security.md) — JWT, RBAC, and security architecture

## Source of truth

- `docs/_inventory/source-of-truth.md`

