#!/usr/bin/env bash
# bundle-linux-deps.sh
#
# SYNOPSIS
#   Downloads/extracts PostgreSQL and Node.js Linux binaries into
#   apps/desktop/resources/ for the ELMS desktop Linux installer (AppImage / deb).
#
# DESCRIPTION
#   - PostgreSQL <PG_VERSION>  → apps/desktop/resources/postgres/
#       bin/        — pg_ctl, initdb, pg_isready, createdb, postgres
#       lib/        — runtime .so files (collected via ldd; RPATH-patched with patchelf)
#       lib64/pgsql — server-side extension modules when PostgreSQL expects them there
#       share/...   — locale/timezone data preserved at the compiled sharedir path
#   - Node.js <NODE_VERSION> Linux x64 tarball → apps/desktop/resources/node/
#       node   — single self-contained binary (no .so bundling needed)
#
#   Both downloads/copies are skipped when the target directory already contains
#   a .bundle-complete sentinel file (idempotent — safe to re-run in CI).
#
# USAGE
#   bash scripts/bundle-linux-deps.sh
#   PG_VERSION=16 NODE_VERSION=22.14.0 bash scripts/bundle-linux-deps.sh
#
# REQUIREMENTS
#   - apt-get (Ubuntu/Debian) or dnf (Fedora/RHEL)
#   - curl, tar, ldd, patchelf
#   - sudo privileges (only needed when PostgreSQL is not yet installed)

set -euo pipefail

PG_VERSION="${PG_VERSION:-16}"
NODE_VERSION="${NODE_VERSION:-22.14.0}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
RESOURCE_DIR="$REPO_ROOT/apps/desktop/resources"
TMP_DIR="$(mktemp -d -t elms-bundle-XXXXXX)"

PG_DEST="$RESOURCE_DIR/postgres"
NODE_DEST="$RESOURCE_DIR/node"

# Always clean up the temp dir on exit.
trap 'rm -rf "$TMP_DIR"' EXIT

# ── Helpers ───────────────────────────────────────────────────────────────────

die() { echo "ERROR: $*" >&2; exit 1; }

require_cmd() {
  command -v "$1" &>/dev/null || die "'$1' is required but not found in PATH."
}

# ── Detect distro ─────────────────────────────────────────────────────────────

if command -v apt-get &>/dev/null; then
  DISTRO=ubuntu
elif command -v dnf &>/dev/null; then
  DISTRO=fedora
else
  die "Unsupported distro — only Ubuntu/Debian (apt-get) and Fedora/RHEL (dnf) are supported."
fi

echo "[info] Detected distro family: $DISTRO"

# ── PostgreSQL ─────────────────────────────────────────────────────────────────

PG_SENTINEL="$PG_DEST/.bundle-complete"

if [[ -f "$PG_SENTINEL" ]]; then
  echo "[PG] PostgreSQL $PG_VERSION already bundled — skipping."
