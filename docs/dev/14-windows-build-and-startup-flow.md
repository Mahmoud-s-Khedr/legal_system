# 14 - Windows Build and Startup Flow

This document is the implementation runbook for the Windows desktop pipeline and runtime startup lifecycle.

It is intended for:
- Release engineering validating Windows installer builds.
- Desktop runtime engineers debugging startup regressions.
- Support/on-call triaging field reports like login `Failed to fetch`.

## Table of Contents

- [Windows Build Pipeline](#windows-build-pipeline)
- [Bundled Payload Contract](#bundled-payload-contract)
- [Dummy vs Embedded Runtime](#dummy-vs-embedded-runtime)
- [Desktop Startup Flow (Packaged)](#desktop-startup-flow-packaged)
- [Frontend Connectivity Resolution](#frontend-connectivity-resolution)
- [Failure and Recovery Matrix](#failure-and-recovery-matrix)
- [Windows Diagnostics and Log Paths](#windows-diagnostics-and-log-paths)
- [Release Candidate Verification Checklist](#release-candidate-verification-checklist)
- [Source of truth](#source-of-truth)

---

## Windows Build Pipeline

Primary workflow: [ .github/workflows/build-windows.yml ](../../.github/workflows/build-windows.yml)

### End-to-end sequence

1. Checkout source for the target SHA.
2. Setup pnpm + Node + Rust MSVC target (`x86_64-pc-windows-msvc`).
3. Install workspace dependencies and run Prisma generate.
4. Bundle Windows native runtimes using [scripts/bundle-windows-deps.ps1](../../scripts/bundle-windows-deps.ps1):
   - PostgreSQL binaries into `apps/desktop/resources/postgres/`.
   - Node runtime (`node.exe` + runtime DLLs) into `apps/desktop/resources/node/`.
   - PostgreSQL layout manifest `postgres/.layout.env`.
5. Build Tauri NSIS installer via `tauri-action`.
6. Tauri executes `beforeBuildCommand` from [apps/desktop/src-tauri/tauri.conf.json](../../apps/desktop/src-tauri/tauri.conf.json):
   - [apps/desktop/scripts/prepare-desktop-build.mjs](../../apps/desktop/scripts/prepare-desktop-build.mjs)
   - Build backend desktop bundle.
   - Verify desktop resources contract.
   - Build frontend with desktop env flags:
     - `VITE_DESKTOP_SHELL=true`
     - `VITE_DESKTOP_RUNTIME_VARIANT=embedded`
     - `VITE_API_BASE_URL=http://127.0.0.1:7854`
7. Upload NSIS installer artifact.
8. Run verify job:
   - Runtime smoke probe with [scripts/smoke-windows-runtime.ps1](../../scripts/smoke-windows-runtime.ps1).
   - Installer payload verification with [scripts/verify-windows-installer.ps1](../../scripts/verify-windows-installer.ps1).

### Build output

Expected installer location:
- `apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe`

## Bundled Payload Contract

Contract validator: [scripts/desktop-resource-contract.mjs](../../scripts/desktop-resource-contract.mjs)

Required packaged resources include:
- `.env.desktop`
- `packages/frontend/dist/index.html`
- `packages/backend/dist/desktop/server.js`
- `packages/backend/prisma/schema.prisma`
- Prisma runtime packages required by desktop backend
- `postgres/.layout.env`

If contract validation fails, packaging must be treated as failed even if Tauri produced an executable.

## Dummy vs Embedded Runtime

Runtime mode is selected in [apps/desktop/src-tauri/src/main.rs](../../apps/desktop/src-tauri/src/main.rs):
- Embedded runtime starts bootstrap sidecar logic.
- Dummy runtime skips sidecar bootstrap and is intended for frontend-only testing.

Config split:
- Embedded profile: [apps/desktop/src-tauri/tauri.conf.json](../../apps/desktop/src-tauri/tauri.conf.json)
- Dummy profile: [apps/desktop/src-tauri/tauri.dummy.conf.json](../../apps/desktop/src-tauri/tauri.dummy.conf.json)

Operational risk:
- Shipping dummy build to users results in backend-unreachable behavior by design.

## Desktop Startup Flow (Packaged)

Core implementation: [apps/desktop/src-tauri/src/sidecar.rs](../../apps/desktop/src-tauri/src/sidecar.rs)

### Phase timeline

1. App launch and mode detection
- `main.rs` builds Tauri app and decides runtime variant.
- Embedded mode triggers `start_runtime_bootstrap`.

2. Bootstrap initialization
- Initialize runtime state as `starting`.
- Resolve app data directory.
- Create log and postgres data directories.

3. Environment setup
- Load desktop env defaults and overrides.
- Inject bootstrap token for backend identity checks.
- Ensure local session store path.
- Ensure JWT keys for packaged runtime.

4. Embedded PostgreSQL bootstrap
- Validate packaged PostgreSQL resource layout.
- Initialize cluster when needed.
- Start PostgreSQL on configured port (default packaged: `5433`).
- Wait for readiness probe.

5. Database migrations
- Run migration step unless safely skipped by marker and flags.
- Write migration version marker after successful run.

6. Backend sidecar launch
- Resolve bundled Node executable and backend `server.js`.
- Spawn backend process with env and log redirection.
- Poll backend health endpoint on loopback (default `127.0.0.1:7854`).

7. Ready and monitor loop
- Set runtime state to `ready`.
- Start process monitor thread.
- On unexpected backend exit, attempt bounded restart recovery.

### Runtime statuses surfaced to frontend

`desktop_bootstrap_status` returns state values used by the startup gate UI:
- `starting`
- `recovering`
- `ready`
- `failed`

## Frontend Connectivity Resolution

Connectivity logic: [packages/frontend/src/lib/api.ts](../../packages/frontend/src/lib/api.ts)

Resolution precedence:
1. Desktop override loaded from Tauri command `desktop_get_backend_connection`.
2. Local cache (`elms.desktopBackendBaseUrl`).
3. Build-time `VITE_API_BASE_URL` fallback.

Manual override persistence:
- Tauri backend connection storage in [apps/desktop/src-tauri/src/backend_connection.rs](../../apps/desktop/src-tauri/src/backend_connection.rs).
- UI path: [packages/frontend/src/routes/auth/BackendConnectionPage.tsx](../../packages/frontend/src/routes/auth/BackendConnectionPage.tsx).

Why users see `Failed to fetch`:
- Login flow calls `/api/auth/login` through `fetch`.
- If backend is not reachable, browser-level network error is thrown before any HTTP response.

## Failure and Recovery Matrix

| Stage | Symptom | Canonical signal | Primary action |
|---|---|---|---|
| PostgreSQL bootstrap | App never reaches ready | `postgres_startup_failed` or postgres start errors in bootstrap log | Use runtime repair path and verify bundled postgres layout |
| Migration phase | Startup fails after DB init | migration error code text in bootstrap log | Retry bootstrap migration repair or reset local DB if approved |
| Backend spawn | Startup stalls at backend launch | `Backend spawn failed` in bootstrap log | Validate Node bundle, backend dist, prisma runtime packaging |
| Backend health | Startup fails after spawn | `Backend health check failed` | Inspect backend stderr/stdout logs, port conflicts, env mismatch |
| Post-ready runtime | App works then drops connectivity | monitor restart attempts exhausted | Analyze exit reason, crash logs, and restart loop events |

Recovery commands are exposed via Tauri and wired in startup UI actions:
- Retry bootstrap
- Repair migrations
- Repair postgres runtime
- Reset local database

## Windows Diagnostics and Log Paths

Runtime smoke logic references these candidate roots:
- `%APPDATA%/com.elms.desktop/logs`
- `%LOCALAPPDATA%/com.elms.desktop/logs`
- Workspace-dev variants when applicable

Key files to collect:
- `desktop-bootstrap.log`
- `postgres.log`
- `backend.stdout.log`
- `backend.stderr.log`

Triage order:
1. Confirm bootstrap phase transitions in `desktop-bootstrap.log`.
2. Confirm PostgreSQL ready lines in `postgres.log`.
3. Confirm backend launch and health progression.
4. If login shows `Failed to fetch`, verify `/api/health` reachability and effective backend URL override.

## Release Candidate Verification Checklist

1. Run Windows build workflow with pinned runtime versions.
2. Confirm resource contract validation passed before bundle completion.
3. Validate NSIS output exists and matches expected target architecture.
4. Run runtime smoke script and require health probe success.
5. Run installer payload verification script.
6. Archive diagnostics artifacts for traceability.
7. On a clean Windows VM, launch once and verify bootstrap reaches `ready` without manual repair.

## Source of truth

- [ .github/workflows/build-windows.yml ](../../.github/workflows/build-windows.yml)
- [apps/desktop/src-tauri/tauri.conf.json](../../apps/desktop/src-tauri/tauri.conf.json)
- [apps/desktop/src-tauri/tauri.dummy.conf.json](../../apps/desktop/src-tauri/tauri.dummy.conf.json)
- [apps/desktop/scripts/prepare-desktop-build.mjs](../../apps/desktop/scripts/prepare-desktop-build.mjs)
- [scripts/bundle-windows-deps.ps1](../../scripts/bundle-windows-deps.ps1)
- [scripts/desktop-resource-contract.mjs](../../scripts/desktop-resource-contract.mjs)
- [scripts/verify-desktop-resources.mjs](../../scripts/verify-desktop-resources.mjs)
- [scripts/smoke-windows-runtime.ps1](../../scripts/smoke-windows-runtime.ps1)
- [scripts/verify-windows-installer.ps1](../../scripts/verify-windows-installer.ps1)
- [apps/desktop/src-tauri/src/main.rs](../../apps/desktop/src-tauri/src/main.rs)
- [apps/desktop/src-tauri/src/sidecar.rs](../../apps/desktop/src-tauri/src/sidecar.rs)
- [apps/desktop/src-tauri/src/backend_connection.rs](../../apps/desktop/src-tauri/src/backend_connection.rs)
- [packages/frontend/src/lib/api.ts](../../packages/frontend/src/lib/api.ts)
- [packages/frontend/src/store/authStore.ts](../../packages/frontend/src/store/authStore.ts)
- [packages/frontend/src/routes/auth/BackendConnectionPage.tsx](../../packages/frontend/src/routes/auth/BackendConnectionPage.tsx)
