# Build Process Review

Date: 2026-03-24

## Executive Summary

Release readiness is currently **not acceptable** for CI validation, cloud deployment, or desktop release packaging.

Top 5 build risks:

1. `pnpm install --frozen-lockfile` fails, so the main CI pipeline cannot reproduce dependencies from the committed manifests and lockfile.
2. All desktop release workflows are hard-blocked by an empty updater public key in `tauri.conf.json`.
3. Manual Linux desktop packaging can produce `.deb` and `.rpm` artifacts with placeholder Node/PostgreSQL resources instead of bundled runtimes.
4. The Docker image build path sends a 4+ GB build context because there is no `.dockerignore`, making local and deployment builds slow and fragile.
5. Several nominal build/quality entrypoints are misleading: `pnpm build` passes while lint, typecheck, tests, and coverage all fail; `@elms/desktop build` is only `cargo check`; `@elms/web build` is only `docker compose config`.

Overall verdict:

| Surface | Verdict | Reason |
|---|---|---|
| Local development builds | Partial | Package builds run, but quality gates are red and root build gives a false-green signal. |
| CI validation builds | Blocked | `pnpm install --frozen-lockfile`, `lint`, `typecheck`, `test`, and `test:coverage` all fail locally. |
| Cloud deployment builds | At risk | Docker build context is enormous and the web "build" step does not build release artifacts. |
| Desktop release builds | Blocked | CI release workflows stop on empty updater pubkey; local Linux full bundling fails on AppImage and can package placeholders. |

## Build Matrix

### Root / CI Validation Paths

