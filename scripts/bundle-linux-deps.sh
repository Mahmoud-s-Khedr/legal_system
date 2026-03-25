#!/usr/bin/env bash
# bundle-linux-deps.sh
#
# SYNOPSIS
#   Downloads/extracts PostgreSQL and Node.js Linux binaries into
#   apps/desktop/resources/ for the ELMS desktop Linux installer (AppImage / deb).
#
# DESCRIPTION
#   - PostgreSQL <PG_VERSION>  → apps/desktop/resources/postgres/
#       <layout.env-driven tree>
#         - preserves bindir / sharedir / pkglibdir relative to a synthetic root
#         - collects runtime .so files into the sibling lib/ directory expected by the bundled executables
#         - writes .layout.env so the verifier and desktop runtime resolve the packaged paths consistently
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

path_common_ancestor() {
  local path
  local -a common_parts=()
  local initialized=0

  for path in "$@"; do
    local -a path_parts=()
    IFS='/' read -r -a path_parts <<<"${path#/}"

    if [[ $initialized -eq 0 ]]; then
      common_parts=("${path_parts[@]}")
      initialized=1
      continue
    fi

    local max_index="${#common_parts[@]}"
    if [[ "${#path_parts[@]}" -lt "$max_index" ]]; then
      max_index="${#path_parts[@]}"
    fi

    local index=0
    while [[ "$index" -lt "$max_index" && "${common_parts[$index]}" == "${path_parts[$index]}" ]]; do
      ((index += 1))
    done

    common_parts=("${common_parts[@]:0:index}")
  done

  if [[ "${#common_parts[@]}" -eq 0 ]]; then
    printf '/\n'
    return
  fi

  local joined
  joined="$(IFS=/; printf '%s' "${common_parts[*]}")"
  printf '/%s\n' "$joined"
}

