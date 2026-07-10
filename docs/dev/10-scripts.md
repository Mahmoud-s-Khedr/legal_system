# 10 — Scripts Reference

All scripts live in the `scripts/` directory at the repository root. This document describes every script, when to use it, required environment variables, and usage examples.

Cloud deployment scripts were archived on 2026-03-28 under [`archive/cloud/`](../../archive/cloud/README.md) and are no longer part of active workflows.

## Table of Contents

- [bundle-windows-deps.ps1](#bundle-windows-depsps1)
- [check-lockfile.sh](#check-lockfilesh)
- [desktop-bundle-extras.mjs](#desktop-bundle-extrasmjs)
- [i18n-audit.ts](#i18n-auditts)
- [verify-desktop-resources.sh](#verify-desktop-resourcessh)
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
| `COMPOSE_FILE` | `archive/cloud/apps/web/docker-compose.prod.yml` | Path to the Docker Compose file |
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
| `COMPOSE_FILE` | `archive/cloud/apps/web/docker-compose.prod.yml` | Path to the Docker Compose file |
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
1. Builds local Docker images for backend and frontend by default (`archive/cloud/apps/web/backend.Dockerfile` and `archive/cloud/apps/web/Dockerfile`).
2. Pulls third-party images for `postgres`, `redis`, and `edge` services.
3. Runs database migrations via the short-lived `migrate` service (`docker compose run --rm migrate`).
4. Starts or replaces containers for `postgres`, `redis`, `backend`, `web`, and `edge` with `up -d`.
5. Prints container status with `docker compose ps`.

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `COMPOSE_FILE` | `archive/cloud/apps/web/docker-compose.prod.yml` | Path to the Docker Compose file |
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

## verify-desktop-resources.sh

**What it does:** Thin shell wrapper around `node scripts/verify-desktop-resources.mjs`, which validates the cross-platform desktop resource contract before packaging.

**When to use:** Before desktop packaging, especially in CI and release workflows.

**Usage:**

```bash
bash scripts/verify-desktop-resources.sh
```

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

Related: [i18n](./12-i18n.md) | [Contributing](./09-contributing.md)

## Source of truth

- `docs/_inventory/source-of-truth.md`
