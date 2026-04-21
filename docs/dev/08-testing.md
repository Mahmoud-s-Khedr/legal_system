# 08 — Testing

ELMS uses a four-layer testing strategy: unit tests, integration tests, end-to-end (E2E) browser tests, and load tests. This document explains how to run each layer, where the configuration lives, what coverage thresholds are enforced, and how to write new tests.

## Table of Contents

- [Testing Pyramid](#testing-pyramid)
- [Unit Tests — Vitest](#unit-tests--vitest)
  - [Backend Unit Tests](#backend-unit-tests)
  - [Frontend Unit Tests](#frontend-unit-tests)
  - [Coverage Thresholds](#coverage-thresholds)
  - [Running a Single Test File](#running-a-single-test-file)
  - [Writing a New Unit Test](#writing-a-new-unit-test)
- [End-to-End Tests — Playwright](#end-to-end-tests--playwright)
  - [Configuration](#configuration)
  - [Running All E2E Tests](#running-all-e2e-tests)
  - [Running a Single Spec](#running-a-single-spec)
  - [E2E Spec Inventory](#e2e-spec-inventory)
- [Load Tests — k6](#load-tests--k6)
  - [Load Test Inventory](#load-test-inventory)
  - [Running Load Tests](#running-load-tests)
  - [Thresholds](#thresholds)
- [CI Integration](#ci-integration)

---

## Testing Pyramid

```
         ┌──────────┐
         │  k6 load │  tests/load/
         ├──────────┤
         │Playwright│  tests/e2e/
         ├──────────┤
         │  Vitest  │  packages/*/src/**/*.test.ts(x)
         └──────────┘
```

| Layer | Tool | Scope | Config file |
|-------|------|-------|-------------|
| Unit | Vitest | Single module logic | `packages/backend/vitest.config.ts`, `packages/frontend/vitest.config.ts` |
| E2E | Playwright | Full browser flows | `playwright.config.ts` (repo root) |
| Load | k6 | HTTP throughput / latency | `tests/load/*.js` |

---

## Unit Tests — Vitest

### Backend Unit Tests

**Config:** `packages/backend/vitest.config.ts`

```
environment : node
include     : src/**/*.test.ts, src/**/*.spec.ts
coverage    : V8 provider
excluded    : src/**/*.d.ts, src/index.ts, src/server.ts, src/security/{bootstrap,devSeed,librarySeed,lookupSeed}.ts, prisma/**
```

Run commands (from the repo root):

```bash
# Run once
pnpm --filter @elms/backend test

# Watch mode
pnpm --filter @elms/backend test -- --watch

# With coverage report
pnpm --filter @elms/backend test:coverage
```

### Frontend Unit Tests

**Config:** `packages/frontend/vitest.config.ts`

```
environment : jsdom
include     : src/**/*.test.ts(x), src/**/*.spec.ts(x)
coverage    : V8 provider
excluded    : src/**/*.d.ts, src/main.tsx
```

Run commands:

```bash
pnpm --filter @elms/frontend test
pnpm --filter @elms/frontend test:coverage
```

### Coverage Thresholds

Coverage is enforced by Vitest's built-in threshold checking. A build fails in CI if any threshold is not met.

Thresholds are phase-based and selected automatically by date (or overridden with `ELMS_COVERAGE_PHASE=week1|week2|week3|week4`).

| Phase | Date window | `@elms/backend` (L/F/B/S) | `@elms/frontend` (L/F/B/S) | `@elms/shared` (L/F/B/S) |
|---------|-------|----------|-----------|------------|
| Week 1 | 2026-04-22 to 2026-04-28 | 30 / 60 / 60 / 30 | 5 / 20 / 20 / 5 | 70 / 70 / 65 / 70 |
| Week 2 | 2026-04-29 to 2026-05-05 | 45 / 62 / 60 / 45 | 25 / 35 / 30 / 25 | 70 / 70 / 65 / 70 |
| Week 3 | 2026-05-06 to 2026-05-12 | 60 / 65 / 62 / 60 | 50 / 55 / 45 / 50 | 70 / 70 / 65 / 70 |
| Week 4+ | 2026-05-13 onward | 70 / 70 / 65 / 70 | 70 / 70 / 65 / 70 | 70 / 70 / 65 / 70 |

Legend: `L/F/B/S = Lines / Functions / Branches / Statements`.

Coverage artifacts (`lcov`, `json-summary`) are uploaded in CI for later analysis. See [CI Integration](#ci-integration).

Diff coverage is also enforced at `85%` for changed executable lines:

```bash
pnpm coverage:diff
```

To inspect the highest-impact uncovered files from generated summaries:

```bash
pnpm coverage:hotspots
```

### Coverage Scope Policy (Frozen)

Coverage percent is calculated from runtime application paths. To keep denominator changes stable over time, the following are intentionally excluded:

- test/spec files
- TypeScript declaration files (`*.d.ts`)
- backend one-shot bootstrap/seed scripts (`src/security/bootstrap.ts`, `src/security/devSeed.ts`, `src/security/librarySeed.ts`, `src/security/lookupSeed.ts`)

Any future exclusion change must be treated as a policy change and documented in this page and in CI notes.

### Running a Single Test File

Pass a file path or a pattern directly to Vitest:

```bash
# Backend — run one file
pnpm --filter @elms/backend test src/modules/auth/auth.test.ts

# Frontend — match by name
pnpm --filter @elms/frontend test -- --reporter=verbose --testNamePattern="PasswordInput"
```

### Writing a New Unit Test

Place test files alongside the source they test using the `.test.ts` or `.spec.ts` suffix.

Backend example (`packages/backend/src/utils/slugify.test.ts`):

```typescript
import { describe, it, expect } from "vitest";
import { slugify } from "./slugify.js";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("My Law Firm")).toBe("my-law-firm");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("  --hello-- ")).toBe("hello");
  });
});
```

Frontend example (`packages/frontend/src/components/LoginForm.test.tsx`):

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  it("renders email and password fields", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });
});
```

---

## End-to-End Tests — Playwright

### Configuration

**Config:** `playwright.config.ts` (repo root)

```typescript
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173",
    trace: "on-first-retry"
  }
});
```

The default base URL is `http://127.0.0.1:5173`. Override with the `PLAYWRIGHT_BASE_URL` environment variable when targeting a deployed instance.

Traces are captured on the first retry of a failing test to aid debugging.

### Running All E2E Tests

Start the full stack first (both backend and frontend must be running):

```bash
# Terminal 1 — start backend + frontend
pnpm dev:desktop

# Terminal 2 — run all E2E specs
pnpm test:e2e
```

Or with a custom base URL:

```bash
PLAYWRIGHT_BASE_URL=https://staging.elms.example.com pnpm test:e2e
```

### Running a Single Spec

```bash
# By file name
pnpm test:e2e tests/e2e/cloud-auth.smoke.spec.ts

# By test title pattern
pnpm test:e2e --grep "route guard"

# In headed mode (see the browser)
pnpm test:e2e --headed tests/e2e/cloud-auth.smoke.spec.ts
```

### E2E Spec Inventory

All specs are in `tests/e2e/`.

| File | What it tests |
|------|--------------|
| `cloud-auth.smoke.spec.ts` | Route guard redirects unauthenticated users; login page renders correctly with all three language labels |
| `cloud-beta.smoke.spec.ts` | Beta-flag gated features are accessible to authorized users |
| `desktop.smoke.spec.ts` | Desktop shell (Tauri) bootstrap and initial setup flow |
| `billing-workflow.spec.ts` | Invoice creation, line items, payment recording end-to-end |
| `portal-access.spec.ts` | Client portal authentication and case read access |
| `document-upload.spec.ts` | File upload flow — PDF upload, processing status |
| `import-workflow.spec.ts` | CSV/Excel import flow — file selection, preview, confirmation |

---

## Load Tests — k6

Load tests require [k6](https://k6.io) to be installed locally or available in CI.

For Ubuntu/Debian, install with:

```bash
sudo gpg -k
sudo apt-get update
sudo apt-get install -y gnupg ca-certificates
gpg -k || true
curl -fsSL https://dl.k6.io/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install -y k6
```

### Load Test Inventory

All scripts are in `tests/load/`.

| File | Purpose | Default VU stages |
|------|---------|-------------------|
| `api-baseline.js` | Core read paths under concurrent load (dashboard, cases, hearings) | Ramp 0→10→50 VU over 5 min |
| `auth.js` | Login / `GET /me` / logout cycle to benchmark session management and bcrypt cost | Ramp 0→5→20 VU over ~1.5 min |
| `document-upload.js` | Concurrent PDF uploads to measure storage + OCR dispatch throughput | Ramp 0→2→10 VU over ~1.5 min |

Each script authenticates via `POST /api/auth/login` in the `setup()` function and reuses the session cookie across virtual users.

### Running Load Tests

The scripts accept three environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:8080` | API base URL |
| `ADMIN_EMAIL` | `admin@elms.test` | Test admin email |
| `ADMIN_PASSWORD` | `Admin123!` | Test admin password |

Authentication note:
The scripts now support both cloud and local auth modes. They will automatically use `elms_local_session` when present (desktop/local mode) or `elms_access_token` + `elms_refresh_token` in cloud mode.

```bash
# API baseline (via pnpm script)
pnpm test:load

# Auth performance
pnpm test:load:auth

# Upload throughput
pnpm test:load:upload

# Direct k6 invocation with custom target
BASE_URL=https://staging.elms.example.com k6 run tests/load/api-baseline.js
```

### Thresholds

| Script | Metric | Threshold |
|--------|--------|-----------|
| `api-baseline.js` | `http_req_duration` p95 | < 500 ms |
| `api-baseline.js` | `errors` rate | < 1% |
| `api-baseline.js` | `dashboard_latency` p95 | < 800 ms |
| `api-baseline.js` | `cases_latency` p95 | < 500 ms |
| `auth.js` | `login_latency` p95 | < 2000 ms (bcrypt is intentionally slow) |
| `auth.js` | `me_latency` p95 | < 200 ms |
| `document-upload.js` | `upload_latency` p95 | < 3000 ms |
| `document-upload.js` | `errors` rate | < 5% |

---

## CI Integration

The CI pipeline (`.github/workflows/ci.yml`) runs in the following order:

1. `checkout` → `setup pnpm 10.27.0` → `setup node 22` → `setup rust stable`
2. `pnpm install --frozen-lockfile`
3. `pnpm prisma:generate`
4. `lint` — ESLint flat config
5. `typecheck` — TypeScript `tsc --noEmit`
6. `test` — Vitest for backend and frontend
7. `test:coverage` — Vitest with coverage; uploads `lcov` and `json-summary` as GitHub Actions artifacts
8. `coverage:diff` — changed-lines coverage gate (minimum 80%)
9. `coverage:summary` — consolidated summary across backend/frontend/shared, including gap to active threshold and week4 target
10. `build` — Turbo build for all packages
11. Lighthouse CI — runs `lhci autorun` after the build job passes (`.lighthouserc.json`)

E2E and load tests are **not** part of the standard CI pipeline — they are intended for scheduled or manual runs against a deployed environment. Load tests in particular require a real database and should not run against CI infrastructure.

To run E2E tests in CI against a preview deployment, set `PLAYWRIGHT_BASE_URL` as a CI environment variable and invoke `pnpm test:e2e`.

---

Related: [Auth Internals](./07-auth-internals.md) | [Contributing](./09-contributing.md)

## Source of truth

- `docs/_inventory/source-of-truth.md`
