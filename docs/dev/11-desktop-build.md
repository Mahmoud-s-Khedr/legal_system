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
│                         │  (profile-based port)│     │
│                         └──────────────────────┘     │
└─────────────────────────────────────────────────────┘
```

The Tauri Rust core manages the application window and lifecycle. On startup it:
1. Starts the embedded PostgreSQL instance.
2. Launches the Node.js backend as a Tauri sidecar process.
3. Verifies backend identity by requiring a per-launch bootstrap token in `/api/health`.
4. Opens the WebView pointing to the React frontend (bundled as static files in the installer).

The frontend communicates with the backend over loopback. In packaged runtime the backend default is `http://127.0.0.1:7854`. In workspace development runtime the backend default is isolated to `http://127.0.0.1:17854` so dev and installed apps can run in parallel without conflicts. The CSP in `tauri.conf.json` still allows loopback access:

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

The base Tauri `bundle.resources` section in `tauri.conf.json` points at the desktop runtime output:

```json
"resources": {
  "../../../packages/backend/dist/desktop": "packages/backend/dist/desktop/",
  "../resources/postgres": "postgres/",
  "../resources/node": "node/"
}
```

Packaged builds then merge a small override config in `apps/desktop/scripts/tauri-wrapper.mjs` so the bundle still contains `.env.desktop`, sourcing it from `apps/desktop/.env.desktop` when present and otherwise from `apps/desktop/.env.desktop.example`.

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

Desktop runtime now uses profile-specific defaults to prevent workspace development from sharing installed-app state on the same machine.

- **Packaged runtime defaults**
  - PostgreSQL port: `5433`
  - App data root (Linux): `~/.local/share/com.elms.desktop`
  - PostgreSQL data dir (Linux): `~/.local/share/com.elms.desktop/postgres`
- **Workspace development defaults**
  - PostgreSQL port: `15433`
  - Backend port: `17854`
  - App data root (Linux): `~/.local/share/com.elms.desktop.workspace-dev`
  - PostgreSQL data dir (Linux): `~/.local/share/com.elms.desktop.workspace-dev/postgres`

To temporarily revert workspace isolation for compatibility testing, set `ELMS_DISABLE_WORKSPACE_DEV_ISOLATION=true` before launching `pnpm dev:tauri`.

On Linux the executables have their RPATH patched with `patchelf` to resolve bundled shared libraries via `$ORIGIN/../lib`, making the binaries fully portable without requiring `LD_LIBRARY_PATH`.

Linux bundles now include a manifest at `apps/desktop/resources/postgres/.layout.env`. The bundling step preserves PostgreSQL's distro-specific relative subtree under a synthetic bundle root, so Ubuntu layouts like `share/postgresql/16` and Fedora layouts like `share/pgsql` both remain valid inside the packaged app. The desktop runtime and resource verifier read this manifest instead of assuming a fixed `lib64/pgsql` / `share/pgsql` tree.

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

For verified local installer generation, use `pnpm release:desktop:linux` or `pnpm release:desktop:local`. `pnpm build` remains a compile-oriented workspace command, not a local installer release workflow.

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
# 1. Preflight the Linux host
bash scripts/check-desktop-packaging-host.sh --targets linux