is_safe_relative_path() {
  local path="$1"

  [[ -n "$path" ]] || return 1
  [[ "$path" != /* ]] || return 1
  [[ "$path" != "." ]] || return 1
  [[ "$path" != *"/.."* ]] || return 1
  [[ "$path" != ".."* ]] || return 1
  [[ "$path" != *"../"* ]] || return 1
  [[ "$path" != *"/./"* ]] || return 1
  [[ "$path" != "./"* ]] || return 1
  [[ "$path" != *"/." ]] || return 1
}

resolve_relative_from_root() {
  local root="$1"
  local path="$2"
  local relative

  relative="$(realpath --relative-to="$root" "$path")"
  is_safe_relative_path "$relative" || die "Refusing to bundle unsafe relative path '$relative' from '$path'."
  printf '%s\n' "$relative"
}

manifest_layout_is_usable() {
  local layout_file="$1"
  local bundle_root="$2"

  [[ -f "$layout_file" ]] || return 1
  # shellcheck disable=SC1090
  source "$layout_file"

  local required=(
    "${POSTGRES_BIN_DIR:-}"
    "${POSTGRES_SHARE_DIR:-}"
    "${POSTGRES_PKGLIB_DIR:-}"
    "${POSTGRES_RUNTIME_LIB_DIR:-}"
  )

  local entry
  for entry in "${required[@]}"; do
    is_safe_relative_path "$entry" || return 1
    [[ -d "$bundle_root/$entry" ]] || return 1
  done

  return 0
}

linux_postgres_bundle_is_usable() {
  local layout_file="$1"
  local bundle_root="$2"

  manifest_layout_is_usable "$layout_file" "$bundle_root" || return 1
  # shellcheck disable=SC1090
  source "$layout_file"

  local exe
  for exe in pg_ctl initdb pg_isready createdb postgres; do
    [[ -f "$bundle_root/$POSTGRES_BIN_DIR/$exe" ]] || return 1
  done

  return 0
}

linux_node_bundle_is_usable() {
  local node_root="$1"

  [[ -f "$node_root/node" ]] || return 1
  [[ ! -f "$node_root/node.exe" ]] || return 1
  return 0
}

run_postgres_layout_smoke_test() {
  local bundle_root="$1"
  local bin_relative="$2"

  local bin_dir="$bundle_root/$bin_relative"
  local smoke_root="$TMP_DIR/postgres-smoke"
  local data_dir="$smoke_root/data"

  mkdir -p "$smoke_root"

  echo "[PG] Running bundled PostgreSQL smoke test ..."
  "$bin_dir/postgres" -V >/dev/null
  "$bin_dir/initdb" -D "$data_dir" -A trust -U elms --no-sync >/dev/null
  rm -rf "$smoke_root"
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
PG_LAYOUT_FILE="$PG_DEST/.layout.env"

if [[ -f "$PG_SENTINEL" ]] && linux_postgres_bundle_is_usable "$PG_LAYOUT_FILE" "$PG_DEST"; then
  echo "[PG] PostgreSQL $PG_VERSION already bundled — skipping."
else
  if [[ -d "$PG_DEST" ]]; then
    echo "[PG] Existing PostgreSQL bundle is missing the layout manifest or has stale paths — rebuilding."
    rm -rf "$PG_DEST"
  fi

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
  PG_BIN_DIR="$(realpath "$(pg_config --bindir)")"
  PG_SHARE_DIR="$(realpath "$(pg_config --sharedir)")"
  PG_PKG_LIB_DIR="$(realpath "$(pg_config --pkglibdir)")"   # server-side .so plugins
  PG_BUNDLE_ROOT="$(path_common_ancestor "$PG_BIN_DIR" "$PG_SHARE_DIR" "$PG_PKG_LIB_DIR")"
  PG_BIN_RELATIVE="$(resolve_relative_from_root "$PG_BUNDLE_ROOT" "$PG_BIN_DIR")"
  PG_SHARE_RELATIVE="$(resolve_relative_from_root "$PG_BUNDLE_ROOT" "$PG_SHARE_DIR")"
  PG_PKG_LIB_RELATIVE="$(resolve_relative_from_root "$PG_BUNDLE_ROOT" "$PG_PKG_LIB_DIR")"
  if [[ "$(dirname "$PG_BIN_RELATIVE")" == "." ]]; then
    PG_RUNTIME_LIB_RELATIVE="lib"
  else
    PG_RUNTIME_LIB_RELATIVE="$(dirname "$PG_BIN_RELATIVE")/lib"
  fi
  is_safe_relative_path "$PG_RUNTIME_LIB_RELATIVE" || die "Computed unsafe runtime library path '$PG_RUNTIME_LIB_RELATIVE'."
  PG_BIN_DEST="$PG_DEST/$PG_BIN_RELATIVE"
  PG_SHARE_DEST="$PG_DEST/$PG_SHARE_RELATIVE"
  PG_PKG_LIB_DEST="$PG_DEST/$PG_PKG_LIB_RELATIVE"
  PG_RUNTIME_LIB_DEST="$PG_DEST/$PG_RUNTIME_LIB_RELATIVE"

  [[ -d "$PG_BIN_DIR" ]]   || die "pg_config --bindir returned non-existent directory: $PG_BIN_DIR"
  [[ -d "$PG_SHARE_DIR" ]] || die "pg_config --sharedir returned non-existent directory: $PG_SHARE_DIR"
  [[ -d "$PG_PKG_LIB_DIR" ]] || die "pg_config --pkglibdir returned non-existent directory: $PG_PKG_LIB_DIR"

  mkdir -p "$PG_BIN_DEST" "$PG_SHARE_DEST" "$PG_PKG_LIB_DEST" "$PG_RUNTIME_LIB_DEST"

  # Copy the five executables needed by sidecar.rs at runtime.
  echo "[PG] Copying executables from $PG_BIN_DIR ..."
  for exe in pg_ctl initdb pg_isready createdb postgres; do
    src="$PG_BIN_DIR/$exe"
    [[ -f "$src" ]] || die "Expected executable not found: $src"
    cp "$src" "$PG_BIN_DEST/"
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
  # into the runtime library directory so the packaged executables are self-contained.
  #
  # Excluded: glibc family (libc, libm, libdl, libpthread, librt, ld-linux) and
  # linux-vdso — these are always present on the target system.
  echo "[PG] Collecting shared library dependencies via ldd ..."
  EXCLUDE_PATTERN="libc\.so|libm\.so|libdl\.so|libpthread\.so|librt\.so|ld-linux|linux-vdso"

  for exe in pg_ctl initdb pg_isready createdb postgres; do
    while read -r lib; do
      [[ -f "$lib" ]] && cp -n "$lib" "$PG_RUNTIME_LIB_DEST/" && echo "    + $(basename "$lib")"
    done < <(
      ldd "$PG_BIN_DEST/$exe" 2>/dev/null \
        | awk '/=>/ { print $3 }' \
        | grep -Ev "$EXCLUDE_PATTERN" || true
    )
  done

  # Patch RPATH on each binary so they resolve bundled libs via a path that is
  # relative to the preserved bindir layout inside the bundle.
  # without requiring LD_LIBRARY_PATH to be set at runtime.
  echo "[PG] Patching RPATH with patchelf ..."
  PG_RPATH_RELATIVE="$(realpath --relative-to="$PG_BIN_DEST" "$PG_RUNTIME_LIB_DEST")"
  for exe in pg_ctl initdb pg_isready createdb postgres; do
    patchelf --set-rpath "\$ORIGIN/$PG_RPATH_RELATIVE" "$PG_BIN_DEST/$exe"
  done

  cat > "$PG_LAYOUT_FILE" <<EOF
POSTGRES_BIN_DIR=$PG_BIN_RELATIVE
POSTGRES_SHARE_DIR=$PG_SHARE_RELATIVE
POSTGRES_PKGLIB_DIR=$PG_PKG_LIB_RELATIVE
POSTGRES_RUNTIME_LIB_DIR=$PG_RUNTIME_LIB_RELATIVE
EOF

  run_postgres_layout_smoke_test "$PG_DEST" "$PG_BIN_RELATIVE"

  # Write sentinel so subsequent runs skip the whole block.
  echo "PostgreSQL $PG_VERSION bundled on $(date +%Y-%m-%d)" > "$PG_SENTINEL"

  echo "[PG] Done."
fi

# ── Node.js ───────────────────────────────────────────────────────────────────

NODE_SENTINEL="$NODE_DEST/.bundle-complete"

if [[ -f "$NODE_SENTINEL" ]] && linux_node_bundle_is_usable "$NODE_DEST"; then
  echo "[Node] Node.js $NODE_VERSION already bundled — skipping."
else
  if [[ -d "$NODE_DEST" ]]; then
    echo "[Node] Existing Node.js bundle is missing the expected Linux runtime binary — rebuilding."
    rm -rf "$NODE_DEST"
  fi

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