| Entry point | Command | Local result | Evidence | Outputs / Notes | Consumer |
|---|---|---:|---|---|---|
| Install | `pnpm install --frozen-lockfile` | Fail | 0.96s | Lockfile out of date vs `packages/backend/package.json` | [ci.yml](/home/mk/Projects/CV_projects/legal_system/.github/workflows/ci.yml#L29) |
| Prisma generate | `pnpm prisma:generate` | Pass with warning | 2.83s | Prisma warns `package.json#prisma` is deprecated | [package.json](/home/mk/Projects/CV_projects/legal_system/package.json#L26) |
| Lint | `pnpm lint` | Fail | 13.43s | Frontend has 4 unused-var errors; desktop/web lint are placeholders | [package.json](/home/mk/Projects/CV_projects/legal_system/package.json#L14), [apps/desktop/package.json](/home/mk/Projects/CV_projects/legal_system/apps/desktop/package.json#L7), [archive/cloud/apps/web/package.json](/home/mk/Projects/CV_projects/legal_system/archive/cloud/apps/web/package.json#L7) |
| Typecheck | `pnpm typecheck` | Fail | 17.56s | Backend has many TS errors; desktop/web typecheck are placeholders | [package.json](/home/mk/Projects/CV_projects/legal_system/package.json#L15), [apps/desktop/package.json](/home/mk/Projects/CV_projects/legal_system/apps/desktop/package.json#L8), [archive/cloud/apps/web/package.json](/home/mk/Projects/CV_projects/legal_system/archive/cloud/apps/web/package.json#L8) |
| Test | `pnpm test` | Fail | 9.71s | Backend has 2 failing tests; desktop/web test are placeholders | [package.json](/home/mk/Projects/CV_projects/legal_system/package.json#L16), [apps/desktop/package.json](/home/mk/Projects/CV_projects/legal_system/apps/desktop/package.json#L9), [archive/cloud/apps/web/package.json](/home/mk/Projects/CV_projects/legal_system/archive/cloud/apps/web/package.json#L9) |
| Coverage | `pnpm test:coverage` | Fail | 5.94s | Shared package has no tests but enforces 70% thresholds | [package.json](/home/mk/Projects/CV_projects/legal_system/package.json#L17), [ci.yml](/home/mk/Projects/CV_projects/legal_system/.github/workflows/ci.yml#L44) |
| Build | `pnpm build` | Pass | 11.26s | Succeeds despite red lint/typecheck/test/coverage | [package.json](/home/mk/Projects/CV_projects/legal_system/package.json#L13) |

### Package Build Paths

| Entry point | Command | Local result | Evidence | Outputs / Notes |
|---|---|---:|---|---|
| Backend cloud build | `pnpm --filter @elms/backend build` | Pass | 18.41s | `dist/index.js`, `dist/server.js`, chunks, d.ts |
| Backend desktop build | `pnpm --filter @elms/backend build:desktop` | Pass with warnings | 35.48s | 22.56 MB bundled `server.js`; `desktop-bundle-extras` runs `pnpm deploy --prod`; warnings for unsupported `vite-plugin-pwa` peer and ignored `@prisma/engines` build scripts |
| Frontend web build | `pnpm --filter @elms/frontend build` | Pass with warning | 22.26s | Emits PWA files; Vite warns about circular chunk graph |
| Frontend desktop build | `VITE_DESKTOP_SHELL=true VITE_API_BASE_URL=http://127.0.0.1:7854 pnpm --filter @elms/frontend build` | Pass with warning | 18.99s | No PWA output; same circular chunk warning |

### Cloud / Container Paths

| Entry point | Command | Local result | Evidence | Outputs / Notes | Consumer |
|---|---|---:|---|---|---|
| Frontend image build | `docker build -f archive/cloud/apps/web/Dockerfile ...` | Not executed after backend context failure | Static review | Same missing `.dockerignore` issue expected | [scripts/deploy-cloud.sh](/home/mk/Projects/CV_projects/legal_system/archive/cloud/scripts/deploy-cloud.sh#L14) |
| Backend image build | `docker build -f archive/cloud/apps/web/backend.Dockerfile ...` | Canceled | 71.73s | Still uploading 4.02 GB build context when canceled | [archive/cloud/apps/web/backend.Dockerfile](/home/mk/Projects/CV_projects/legal_system/archive/cloud/apps/web/backend.Dockerfile#L13), [scripts/deploy-cloud.sh](/home/mk/Projects/CV_projects/legal_system/archive/cloud/scripts/deploy-cloud.sh#L13) |
| Web package build | `pnpm --filter @elms/web build` | Pass | via `pnpm build` | Only validates Compose config; does not build images or assets | [archive/cloud/apps/web/package.json](/home/mk/Projects/CV_projects/legal_system/archive/cloud/apps/web/package.json#L6) |

### Desktop Release Paths

| Entry point | Command | Local result | Evidence | Outputs / Notes | Consumer |
|---|---|---:|---|---|---|
| Desktop package build | `pnpm --filter @elms/desktop build` | Pass | via `pnpm build` | Only `cargo check`; no release binary or bundle | [apps/desktop/package.json](/home/mk/Projects/CV_projects/legal_system/apps/desktop/package.json#L6) |
| Tauri compile only | `pnpm --filter @elms/desktop tauri build --no-bundle --ci` | Pass | 108.10s | Built `target/release/elms-desktop` | [tauri.conf.json](/home/mk/Projects/CV_projects/legal_system/apps/desktop/src-tauri/tauri.conf.json#L8) |
| Tauri Linux bundles | `pnpm --filter @elms/desktop tauri build --bundles appimage,deb,rpm --ci` | Fail | 110.39s | `.deb` and `.rpm` were created; AppImage failed with `failed to run linuxdeploy` | [apps/desktop/package.json](/home/mk/Projects/CV_projects/legal_system/apps/desktop/package.json#L13) |

## Findings

### Critical

| ID | Finding | Evidence | Repro | Impact | Smallest safe remediation |
|---|---|---|---|---|---|
| C1 | CI is not reproducible because the lockfile is out of sync with the manifests. | `pnpm install --frozen-lockfile` fails immediately; `ci.yml`, `build-linux.yml`, `build-windows.yml`, and `build-macos.yml` all depend on frozen installs. | `pnpm install --frozen-lockfile` | Main CI validation never gets past install; all downstream release workflows are also blocked. | Refresh `pnpm-lock.yaml` from the current manifests, commit it, and add a pre-merge check that rejects manifest-only dependency edits. |
| C2 | All desktop release workflows are hard-blocked by an empty updater public key. | `plugins.updater.pubkey` is empty in [tauri.conf.json](/home/mk/Projects/CV_projects/legal_system/apps/desktop/src-tauri/tauri.conf.json#L27); Linux, Windows, and macOS workflows fail fast on that condition at [build-linux.yml](/home/mk/Projects/CV_projects/legal_system/.github/workflows/build-linux.yml#L32), [build-windows.yml](/home/mk/Projects/CV_projects/legal_system/.github/workflows/build-windows.yml#L32), and [build-macos.yml](/home/mk/Projects/CV_projects/legal_system/.github/workflows/build-macos.yml#L28). | Static review; no command needed. | Desktop release CI cannot succeed from the current snapshot. | Populate the updater pubkey from the real signing keypair and make it part of release setup validation. |
| C3 | Manual Linux packaging can silently ship placeholder runtimes instead of bundled Node/PostgreSQL. | The local full bundle produced `.deb` and `.rpm` that contain `usr/lib/ELMS/node/placeholder` and `usr/lib/ELMS/postgres/placeholder`; the source resources directory contains only placeholders. | `pnpm --filter @elms/desktop tauri build --bundles appimage,deb,rpm --ci` followed by inspecting the produced `.deb`/`.rpm` | A seemingly valid desktop installer can be built without the embedded runtimes it requires. | Make runtime bundling/verification part of `beforeBuildCommand` or fail the Tauri build when placeholder files are present; do not rely on humans remembering a separate pre-step. |

### High

| ID | Finding | Evidence | Repro | Impact | Smallest safe remediation |
|---|---|---|---|---|---|
| H1 | `pnpm build` and `apps/desktop build` provide false confidence about release readiness. | Root `build` only runs package `build` scripts at [package.json](/home/mk/Projects/CV_projects/legal_system/package.json#L13); desktop `build` is only `cargo check` at [apps/desktop/package.json](/home/mk/Projects/CV_projects/legal_system/apps/desktop/package.json#L6). Local `pnpm build` passed even though lint, typecheck, tests, coverage, and full bundling failed. | `pnpm build` and compare to `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`, `pnpm --filter @elms/desktop tauri build --bundles ... --ci` | Engineers can treat a green root build as release-ready when it is not. | Rename scripts to match behavior (`check`, `cargo:check`, `compose:validate`) or add explicit release-build scripts that are the ones documented and used in CI. |
| H2 | Cloud image builds are operationally weak because there is no `.dockerignore`, so the build context balloons to multi-GB size. | No `.dockerignore` exists in the repo root; backend Docker build was still uploading a 4.02 GB context after 71.73s when canceled. Both Dockerfiles use `COPY . .`. | `docker build -f archive/cloud/apps/web/backend.Dockerfile -t elms-backend:review .` | Slow, bandwidth-heavy, and failure-prone container builds; generated artifacts and caches leak into image build context. | Add a strict root `.dockerignore` excluding `node_modules`, `target`, `dist`, `.turbo`, coverage, logs, and temp artifacts; then re-measure context size. |
| H3 | Desktop packaging is nondeterministic and oversized because cloud-build leftovers remain in `packages/backend/dist` and get bundled into desktop artifacts. | Desktop backend build writes into the same `dist/` tree used by the cloud build; the Tauri bundle copies the entire `packages/backend/dist` directory. Produced `.deb`/`.rpm` contain both `server.js` and cloud leftovers like `index.js` and `chunk-*.js`. | `pnpm --filter @elms/backend build && pnpm --filter @elms/backend build:desktop` then inspect packaged artifacts | Desktop artifacts are larger than necessary and depend on build history/order, not just the current target. | Clean `packages/backend/dist` before `build:desktop`, or split cloud and desktop outputs into separate directories. |
| H4 | CI quality gates are red across multiple layers. | `pnpm lint` fails in frontend; `pnpm typecheck` fails heavily in backend; `pnpm test` fails with 2 backend test failures; `pnpm test:coverage` fails in shared due zero tests with 70% thresholds. | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage` | Even after the lockfile is fixed, the validate job will still fail and block releases. | Fix the gate failures in priority order: lockfile, lint, backend typecheck, failing tests, then coverage policy/test content. |
| H5 | Local Linux full bundling is not fully reproducible: AppImage generation fails with `failed to run linuxdeploy`. | `pnpm --filter @elms/desktop tauri build --bundles appimage,deb,rpm --ci` exited 1 after producing `.deb` and `.rpm` but failing on AppImage. Docs recommend this path at [docs/dev/11-desktop-build.md](./11-desktop-build.md). | `pnpm --filter @elms/desktop tauri build --bundles appimage,deb,rpm --ci` | The documented local Linux release path is not fully reliable on this machine. | Capture full `linuxdeploy` diagnostics in CI and local scripts; add a dedicated smoke script for AppImage generation rather than treating bundle success as implicit. |

### Medium

| ID | Finding | Evidence | Repro | Impact | Smallest safe remediation |
|---|---|---|---|---|---|
| M1 | `@elms/web build` is named like a release build but only validates Compose configuration. | The script at [archive/cloud/apps/web/package.json](/home/mk/Projects/CV_projects/legal_system/archive/cloud/apps/web/package.json#L6) runs `docker compose ... config > /dev/null`. | `pnpm --filter @elms/web build` | Script naming obscures the difference between config validation and actual image/artifact creation. | Rename it to `compose:validate` and add explicit `docker:build` or deployment-image build scripts. |
| M2 | Desktop, web, and some Turbo tasks are placeholders that do not validate what their names imply. | Desktop/web `lint`, `typecheck`, and `test` scripts are `node -e "process.exit(0)"` at [apps/desktop/package.json](/home/mk/Projects/CV_projects/legal_system/apps/desktop/package.json#L7) and [archive/cloud/apps/web/package.json](/home/mk/Projects/CV_projects/legal_system/archive/cloud/apps/web/package.json#L7). | `pnpm --filter @elms/desktop lint`, `pnpm --filter @elms/web test` | Task names overstate coverage, and Turbo output can look healthier than it is. | Replace placeholders with real checks or remove them from the Turbo graph until real checks exist. |
| M3 | Frontend bundling has unresolved chunking issues. | Both frontend build modes warn: `Circular chunk: vendor -> vendor-react -> vendor`. The manual chunking logic is at [vite.config.ts](/home/mk/Projects/CV_projects/legal_system/packages/frontend/vite.config.ts#L68). | `pnpm --filter @elms/frontend build` | Bundle structure is not stable and could regress caching or load behavior. | Simplify `manualChunks` or refactor the chunking rules to avoid circular vendor assignments. |
| M4 | The desktop dependency bundling helper carries unsupported dependency state into release builds. | `desktop-bundle-extras` uses `pnpm deploy --prod` at [scripts/desktop-bundle-extras.mjs](/home/mk/Projects/CV_projects/legal_system/scripts/desktop-bundle-extras.mjs#L68); it surfaced an unsupported peer dependency (`vite-plugin-pwa` vs Vite 7) and ignored `@prisma/engines` build scripts during execution. | `pnpm --filter @elms/backend build:desktop` | The desktop bundle path depends on warnings that could become hard failures on future toolchain upgrades. | Resolve the peer mismatch and explicitly approve/handle required package build scripts. |
| M5 | Prisma configuration is on a deprecated path. | `pnpm prisma:generate` warns that `package.json#prisma` is deprecated; config currently lives at [packages/backend/package.json](/home/mk/Projects/CV_projects/legal_system/packages/backend/package.json#L62). | `pnpm prisma:generate` | Not an immediate blocker, but guaranteed future migration work. | Move Prisma config to `prisma.config.ts` before the Prisma 7 upgrade window. |

## Watchlist Items

- Frontend production builds succeed but always emit the Vite circular chunk warning.
- `@elms/web build` does not build release artifacts.
- `@elms/desktop build` does not exercise release packaging.
- Desktop bundle contents need stronger validation: local manual artifacts included placeholder runtimes and stale backend cloud outputs.
- Build docs and script names drift from actual behavior by overstating what "build" validates.

## Command Results

| Command | Status | Time | Key notes |
|---|---:|---:|---|
| `pnpm install --frozen-lockfile` | Fail | 0.96s | Lockfile mismatch |
| `pnpm prisma:generate` | Pass with warning | 2.83s | Prisma config deprecation |
| `pnpm lint` | Fail | 13.43s | Frontend unused vars; desktop/web placeholder lint |
| `pnpm typecheck` | Fail | 17.56s | Many backend TS errors |
| `pnpm test` | Fail | 9.71s | 2 backend test failures |
| `pnpm test:coverage` | Fail | 5.94s | Shared package 0% coverage vs 70% threshold |
| `pnpm build` | Pass | 11.26s | False-green relative to full validation |
| `pnpm --filter @elms/backend build` | Pass | 18.41s | Cloud build path |
| `pnpm --filter @elms/backend build:desktop` | Pass with warnings | 35.48s | Desktop bundle prep |
| `pnpm --filter @elms/frontend build` | Pass with warning | 22.26s | Web build path, PWA output |
| `VITE_DESKTOP_SHELL=true ... pnpm --filter @elms/frontend build` | Pass with warning | 18.99s | Desktop frontend build |
| `docker build -f archive/cloud/apps/web/backend.Dockerfile ...` | Canceled | 71.73s | 4.02 GB context already uploaded |
| `pnpm --filter @elms/desktop tauri build --no-bundle --ci` | Pass | 108.10s | Release binary built |
| `pnpm --filter @elms/desktop tauri build --bundles appimage,deb,rpm --ci` | Fail | 110.39s | `linuxdeploy` failure after partial bundle output |

## Artifact Notes

- `packages/backend/dist` measured **661 MB** after mixed cloud + desktop build activity.
- `packages/frontend/dist` measured **2.4 MB**.
- Produced Linux package sizes:
  - `ELMS_0.1.0_amd64.deb`: **183 MB**
  - `ELMS-0.1.0-1.x86_64.rpm`: **185 MB**
- `apps/desktop/src-tauri/target/release` grew to **5.1 GB** during local packaging.

## Static Review Only Items

- Windows desktop release path: not executed locally; assessed from workflow/scripts only.
- macOS desktop release path: not executed locally; assessed from workflow/scripts only.
- Hosted GitHub Actions behavior: not executed in GitHub; conclusions are based on local repro plus workflow inspection.

## Assumptions

- This review used the current local workspace snapshot without attempting to repair build failures.
- Docker findings reflect the repository as built from the workspace root with current generated artifacts present.
- Desktop placeholder-runtime finding applies to manual/local packaging paths that skip the platform bundling step; CI Linux workflow does include `bundle-linux-deps.sh` before packaging.

## Source of truth

- `docs/_inventory/source-of-truth.md`
