# 11 — Desktop Build

ELMS ships a standalone desktop application built with Tauri 2.x. The desktop package bundles the React frontend, the Node.js backend server, an embedded PostgreSQL database, and a Node.js runtime into a single installer — no external dependencies required on the end-user machine.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Two Build Strategies — Cloud vs Desktop](#two-build-strategies--cloud-vs-desktop)
- [Embedded PostgreSQL](#embedded-postgresql)
- [Bundled Node.js Runtime](#bundled-nodejs-runtime)
- [Desktop Startup and Access](#desktop-startup-and-access)
- [Building for Each Platform](#building-for-each-platform)
  - [Linux (AppImage / deb / rpm)](#linux-appimage--deb--rpm)
  - [Windows (NSIS)](#windows-nsis)
  - [macOS (dmg)](#macos-dmg)
- [CI Build Workflows](#ci-build-workflows)
- [Setting Up the Desktop Dev Environment](#setting-up-the-desktop-dev-environment)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Tauri 2 shell (Rust)                │
│                                                     │
│  ┌────────────────────┐   ┌────────────────────┐   │
│  │  React frontend    │   │  Node.js backend   │   │
│  │  (WebKitGTK /      │   │  server.js         │   │
│  │   WebView2 / WKW)  │   │  (sidecar process) │   │
│  └────────────────────┘   └────────────────────┘   │
│                                    │                 │
│                         ┌──────────▼──────────┐     │
│                         │  Embedded PostgreSQL │     │
│                         │  (port 5433)         │     │
│                         └──────────────────────┘     │
└─────────────────────────────────────────────────────┘
```

The Tauri Rust core manages the application window and lifecycle. On startup it:
1. Starts the embedded PostgreSQL instance.
2. Launches the Node.js backend as a Tauri sidecar process.
3. Verifies backend identity by requiring a per-launch bootstrap token in `/api/health`.
4. Opens the WebView pointing to the React frontend (bundled as static files in the installer).

The frontend communicates with the backend exclusively via `http://127.0.0.1:7854` (loopback). The CSP in `tauri.conf.json` enforces this:

```json
"csp": "default-src 'self' tauri: asset: http://127.0.0.1:7854; connect-src 'self' http://127.0.0.1:7854 ws://127.0.0.1:7854"
```

Authentication runs in `LOCAL` mode (`AUTH_MODE=LOCAL`) with no Redis dependency. Desktop bootstrap injects an app-data-backed `LOCAL_SESSION_STORE_PATH` so local sessions survive backend restarts while still honoring `LOCAL_SESSION_TTL_HOURS`.

---

## Two Build Strategies — Cloud vs Desktop

The backend package (`@elms/backend`) has two tsup configurations selected by the `ELMS_BUILD_TARGET` environment variable.

| Target | Command | Output |
|--------|---------|--------|
| Cloud | `pnpm --filter @elms/backend build` | `packages/backend/dist/cloud` |
| Desktop | `pnpm --filter @elms/backend build:desktop` | `packages/backend/dist/desktop` |

The desktop build (`ELMS_BUILD_TARGET=desktop`) bundles **all** JavaScript dependencies into a single `server.js` file using `tsup`. Three packages are intentionally excluded and copied separately because they contain native binaries or WASM:

| Package | Reason for exclusion |
|---------|---------------------|
| `@prisma/client` | Generated native query engine (`.node` binary) |
| `tesseract.js` | WebAssembly OCR engine |
| `tesseract.js-core` | Hoisted WASM core dependency |

After `tsup` runs, `scripts/desktop-bundle-extras.mjs` copies these packages and the generated `.prisma/client` into `packages/backend/dist/desktop/node_modules/`. The resulting desktop runtime is isolated under `packages/backend/dist/desktop/`.

The Tauri `bundle.resources` section in `tauri.conf.json` points only at the desktop output:

```json
"resources": {
  "../../../packages/backend/dist/desktop": "packages/backend/dist/desktop/",
  "../.env.desktop": ".env.desktop",
  "../resources/postgres": "postgres/",
  "../resources/node": "node/"
}
```

---

## Embedded PostgreSQL

Desktop installations include a self-contained PostgreSQL binary set. The sidecar Rust code manages the PostgreSQL lifecycle (init, start, stop).

**Bundled executables:**

| Executable | Purpose |
|-----------|---------|
| `pg_ctl` | Start / stop / reload the server |
| `initdb` | Initialize a new data directory |
| `pg_isready` | Health check |
| `createdb` | Create the initial database |
| `postgres` | The server process |

PostgreSQL listens on port **5433** by default (not 5432) to avoid conflicts with any system PostgreSQL. The data directory is stored under the Tauri app data directory: `~/.local/share/com.elms.desktop/postgres` on Linux.

On Linux the executables have their RPATH patched with `patchelf` to resolve bundled shared libraries via `$ORIGIN/../lib`, making the binaries fully portable without requiring `LD_LIBRARY_PATH`.

To prepare the PostgreSQL binaries for the Linux installer:

```bash
bash scripts/bundle-linux-deps.sh
```

For Windows:

```powershell
.\scripts\bundle-windows-deps.ps1
```

---

## Bundled Node.js Runtime

The Node.js backend (`server.js`) is executed by a bundled Node.js binary rather than relying on any system-installed Node.js.

On Linux, only the `node` binary is copied (`~8 MB`). It links only against glibc which is always present. On Windows, `node.exe` and all required runtime DLLs are copied from the official Node.js zip.

The Rust sidecar code locates the bundled `node` binary relative to the app resource directory and launches it with the path to `server.js`.

**Node.js version in use:** 22.14.0 (LTS)

---

## Desktop Startup and Access

Desktop builds no longer require an `elms.license` file to launch. The active startup gates are runtime health only: PostgreSQL must initialize, the Node.js sidecar must become healthy, and the bundled frontend must load successfully.

Backend licensing data and activation flows still exist for product logic, but they are not part of the desktop bootstrap path or local development setup.

Desktop releases are installer-only in the current release train. The Tauri updater plugin and OTA manifest flow are not active, so version upgrades are distributed by shipping new platform installers.

---

## Building for Each Platform

### Linux (AppImage / deb / rpm)

**Prerequisites:** Rust stable, pnpm 10.27.0, Node.js 22, plus the Linux system dependencies listed in the CI step:

```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev build-essential curl wget file \
  libssl-dev libayatana-appindicator3-dev librsvg2-dev \
  patchelf rpm fakeroot
```

**Steps:**

```bash
# 1. Bundle PostgreSQL and Node.js binaries
bash scripts/bundle-linux-deps.sh

# 2. Install JS dependencies
pnpm install --frozen-lockfile
pnpm prisma:generate

# 3. Build Tauri installers with resource verification and log capture
pnpm --filter @elms/desktop package:linux
```

Artifacts are written to:
- `apps/desktop/src-tauri/target/release/bundle/appimage/*.AppImage`
- `apps/desktop/src-tauri/target/release/bundle/deb/*.deb`
- `apps/desktop/src-tauri/target/release/bundle/rpm/*.rpm`

The `beforeBuildCommand` in `tauri.conf.json` automatically runs the backend `build:desktop` and the frontend build:

```json
"beforeBuildCommand": "pnpm --filter @elms/backend build:desktop && bash ../../scripts/verify-desktop-resources.sh && VITE_DESKTOP_SHELL=true VITE_API_BASE_URL=http://127.0.0.1:7854 pnpm --filter @elms/frontend build"
```

### Windows (NSIS)

**Prerequisites:** Rust stable with target `x86_64-pc-windows-msvc`, Visual Studio build tools, pnpm, Node.js 22.

```powershell
# 1. Bundle PostgreSQL and Node.js binaries
.\scripts\bundle-windows-deps.ps1

# 2. Install JS dependencies
pnpm install --frozen-lockfile
pnpm prisma:generate

# 3. Build
pnpm --filter @elms/desktop tauri build --target x86_64-pc-windows-msvc --bundles nsis
```

Artifact: `apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe`

### macOS (dmg)

**Prerequisites:** Rust stable with targets `aarch64-apple-darwin` and `x86_64-apple-darwin`, Xcode command-line tools.

```bash
# 1. Download arm64 Node.js binary
NODE_VERSION=22.14.0
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-arm64.tar.gz"
mkdir -p apps/desktop/resources/node/bin
curl -sSL "$NODE_URL" | tar -xz --strip-components=2 \
  -C apps/desktop/resources/node/bin --wildcards "*/bin/node"
chmod +x apps/desktop/resources/node/bin/node

# 2. Install JS dependencies
pnpm install --frozen-lockfile
pnpm prisma:generate

# 3. Build (arm64 only; for universal binary, build both targets and use lipo)
pnpm --filter @elms/desktop tauri build --target aarch64-apple-darwin --bundles dmg
```

Artifact: `apps/desktop/src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/*.dmg`

For Apple notarization, configure the secrets listed in the macOS CI workflow (see next section).

---

## CI Build Workflows

Platform builds are defined in `.github/workflows/`. They are **not** part of the main `ci.yml` pipeline — they trigger after `ci` completes successfully on `main`, or can be dispatched manually.

| Workflow file | Runner | Output formats | Trigger |
|--------------|--------|---------------|---------|
| `build-linux.yml` | `ubuntu-latest` | AppImage, deb, rpm | `workflow_run` on `ci` success, or manual |
| `build-windows.yml` | `windows-latest` | NSIS exe | `workflow_run` on `ci` success, or manual |
| `build-macos.yml` | `macos-latest` | dmg | `workflow_run` on `ci` success, or manual |

**Common steps across all workflows:**
1. Checkout → pnpm 10.27.0 → Node.js 22 → Rust stable
2. Cache Rust build artifacts (Swatinem/rust-cache, workspace: `apps/desktop/src-tauri`)
3. `pnpm install --frozen-lockfile` + `pnpm prisma:generate`
4. Bundle platform-native dependencies (Linux packaging runs `package:linux`; Windows uses `bundle-windows-deps.ps1`; macOS downloads a Node runtime inline)
5. Build installer artifacts only; OTA manifest generation is not part of the release flow
6. Upload artifacts with `actions/upload-artifact@v4`, retained for 30 days

**Manual dispatch inputs:**

| Workflow | Input | Default |
|----------|-------|---------|
| `build-linux.yml` | `pg_version` | `16` |
| `build-linux.yml` | `node_version` | `22.14.0` |
| `build-windows.yml` | `pg_version` | `16.9` |
| `build-windows.yml` | `node_version` | `22.14.0` |
| `build-macos.yml` | `node_version` | `22.14.0` |

**macOS notarization secrets** (configure in GitHub repo settings):

| Secret | Purpose |
|--------|---------|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` certificate |
| `APPLE_CERTIFICATE_PASSWORD` | `.p12` password |
| `APPLE_SIGNING_IDENTITY` | Developer ID Application: ... |
| `APPLE_ID` | Apple ID email |
| `APPLE_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Apple developer team ID |

---

## Setting Up the Desktop Dev Environment

```bash
# 1. Install JS + Rust dependencies
pnpm install
pnpm prisma:generate

# 2. Bundle platform binaries (first time only)
bash scripts/bundle-linux-deps.sh   # Linux
# or: .\scripts\bundle-windows-deps.ps1  (Windows)

# 3. Start in dev mode (hot-reload for frontend, backend restarts on change)
pnpm dev:tauri
```

The `dev:tauri` command runs `pnpm --filter @elms/desktop tauri:dev`, which executes the `beforeDevCommand` from `tauri.conf.json`:

```json
"beforeDevCommand": "VITE_DESKTOP_SHELL=true pnpm --filter @elms/frontend dev --host 127.0.0.1 --port 5173"
```

The frontend Vite dev server starts on port 5173, and Tauri opens a WebView pointing to it. The backend runs as a sidecar managed by Tauri.

To verify the desktop runtime starts correctly without a full GUI:

```bash
bash scripts/verify-desktop-runtime.sh
```

---

Related: [Scripts Reference](./10-scripts.md) | [Environment Variables](./03-environment-variables.md) | [Auth Internals](./07-auth-internals.md)
