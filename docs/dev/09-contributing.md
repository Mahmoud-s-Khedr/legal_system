# 09 — Contributing

Thank you for taking the time to contribute to ELMS. This document covers the development workflow, coding conventions, how to add new backend modules and frontend routes, and the pull request process.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Development Workflow](#development-workflow)
- [Branch Naming](#branch-naming)
- [Commit Messages](#commit-messages)
- [Pull Request Checklist](#pull-request-checklist)
- [Code Review Process](#code-review-process)
- [Adding a New Backend Module](#adding-a-new-backend-module)
- [Adding a New Frontend Route](#adding-a-new-frontend-route)
- [Code Style and Tooling](#code-style-and-tooling)

---

## Code of Conduct

All contributors are expected to maintain a respectful and professional environment. Harassment, discrimination, or exclusionary behavior toward any participant is not tolerated. Report concerns to the project maintainers.

---

## Development Workflow

1. **Fork** the repository on GitHub (external contributors) or create a branch directly (team members).
2. **Clone** your fork and set the upstream remote:
   ```bash
   git clone https://github.com/<your-org>/elms.git
   cd elms
   git remote add upstream https://github.com/<your-org>/elms.git
   ```
3. **Install dependencies** — requires Node.js 22, pnpm 10.27.0, and Rust stable:
   ```bash
   pnpm install
   pnpm prisma:generate
   ```
4. **Create a branch** from `main` (see [Branch Naming](#branch-naming)).
5. **Develop** — run the dev server with:
   ```bash
   # Web (cloud mode): backend on default port + frontend on :5174
   pnpm dev:web

   # Desktop (Tauri dev shell)
   pnpm dev:tauri
   ```
6. **Test your changes** — all checks must pass before opening a PR:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm test:coverage
   ```
7. **Commit** using the [conventional commit](#commit-messages) format.
8. **Push** your branch and open a pull request against `main`.

---

## Branch Naming

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New functionality | `feature/library-search` |
| `fix/` | Bug fix | `fix/refresh-token-rotation` |
| `chore/` | Tooling, deps, config | `chore/upgrade-prisma-6` |
| `docs/` | Documentation only | `docs/auth-internals` |
| `refactor/` | Code restructuring without behaviour change | `refactor/extract-session-utils` |

Keep branch names short and kebab-cased. Do not include issue numbers in branch names; reference the issue in the PR description instead.

---

## Commit Messages

ELMS follows the [Conventional Commits](https://www.conventionalcommits.org/) specification.

**Format:**

```
<type>(<scope>): <short description>

[optional body — wrap at 72 characters]

[optional footer — BREAKING CHANGE: ..., Closes #123]
```

**Types:**

| Type | When to use |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `style` | Formatting, whitespace (no logic change) |
| `refactor` | Code restructuring without behaviour change |
| `test` | Adding or fixing tests |
| `chore` | Build process, dependency updates, tooling |
| `perf` | Performance improvement |

**Scopes** (optional, use the affected package or module): `auth`, `backend`, `frontend`, `desktop`, `billing`, `documents`, `i18n`, `ci`, etc.

**Examples:**

```
feat(auth): implement refresh token rotation

fix(billing): correct invoice total rounding on multi-currency

chore(deps): upgrade @fastify/jwt to 9.0.0

docs(auth): add cookie security table to 07-auth-internals

feat(i18n)!: rename auth namespace to authentication

BREAKING CHANGE: translation key prefix changed from "auth." to "authentication."
```

---

## Pull Request Checklist

Before requesting review, confirm all of the following:

- [ ] **Lint passes** — `pnpm lint` exits with code 0
- [ ] **TypeScript compiles** — `pnpm typecheck` exits with code 0
- [ ] **Tests pass** — `pnpm test` exits with code 0
- [ ] **Coverage thresholds met** — `pnpm test:coverage` does not fail on thresholds (see [Testing](./08-testing.md))
- [ ] **New code has tests** — any new service function or utility has at least one Vitest unit test
- [ ] **No secrets committed** — `.env` files, private keys, and credentials are excluded
- [ ] **Migrations are included** — schema changes include the corresponding Prisma migration file
- [ ] **i18n keys added** — any new UI copy has entries in all three locale files (`en`, `ar`, `fr`); run `pnpm tsx scripts/i18n-audit.ts` to verify
- [ ] **PR description** explains the motivation and links the related issue

### Windows-First Audit (Required for desktop/backend runtime-impacting changes)

If your PR touches `apps/desktop/**` or `packages/backend/**`, include an explicit Windows compatibility self-review before requesting approval:

- [ ] No hardcoded POSIX-only paths/assumptions in runtime code paths
- [ ] No shell-specific runtime invocation that breaks on Windows (`sh`, `bash`, POSIX wrappers)
- [ ] Executable resolution remains platform-aware (`node`/`node.exe`, PostgreSQL tools)
- [ ] Packaging/resource paths work with Windows path semantics
- [ ] `build-windows` CI should pass, including runtime smoke and installer payload verification

---

## Code Review Process

1. All pull requests require at least **one approving review** from a maintainer before merging.
2. The Windows desktop workflow (`build-windows`) is the required merge gate. Other platform desktop workflows are informational unless release policy explicitly requires them.
3. Reviewers may request changes. Address each comment with either a code change or a reply explaining why no change is needed.
4. Once approved and CI is green, a maintainer will squash-merge the PR into `main`.
5. The merge commit message follows the same conventional commit format as individual commits.

---

## Adding a New Backend Module

Backend modules follow a consistent two-file pattern: a route registration file and a service file.

### 1. Create the service

```
packages/backend/src/modules/<feature>/<feature>.service.ts
```

```typescript
// packages/backend/src/modules/notes/notes.service.ts
import { prisma } from "../../db/prisma.js";

export async function listNotes(firmId: string) {
  return prisma.note.findMany({ where: { firmId } });
}

export async function createNote(firmId: string, content: string) {
  return prisma.note.create({ data: { firmId, content } });
}
```

### 2. Create the routes file

```
packages/backend/src/modules/<feature>/<feature>.routes.ts
```

```typescript
// packages/backend/src/modules/notes/notes.routes.ts
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { listNotes, createNote } from "./notes.service.js";

export async function registerNotesRoutes(app: FastifyInstance) {
  app.get(
    "/api/notes",
    { preHandler: requirePermission("notes:read") },
    async (request) => {
      return listNotes(request.sessionUser!.firmId);
    }
  );

  app.post(
    "/api/notes",
    { preHandler: requirePermission("notes:create") },
    async (request) => {
      const { content } = request.body as { content: string };
      return createNote(request.sessionUser!.firmId, content);
    }
  );
}
```

### 3. Register in app.ts

Open `packages/backend/src/app.ts` and add the import and registration call alongside the other modules:

```typescript
import { registerNotesRoutes } from "./modules/notes/notes.routes.js";

// Inside createApp(), after the other registerXxxRoutes calls:
await registerNotesRoutes(app);
```

### 4. Add permission constants

If your module introduces new permissions, add them to `DEFAULT_PERMISSIONS` in `packages/backend/src/config/constants.ts`:

```typescript
"notes:create",
"notes:read",
"notes:update",
"notes:delete",
```

### 5. Write tests

Create `packages/backend/src/modules/notes/notes.service.test.ts` and test each service function in isolation using a mocked Prisma client.

---

## Adding a New Frontend Route

ELMS uses TanStack Router. Routes are defined as file-based or code-based route objects inside the `packages/frontend/src/` directory.

### 1. Create the page component

```
packages/frontend/src/pages/Notes.tsx
```

```typescript
// packages/frontend/src/pages/Notes.tsx
export function NotesPage() {
  return <div>Notes</div>;
}
```

### 2. Create the route definition

```
packages/frontend/src/routes/notes.tsx
```

```typescript
import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./root";
import { NotesPage } from "../pages/Notes";

export const notesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/notes",
  component: NotesPage
});
```

### 3. Register the route

Add the new route to the router in `packages/frontend/src/router.ts` (or whichever file assembles the `routeTree`):

```typescript
import { notesRoute } from "./routes/notes";

const routeTree = rootRoute.addChildren([
  // ... existing routes ...
  notesRoute
]);
```

### 4. Add navigation (optional)

Add a sidebar link or navigation entry pointing to `/app/notes`.

### 5. Add i18n keys

Add the page title and any UI copy to all three locale files:

```json
// packages/frontend/src/i18n/locales/en/app.json
{
  "notes": {
    "title": "Notes",
    "empty": "No notes yet."
  }
}
```

Run the audit script to verify completeness:

```bash
pnpm tsx scripts/i18n-audit.ts
```

---

## Code Style and Tooling

| Tool | Config file | Run |
|------|------------|-----|
| ESLint | `eslint.config.mjs` (flat config) | `pnpm lint` |
| Prettier | `.prettierrc.json` | `pnpm format:check` |
| TypeScript | `tsconfig.base.json` + per-package `tsconfig.json` | `pnpm typecheck` |
| Turbo | `turbo.json` | `pnpm build` |

Key style rules:

- **No semicolons** — Prettier `semi: false` rule.
- **ESM throughout** — all packages use `"type": "module"`. Use `.js` extensions in imports even for TypeScript files.
- **TypeScript strict mode** — `"strict": true` is inherited from `tsconfig.base.json`.
- **No `any`** — avoid explicit `any` casts; prefer `unknown` and type guards.
- **Imports** — group imports: Node built-ins first, then external packages, then internal aliases, then relative imports.

---

Related: [Testing](./08-testing.md) | [Scripts](./10-scripts.md) | [i18n](./12-i18n.md)

## Source of truth

- `docs/_inventory/source-of-truth.md`