# 2. Build and verify the supported local Linux installers
pnpm release:desktop:linux
```

`bundle-linux-deps.sh` now performs a PostgreSQL smoke test after copying resources: it runs the bundled `postgres` binary and initializes a temporary data directory with the bundled `initdb` binary before writing the bundle sentinel.

Artifacts are written to:
- `apps/desktop/src-tauri/target/release/bundle/appimage/*.AppImage`
- `apps/desktop/src-tauri/target/release/bundle/deb/*.deb`
- `apps/desktop/src-tauri/target/release/bundle/rpm/*.rpm`

`pnpm release:desktop:linux` intentionally targets `deb,rpm` only. AppImage remains available through lower-level scripts and CI, but it is not part of the required local success bar.

The desktop Tauri config uses cross-platform wrapper scripts for `beforeBuildCommand` and `beforeDevCommand` so the same build path works on Linux, macOS, and Windows runners without relying on Unix-style inline environment assignment. On Windows, those wrappers launch `pnpm` through a shell-backed spawn path instead of directly invoking `pnpm.cmd`, which avoids the `spawn EINVAL` failure seen in GitHub-hosted Windows packaging jobs.

The `beforeBuildCommand` in `tauri.conf.json` automatically runs the backend `build:desktop`, verifies desktop resources, and then builds the frontend:

```json
"beforeBuildCommand": "node ./scripts/prepare-desktop-build.mjs"
```

### Windows (NSIS)

#### Windows host (recommended)

Windows remains the recommended host for production NSIS installers. It matches the release workflows in `.github/workflows/build-windows.yml` and `.github/workflows/release-desktop.yml`, supports the native MSVC toolchain directly, and aligns with the expected installer signing flow.

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

#### Fedora Linux cross-build (experimental)

Fedora can cross-compile the Windows desktop binary and reach the NSIS bundling stage, but this path is still experimental. Use it for local debugging and iteration; use Windows CI for release-quality artifacts.

**Fedora prerequisites:** Node.js 22, pnpm 10.27.0, Rust stable, plus Fedora system packages:

```bash
sudo dnf install llvm lld clang mingw64-nsis
rustup target add x86_64-pc-windows-msvc
cargo install --locked cargo-xwin
```

**Build steps:**

```bash
# 1. Preflight the Linux host
bash scripts/check-desktop-packaging-host.sh --targets windows

# 2. Cross-build and verify the Windows NSIS installer
pnpm --filter @elms/desktop package:windows:cross
```

The helper script bundles Windows runtimes, verifies the source desktop resources, captures the Tauri output into `.logs/desktop-windows-cross-package.log`, applies a temporary Tauri config override with `bundle.targets: "nsis"`, and verifies the produced NSIS payload from Linux.

**Observed behavior on Fedora:** the Rust cross-compile and Tauri Windows compile can succeed locally, but the bundle step may still fail with `failed to run command makensis.exe` if the host only provides `makensis`.

**Troubleshooting:** on Linux, Tauri expects `makensis.exe` to be available on `PATH`. If Fedora only installs `makensis`, create a local shim or symlink named `makensis.exe` that forwards to the real `makensis` binary, then rerun the build.

**Bundle selection note:** on Linux, the Tauri CLI only accepts Linux bundle values for `--bundles`, even when the target is Windows. If you invoke `pnpm --filter @elms/desktop tauri build ...` directly, Tauri can still inspect the configured Windows bundle types and emit extra `msi`/WiX bundle-type warnings. Use `package:windows:cross` for the supported Linux-hosted smoke-build path because it applies an NSIS-only config override for that run.

**Signing note:** Linux cross-builds skip installer signing by default. Final signed release artifacts should come from the Windows GitHub Actions workflows.

### One Linux Host: Ubuntu, Fedora, and Windows Installers

When you want the full supported local installer set from a Linux machine:

```bash
pnpm release:desktop:local
```

That flow:
- runs `pnpm install --frozen-lockfile`
- checks the host prerequisites for Ubuntu/Fedora local packaging plus Windows cross-build
- builds and verifies `deb` and `rpm`
- builds and verifies the Windows NSIS installer
- restores Linux desktop runtime resources afterward so the repo remains Linux-ready

#### Windows MSI (WiX) manual path

WiX/MSI remains available for explicit Windows-host packaging, but it is not part of Linux cross-builds, CI artifacts, or the recommended release path.

```bash
pnpm --filter @elms/desktop tauri build --target x86_64-pc-windows-msvc --bundles msi
```

### macOS (dmg)

macOS packaging requires a macOS host. Linux is not a supported host for producing `.dmg` installers.

**Prerequisites:** Rust stable with targets `aarch64-apple-darwin` and `x86_64-apple-darwin`, Xcode command-line tools.

```bash
# 1. Install JS dependencies
pnpm install --frozen-lockfile
pnpm prisma:generate

# 2. Build an Apple Silicon dmg
PG_VERSION=16 NODE_VERSION=22.14.0 NODE_ARCH=arm64 bash scripts/bundle-macos-deps.sh
node scripts/verify-desktop-resources.mjs
pnpm --filter @elms/desktop tauri build --target aarch64-apple-darwin --bundles dmg

# 3. Build an Intel dmg
PG_VERSION=16 NODE_VERSION=22.14.0 NODE_ARCH=x64 bash scripts/bundle-macos-deps.sh
node scripts/verify-desktop-resources.mjs
pnpm --filter @elms/desktop tauri build --target x86_64-apple-darwin --bundles dmg
```

Artifacts:
- `apps/desktop/src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/*.dmg`
- `apps/desktop/src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/*.dmg`

The macOS bundler writes the Node runtime to `apps/desktop/resources/node/node`, matching the Tauri sidecar lookup on non-Windows platforms. It also preserves PostgreSQL's `bindir`, `sharedir`, and `pkglibdir` layout under `apps/desktop/resources/postgres` and writes `apps/desktop/resources/postgres/.layout.env`, the same manifest contract used by Linux and Windows builds.

For Apple notarization, configure the secrets listed in the macOS CI workflow (see next section).

---

## CI Build Workflows

Platform builds are defined in `.github/workflows/`. They are **not** part of the main `ci.yml` pipeline — they trigger after `ci` completes successfully on `main`, or can be dispatched manually.

| Workflow file | Runner | Output formats | Trigger |
|--------------|--------|---------------|---------|
| `build-linux.yml` | `ubuntu-latest` | AppImage, deb, rpm | `workflow_run` on `ci` success, or manual |
| `build-windows.yml` | `windows-latest` | NSIS exe | `workflow_run` on `ci` success, or manual |
| `build-macos.yml` | `macos-15` + `macos-15-intel` | arm64 dmg, x64 dmg | `workflow_run` on `ci` success, or manual |

**Common steps across all workflows:**
1. Checkout → pnpm 10.27.0 → Node.js 22 → Rust stable
2. Cache Rust build artifacts (Swatinem/rust-cache, workspace: `apps/desktop/src-tauri`)
3. `pnpm install --frozen-lockfile` + `pnpm prisma:generate`
4. Resolve the packaged source SHA (`workflow_run.head_sha` for downstream builds, `github.sha` for manual runs) and check out that exact commit
5. Bundle platform-native dependencies (Linux uses `bundle-linux-deps.sh`; Windows uses `bundle-windows-deps.ps1`; macOS uses `bundle-macos-deps.sh`)
6. Build installer artifacts only; OTA manifest generation is not part of the release flow
7. Validate packaged resources (`verify-linux-packages.sh` for Linux; cross-platform `verify-desktop-resources.mjs` for prebuild resource checks)
8. Upload artifacts with `actions/upload-artifact@v4`, retained for 30 days

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

`build-macos.yml` now supports unsigned CI validation builds when any Apple signing secret is missing. In that case, the workflow still produces DMG artifacts but skips signing/notarization inputs.

`release-desktop.yml` keeps signing mandatory for macOS release artifacts. It fails fast in a preflight validation step if any Apple signing secret is missing.

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
