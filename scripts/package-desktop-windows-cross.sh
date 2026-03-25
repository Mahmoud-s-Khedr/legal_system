#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${DESKTOP_PACKAGE_LOG_DIR:-$ROOT_DIR/.logs}"
LOG_FILE="${DESKTOP_PACKAGE_LOG_FILE:-$LOG_DIR/desktop-windows-cross-package.log}"
TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/elms-tauri-windows-cross.XXXXXX")"
WINDOWS_CONFIG_OVERRIDE="$TEMP_DIR/tauri.windows-nsis-only.json"
SHIM_DIR="$TEMP_DIR/bin"
WINDOWS_RELEASE_ROOT="$ROOT_DIR/apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release"

mkdir -p "$LOG_DIR"
mkdir -p "$SHIM_DIR"
trap 'rm -rf "$TEMP_DIR"' EXIT

cd "$ROOT_DIR"

if ! command -v pwsh >/dev/null 2>&1; then
  echo "Linux-hosted Windows packaging requires 'pwsh' so the Windows runtime bundle can be prepared. Run 'bash scripts/check-desktop-packaging-host.sh --targets windows' for install guidance." >&2
  exit 1
fi

pwsh ./scripts/bundle-windows-deps.ps1 -PgVersion "${PG_VERSION:-16.9}" -NodeVersion "${NODE_VERSION:-22.14.0}"
node ./scripts/verify-desktop-resources.mjs

if ! command -v makensis.exe >/dev/null 2>&1 && command -v makensis >/dev/null 2>&1; then
  cat >"$SHIM_DIR/makensis.exe" <<'EOF'
#!/usr/bin/env bash
exec makensis "$@"
EOF
  chmod +x "$SHIM_DIR/makensis.exe"
  export PATH="$SHIM_DIR:$PATH"
fi

node - "$ROOT_DIR" "$WINDOWS_CONFIG_OVERRIDE" <<'EOF'
const fs = require("node:fs");
const path = require("node:path");

const [, , rootDir, outputPath] = process.argv;
const tauriConfigPath = path.join(rootDir, "apps/desktop/src-tauri/tauri.conf.json");
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, "utf8"));
const nsisConfig = tauriConfig.bundle?.windows?.nsis ?? {};

fs.writeFileSync(
  outputPath,
  JSON.stringify({
    bundle: {
      targets: "nsis",
      windows: {
        nsis: nsisConfig
      }
    }
  })
);
EOF

set +e
pnpm --filter @elms/desktop tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc --config "$WINDOWS_CONFIG_OVERRIDE" --ci 2>&1 | tee "$LOG_FILE"
status=${PIPESTATUS[0]}
set -e

if [[ "$status" -ne 0 ]]; then
  echo "Linux-hosted Windows desktop packaging failed. See $LOG_FILE for the captured cargo-xwin/Tauri output." >&2
  exit "$status"
fi

node ./scripts/verify-windows-installer.mjs --release-root "$WINDOWS_RELEASE_ROOT"

echo "Linux-hosted Windows desktop packaging completed successfully."