else
  echo "[PG] Bundling PostgreSQL $PG_VERSION ..."

  # Install PostgreSQL if binaries are not already present.
  if ! command -v pg_isready &>/dev/null || ! command -v pg_config &>/dev/null; then
    echo "[PG] Installing PostgreSQL $PG_VERSION ..."
    if [[ "$DISTRO" == ubuntu ]]; then
      sudo apt-get update -qq
      # postgresql-$PG_VERSION installs binaries to /usr/lib/postgresql/$PG_VERSION/bin/
      sudo apt-get install -y "postgresql-$PG_VERSION" postgresql-client-common
    elif [[ "$DISTRO" == fedora ]]; then
      # Fedora 40+ ships PostgreSQL 16; use postgresql-server for the server executables.
      sudo dnf install -y postgresql-server postgresql
    fi
  fi

  require_cmd pg_config
  require_cmd patchelf
  require_cmd ldd
  require_cmd realpath

  # Use pg_config to locate paths — works on both distros without hardcoding.
  PG_BIN_DIR="$(pg_config --bindir)"
  PG_SHARE_DIR="$(pg_config --sharedir)"
  PG_PKG_LIB_DIR="$(pg_config --pkglibdir)"   # server-side .so plugins
  PG_PREFIX_DIR="$(dirname "$PG_BIN_DIR")"
  PG_SHARE_RELATIVE="$(realpath --relative-to="$PG_PREFIX_DIR" "$PG_SHARE_DIR")"
  PG_SHARE_DEST="$PG_DEST/$PG_SHARE_RELATIVE"
  PG_PKG_LIB_RELATIVE="$(realpath --relative-to="$PG_PREFIX_DIR" "$PG_PKG_LIB_DIR")"
  PG_PKG_LIB_DEST="$PG_DEST/$PG_PKG_LIB_RELATIVE"

  [[ -d "$PG_BIN_DIR" ]]   || die "pg_config --bindir returned non-existent directory: $PG_BIN_DIR"
  [[ -d "$PG_SHARE_DIR" ]] || die "pg_config --sharedir returned non-existent directory: $PG_SHARE_DIR"

  mkdir -p "$PG_DEST/bin" "$PG_DEST/lib" "$PG_SHARE_DEST" "$PG_PKG_LIB_DEST"

  # Copy the five executables needed by sidecar.rs at runtime.
  echo "[PG] Copying executables from $PG_BIN_DIR ..."
  for exe in pg_ctl initdb pg_isready createdb postgres; do
    src="$PG_BIN_DIR/$exe"
    [[ -f "$src" ]] || die "Expected executable not found: $src"
    cp "$src" "$PG_DEST/bin/"
  done

  # Copy locale / timezone data needed by initdb.
  echo "[PG] Copying sharedir ($PG_SHARE_DIR) to $PG_SHARE_DEST ..."
  cp -r "$PG_SHARE_DIR/." "$PG_SHARE_DEST/"

  # Copy server-side plugin libraries (postgres.so, etc.).
  if [[ -d "$PG_PKG_LIB_DIR" ]]; then
    echo "[PG] Copying pkglibdir ($PG_PKG_LIB_DIR) to $PG_PKG_LIB_DEST ..."
    cp -r "$PG_PKG_LIB_DIR/." "$PG_PKG_LIB_DEST/" 2>/dev/null || true
  fi

  # Collect all non-system shared library dependencies via ldd, then copy them
  # into lib/ so the AppImage is self-contained.
  #
  # Excluded: glibc family (libc, libm, libdl, libpthread, librt, ld-linux) and
  # linux-vdso — these are always present on the target system.
  echo "[PG] Collecting shared library dependencies via ldd ..."
  EXCLUDE_PATTERN="libc\.so|libm\.so|libdl\.so|libpthread\.so|librt\.so|ld-linux|linux-vdso"

  for exe in pg_ctl initdb pg_isready createdb postgres; do
    while read -r lib; do
      [[ -f "$lib" ]] && cp -n "$lib" "$PG_DEST/lib/" && echo "    + $(basename "$lib")"
    done < <(
      ldd "$PG_DEST/bin/$exe" 2>/dev/null \
        | awk '/=>/ { print $3 }' \
        | grep -Ev "$EXCLUDE_PATTERN" || true
    )
  done

  # Patch RPATH on each binary so they resolve bundled libs via $ORIGIN/../lib
  # without requiring LD_LIBRARY_PATH to be set at runtime.
  echo "[PG] Patching RPATH with patchelf ..."
  for exe in pg_ctl initdb pg_isready createdb postgres; do
    patchelf --set-rpath '$ORIGIN/../lib' "$PG_DEST/bin/$exe"
  done

  # Write sentinel so subsequent runs skip the whole block.
  echo "PostgreSQL $PG_VERSION bundled on $(date +%Y-%m-%d)" > "$PG_SENTINEL"

  echo "[PG] Done."
fi

# ── Node.js ───────────────────────────────────────────────────────────────────

NODE_SENTINEL="$NODE_DEST/.bundle-complete"

if [[ -f "$NODE_SENTINEL" ]]; then
  echo "[Node] Node.js $NODE_VERSION already bundled — skipping."
else
  echo "[Node] Bundling Node.js $NODE_VERSION ..."

  require_cmd curl

  NODE_TARBALL="node-v${NODE_VERSION}-linux-x64.tar.xz"
  NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TARBALL}"
  NODE_EXTRACT_DIR="$TMP_DIR/node-extract"

  mkdir -p "$NODE_EXTRACT_DIR" "$NODE_DEST"

  echo "[Node] Downloading $NODE_URL ..."
  curl -fsSL "$NODE_URL" -o "$TMP_DIR/$NODE_TARBALL"

  echo "[Node] Extracting ..."
  tar -xJf "$TMP_DIR/$NODE_TARBALL" -C "$NODE_EXTRACT_DIR"

  NODE_SOURCE="$NODE_EXTRACT_DIR/node-v${NODE_VERSION}-linux-x64"
  [[ -d "$NODE_SOURCE" ]] || die "Unexpected Node.js tarball layout — 'node-v${NODE_VERSION}-linux-x64' not found."

  # The node binary is self-contained (links only against glibc, always present).
  # Copy just the binary — npm, npx, and node_modules are not needed at runtime.
  echo "[Node] Copying node binary ..."
  cp "$NODE_SOURCE/bin/node" "$NODE_DEST/node"
  chmod +x "$NODE_DEST/node"

  # Write sentinel so subsequent runs skip the download.
  echo "Node.js $NODE_VERSION bundled on $(date +%Y-%m-%d)" > "$NODE_SENTINEL"

  echo "[Node] Done."
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "Bundle complete."
echo "  PostgreSQL : $PG_DEST"
echo "  Node.js    : $NODE_DEST"
