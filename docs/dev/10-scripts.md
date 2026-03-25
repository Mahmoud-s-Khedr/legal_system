# 10 — Scripts Reference

All scripts live in the `scripts/` directory at the repository root. This document describes every script, when to use it, required environment variables, and usage examples.

## Table of Contents

- [backup-postgres.sh](#backup-postgressh)
- [restore-postgres.sh](#restore-postgressh)
- [deploy-cloud.sh](#deploy-cloudsh)
- [bundle-linux-deps.sh](#bundle-linux-depssh)
- [bundle-windows-deps.ps1](#bundle-windows-depsps1)
- [check-lockfile.sh](#check-lockfilesh)
- [check-desktop-packaging-host.sh](#check-desktop-packaging-hostsh)
- [desktop-bundle-extras.mjs](#desktop-bundle-extrasmjs)
- [generate-license.ts](#generate-licensets)
- [i18n-audit.ts](#i18n-auditts)
- [package-desktop-linux.sh](#package-desktop-linuxsh)
- [release-desktop-local.sh](#release-desktop-localsh)
- [verify-desktop-resources.sh](#verify-desktop-resourcessh)
- [verify-desktop-runtime.sh](#verify-desktop-runtimesh)
- [verify-windows-installer.mjs](#verify-windows-installermjs)

---

## backup-postgres.sh

**What it does:** Dumps the cloud PostgreSQL database to a gzip-compressed SQL file, prunes local backups older than `LOCAL_RETENTION_DAYS`, and optionally uploads the file to remote storage.

**When to use:** On a cron schedule in production to create point-in-time backups. Run manually before a risky migration or deployment.

**How it works:**
1. Runs `pg_dump` inside the `postgres` Docker Compose service, piping output through `gzip` to `<BACKUP_DIR>/elms-<TIMESTAMP>.sql.gz`.
2. Deletes local `*.sql.gz` files in `BACKUP_DIR` older than `LOCAL_RETENTION_DAYS`.
3. If `BACKUP_UPLOAD_COMMAND` is set, evaluates it with the dump path as the last argument (e.g., `aws s3 cp`).

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `COMPOSE_FILE` | `apps/web/docker-compose.prod.yml` | Path to the Docker Compose file |
| `BACKUP_DIR` | `.backups/` (repo root) | Directory where dumps are written |
| `POSTGRES_DB` | `elms_cloud` | Database name |
| `POSTGRES_USER` | `elms` | PostgreSQL user |
| `LOCAL_RETENTION_DAYS` | `7` | Days before local dumps are deleted |
| `BACKUP_UPLOAD_COMMAND` | _(unset)_ | Shell command to upload the dump, receives the dump path as the last argument |

**Usage:**

```bash
# Standard backup
bash scripts/backup-postgres.sh

# With S3 upload
BACKUP_UPLOAD_COMMAND="aws s3 cp" bash scripts/backup-postgres.sh

# Custom database and retention
POSTGRES_DB=elms_staging LOCAL_RETENTION_DAYS=14 bash scripts/backup-postgres.sh
```

---

## restore-postgres.sh

**What it does:** Restores a PostgreSQL database from a gzip-compressed SQL dump created by `backup-postgres.sh`.

**When to use:** Disaster recovery, restoring a staging environment from a production backup, or testing a backup's integrity.

**How it works:** Decompresses the dump with `gunzip -c` and pipes it into `psql` running inside the `postgres` Docker Compose container.

> **Warning:** This overwrites the target database. Ensure the database is not in active use before restoring.

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `COMPOSE_FILE` | `apps/web/docker-compose.prod.yml` | Path to the Docker Compose file |
| `POSTGRES_DB` | `elms_cloud` | Target database name |
| `POSTGRES_USER` | `elms` | PostgreSQL user |

**Usage:**

```bash
bash scripts/restore-postgres.sh .backups/elms-20260321T120000Z.sql.gz
```

The script exits with an error if the backup file argument is missing or the file does not exist.

---

## deploy-cloud.sh

**What it does:** Performs a zero-downtime rolling deployment of the cloud stack using Docker Compose.

**When to use:** Deploying a new release to a production or staging server.

**How it works:**
1. Builds local Docker images for backend and frontend by default (`apps/web/backend.Dockerfile` and `apps/web/Dockerfile`).
2. Pulls third-party images for `postgres`, `redis`, and `edge` services.
3. Runs database migrations via the short-lived `migrate` service (`docker compose run --rm migrate`).
4. Starts or replaces containers for `postgres`, `redis`, `backend`, `web`, and `edge` with `up -d`.
5. Prints container status with `docker compose ps`.

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `COMPOSE_FILE` | `apps/web/docker-compose.prod.yml` | Path to the Docker Compose file |
| `BACKEND_IMAGE` | `elms-backend:local` | Local image tag used for backend and migration services |
| `FRONTEND_IMAGE` | `elms-frontend:local` | Local image tag used for frontend service |
| `BUILD_LOCAL_IMAGES` | `1` | Build backend/frontend images locally before compose up (`0` to skip) |

**Usage:**

```bash
# Deploy from repo root
bash scripts/deploy-cloud.sh

# Point to a different compose file
COMPOSE_FILE=/srv/elms/docker-compose.yml bash scripts/deploy-cloud.sh
```

---

## bundle-linux-deps.sh

**What it does:** Downloads or extracts PostgreSQL and Node.js Linux binaries into `apps/desktop/resources/` for inclusion in the desktop AppImage/deb/rpm installer.

**When to use:** Run once before building the Tauri desktop package on Linux — either locally or as a CI step. The script is idempotent: it skips downloads if `.bundle-complete` sentinel files exist.

**How it works:**
- **PostgreSQL:** Installs PostgreSQL via `apt-get` (Ubuntu) or `dnf` (Fedora) if not already present. Copies five executables (`pg_ctl`, `initdb`, `pg_isready`, `createdb`, `postgres`) to `resources/postgres/bin/`, collects shared library dependencies with `ldd`, copies them to `resources/postgres/lib/`, and patches RPATH using `patchelf` so the binaries resolve bundled libraries via `$ORIGIN/../lib`. Copies locale and timezone data to `resources/postgres/share/`.
- **Node.js:** Downloads the Node.js Linux x64 tarball from `nodejs.org` and copies only the `node` binary to `resources/node/node`.

**Requirements:** `curl`, `tar`, `ldd`, `patchelf`. `sudo` is needed only when PostgreSQL is not yet installed.

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `PG_VERSION` | `16` | PostgreSQL major version to bundle |
| `NODE_VERSION` | `22.14.0` | Node.js version to bundle |

**Usage:**

```bash
bash scripts/bundle-linux-deps.sh

# Override versions
PG_VERSION=16 NODE_VERSION=22.14.0 bash scripts/bundle-linux-deps.sh
```

---

## bundle-windows-deps.ps1

**What it does:** Downloads PostgreSQL and Node.js Windows binaries into `apps/desktop/resources/` for inclusion in the NSIS desktop installer.

**When to use:** Run before building the Tauri Windows installer in CI or locally on a Windows machine. Idempotent via `.bundle-complete` sentinel files.

**How it works:**
- **PostgreSQL:** Downloads the EnterpriseDB Windows zip (`postgresql-<version>-1-windows-x64-binaries.zip`), extracts it, and copies only `bin/`, `lib/`, and `share/` into `resources/postgres/`. Strips docs, installer files, and symbols.
- **Node.js:** Downloads the Node.js Windows zip from `nodejs.org`, extracts `node.exe` and all runtime DLLs into `resources/node/`. npm, npx, and `node_modules` are not copied.

**Parameters:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `-PgVersion` | `16.9` | PostgreSQL version (full version, e.g. `16.9`) |
| `-NodeVersion` | `22.14.0` | Node.js version |

**Usage:**

```powershell
# Default versions
.\scripts\bundle-windows-deps.ps1

# Custom versions
.\scripts\bundle-windows-deps.ps1 -PgVersion 16.9 -NodeVersion 22.14.0
```

---

## check-lockfile.sh

**What it does:** Verifies that `pnpm-lock.yaml` is in sync with the current workspace manifests.

**When to use:** In CI or locally after dependency edits, before relying on `pnpm install --frozen-lockfile`.

**How it works:**
1. Runs `pnpm install --lockfile-only --ignore-scripts`.
2. Fails if that command would modify `pnpm-lock.yaml`.

**Usage:**

```bash
bash scripts/check-lockfile.sh
```

---

## check-desktop-packaging-host.sh

**What it does:** Verifies that the current Ubuntu/Fedora host has the required local packaging tools before running the desktop installer build flow.

**When to use:** Before local Linux packaging, Windows cross-builds from Linux, or the combined local release flow.

**How it works:**
1. Detects the Linux distro family from `/etc/os-release`.
2. Checks common toolchain commands (`pnpm`, `node`, `cargo`, `rustup`, `curl`, `tar`, `patchelf`, `docker`).
3. Checks Linux packaging tools when `linux` is part of the requested target set.
4. Checks Windows cross-build tools (`cargo-xwin`, `pwsh`, `makensis`/`makensis.exe`, archive extractor) when `windows` is part of the requested target set.
5. Prints concrete install commands instead of failing later in the packaging step.

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `DESKTOP_RELEASE_TARGETS` | `linux,windows` | Comma-separated target set to validate |

**Usage:**

```bash
# Check the full local Linux + Windows packaging host
bash scripts/check-desktop-packaging-host.sh

# Check only Linux packaging prerequisites
bash scripts/check-desktop-packaging-host.sh --targets linux
```

---

## desktop-bundle-extras.mjs

**What it does:** After `tsup` bundles the backend into a single `server.js`, this script copies the packages that cannot be bundled (native binaries, WASM, generated clients) into `packages/backend/dist/desktop/node_modules/`.

**When to use:** This script is invoked automatically as part of `pnpm build:desktop` (inside `@elms/backend`). You do not need to run it manually in normal development.

**Why it exists:** `tsup`/esbuild bundles all pure-JS dependencies but cannot inline:
- `@prisma/client` — generated native query engine
- `tesseract.js` — WebAssembly OCR engine
- `tesseract.js-core` — hoisted transitive dependency

**How it works:**
1. Runs `pnpm deploy --prod` for `@elms/backend` into a temporary directory to resolve all pnpm symlinks to real files.
2. Runs `prisma generate` to ensure the generated client is current.
3. Copies `@prisma/client`, `tesseract.js`, `tesseract.js-core`, and `.prisma/client` from the deploy output into `packages/backend/dist/desktop/node_modules/`.
4. Cleans up the temporary deploy directory.

The total desktop output stays isolated under `packages/backend/dist/desktop/`, avoiding cloud artifact bleed-through.

**Usage:**

```bash
# Normally called by the build:desktop script — not directly
node scripts/desktop-bundle-extras.mjs
```

---

## generate-license.ts

**What it does:** Generates a signed RSA-2048 license file (`elms.license`) for the ELMS desktop application.

**When to use:** When issuing or testing backend licensing artifacts. Desktop startup no longer requires this file.

**How it works:**
1. Accepts `--firm`, `--slug`, and `--expires` arguments to build the license payload: `{ firm, slug, issuedAt, expiresAt, features: ["core"] }`.
2. Signs the JSON payload using RSA PKCS#1v15 + SHA-256 with the provided `--private-key`. If no key is provided, generates a fresh RSA-2048 key pair and prints the public key to stdout for embedding in `apps/desktop/src-tauri/keys/public.pem`.
3. Writes the payload + base64 signature to the output file.

The Tauri binary validates the signature at startup using the embedded public key. The canonical field order in the payload JSON must match `LicensePayload` in the Rust code.

**Arguments:**

| Argument | Required | Description |
|----------|----------|-------------|
| `--firm` | Yes | Display name of the firm |
| `--slug` | Yes | URL-safe firm slug |
| `--expires` | Yes | Expiry date in `YYYY-MM-DD` format (UTC midnight) |
| `--private-key` | No | Path to RSA private key PEM. If omitted, a fresh key pair is generated |
| `--out` | No | Output path (default: `elms.license`) |

**Usage:**

```bash
# Issue a license using an existing key pair
tsx scripts/generate-license.ts \
  --firm "Al-Rashidi Law Group" \
  --slug "al-rashidi-law" \
  --expires 2027-03-20 \
  --private-key apps/desktop/src-tauri/keys/private.pem \
  --out al-rashidi.license

# Generate a fresh key pair and a license in one step
tsx scripts/generate-license.ts \
  --firm "Dev Firm" \
  --slug "dev-firm" \
  --expires 2030-01-01
```

When generating a new key pair, copy the printed public key into `apps/desktop/src-tauri/keys/public.pem` before building the Tauri binary.

---

## i18n-audit.ts

**What it does:** Finds translation keys present in the English (`en`) locale but missing in Arabic (`ar`) or French (`fr`), across all namespace JSON files.

**When to use:**
- Before opening a PR that adds new UI strings.
- In CI to enforce translation completeness (`--fail` flag).
- During active development to track translation gaps.

**How it works:**
1. Reads all `.json` files from `packages/frontend/src/i18n/locales/en/` to discover namespaces.
2. Flattens each namespace file into dot-notation keys (e.g., `auth.login.title`).
3. Compares the English key set against `ar` and `fr`, reporting missing keys per namespace and language.
4. If `--fail` is passed and any keys are missing, exits with code 1.

**Usage:**

```bash
# Report missing keys (non-destructive)
pnpm tsx scripts/i18n-audit.ts

# Fail with exit code 1 if any keys are missing (for CI use)
pnpm tsx scripts/i18n-audit.ts --fail
```

Example output:

```
app.json
  [ar] missing 3 key(s):
       • notes.title
       • notes.empty
       • notes.createFirst

──────────────────────────────
Total missing keys: 3
```

See [i18n](./12-i18n.md) for the full translation workflow.

---

## package-desktop-linux.sh

**What it does:** Runs the supported Linux desktop packaging flow end to end.

**When to use:** For local Linux release builds or CI builds that need the same packaging behavior developers use locally.

**How it works:**
1. Bundles Linux PostgreSQL and Node.js runtimes.
2. Verifies that bundled desktop resources are real files, not placeholders.
3. Builds AppImage, `.deb`, and `.rpm` installers with `NO_STRIP=1`.
4. Captures the full Tauri/linuxdeploy output into `.logs/desktop-linux-package.log`.

**Usage:**

```bash
bash scripts/package-desktop-linux.sh
```

---

## release-desktop-local.sh

**What it does:** Runs the supported local desktop release flow on a Linux host.

**When to use:** When you want one command to build and verify the required local installer set (`.deb`, `.rpm`, and Windows NSIS `.exe`).

**How it works:**
1. Runs `pnpm install --frozen-lockfile`.
2. Runs `check-desktop-packaging-host.sh`.
3. Generates the Prisma client.
4. Builds and verifies Linux desktop packages (`deb,rpm` by default).
5. Builds and verifies the Windows NSIS installer through the Linux-hosted cross-build flow.
6. Restores Linux desktop runtime resources after a mixed Linux+Windows run so the repo remains Linux-ready.

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `DESKTOP_RELEASE_TARGETS` | `linux,windows` | Comma-separated target set (`linux`, `windows`, or both) |
| `DESKTOP_BUNDLES` | `deb,rpm` | Linux bundle types to build |
| `VERIFY_LINUX_BUNDLES` | same as `DESKTOP_BUNDLES` | Linux bundle types to verify |

**Usage:**

```bash
# Build and verify Linux and Windows installers from one Linux host
bash scripts/release-desktop-local.sh

# Linux-only local packaging
DESKTOP_RELEASE_TARGETS=linux bash scripts/release-desktop-local.sh
```

---

## verify-desktop-resources.sh

**What it does:** Thin shell wrapper around `node scripts/verify-desktop-resources.mjs`, which validates the cross-platform desktop resource contract before packaging.

**When to use:** Before desktop packaging, especially in CI and release workflows.

**Usage:**

```bash
bash scripts/verify-desktop-resources.sh
```

---

## verify-desktop-runtime.sh

**What it does:** Starts the Tauri desktop app in dev mode, waits for the embedded Node.js backend and PostgreSQL to become healthy, then exits cleanly. Acts as a smoke test that the desktop runtime is correctly configured.

**When to use:** After making changes to the desktop build pipeline (sidecar, embedded PostgreSQL config, resource packaging) to confirm the runtime starts correctly before committing.

**How it works:**
1. Launches `pnpm --filter @elms/desktop tauri dev --no-watch` in the background, writing all output to a log file.
2. Polls `GET /api/health` (default: `http://127.0.0.1:7854/api/health`) every 2 seconds until the response contains `"ok":true` or the timeout is reached.
3. Checks that the embedded PostgreSQL is accepting connections on port 5433 via `pg_isready`.
4. Kills the Tauri process on exit (via `trap cleanup EXIT`).

**Requirements:** `curl`, `pg_isready` (PostgreSQL client binaries).

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `DESKTOP_HEALTH_URL` | `http://127.0.0.1:7854/api/health` | Backend health endpoint |
| `DESKTOP_POSTGRES_PORT` | `5433` | Embedded PostgreSQL port |
| `DESKTOP_VERIFY_TIMEOUT_SECONDS` | `180` | Maximum wait time in seconds |
| `DESKTOP_VERIFY_LOG_DIR` | `.logs/` (repo root) | Directory for the log file |

**Usage:**

```bash
bash scripts/verify-desktop-runtime.sh
```

On success:

```
Desktop runtime verification passed: backend and embedded PostgreSQL are healthy.
```

On failure, the last 120 lines of the log are printed to stderr.

---

## verify-windows-installer.mjs

**What it does:** Verifies a Windows NSIS installer payload from Linux by inspecting either the Tauri release tree or the extracted installer contents.

**When to use:** After a Linux-hosted Windows cross-build, or when validating a locally produced NSIS installer outside Windows CI.

**How it works:**
1. Accepts either an installer path or a Tauri Windows release root.
2. Tries direct packaged-tree verification from the release root first.
3. Falls back to extracting the NSIS `.exe` with `7z`, `7zz`, `bsdtar`, or the repo-managed `7zip-bin` binary.
4. Reuses `verify-packaged-desktop-tree.mjs` and `desktop-resource-contract.mjs` to validate the extracted payload.

**Usage:**

```bash
# Verify from the Tauri Windows release root
node scripts/verify-windows-installer.mjs --release-root apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release

# Verify a specific NSIS installer file
node scripts/verify-windows-installer.mjs apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/ELMS_0.1.0_x64-setup.exe
```

---

Related: [Desktop Build](./11-desktop-build.md) | [i18n](./12-i18n.md) | [Contributing](./09-contributing.md)
