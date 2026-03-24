#!/usr/bin/env bash
# bundle-macos-deps.sh
#
# SYNOPSIS
#   Downloads/extracts Node.js and bundles Homebrew PostgreSQL into
#   apps/desktop/resources/ for the ELMS desktop macOS installer (dmg).
#
# DESCRIPTION
#   - PostgreSQL <PG_VERSION> via Homebrew formula postgresql@<PG_VERSION>
#       → apps/desktop/resources/postgres/
#         - preserves bindir / sharedir / pkglibdir relative to a synthetic root
#         - copies non-system .dylib dependencies into the sibling lib/ directory
#         - rewrites Mach-O load commands to resolve bundled libraries instead of
#           Homebrew cellar paths
#         - writes .layout.env so the verifier and desktop runtime resolve the
#           packaged paths consistently
#   - Node.js <NODE_VERSION> darwin-<arch> tarball → apps/desktop/resources/node/
#       node   — single executable consumed by the desktop sidecar runtime
#
#   Both downloads/copies are skipped when the target directory already contains
#   a valid .bundle-complete sentinel file (idempotent — safe to re-run in CI).

set -euo pipefail

PG_VERSION="${PG_VERSION:-16}"
NODE_VERSION="${NODE_VERSION:-22.14.0}"
NODE_ARCH="${NODE_ARCH:-arm64}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
RESOURCE_DIR="$REPO_ROOT/apps/desktop/resources"
TMP_DIR="$(mktemp -d -t elms-bundle-XXXXXX)"

PG_DEST="$RESOURCE_DIR/postgres"
NODE_DEST="$RESOURCE_DIR/node"
COPIED_LIBS_FILE="$TMP_DIR/copied-libs.txt"

trap 'rm -rf "$TMP_DIR"' EXIT

touch "$COPIED_LIBS_FILE"

die() { echo "ERROR: $*" >&2; exit 1; }

require_cmd() {
  command -v "$1" &>/dev/null || die "'$1' is required but not found in PATH."
}

canonicalize_existing_path() {
  python3 - "$1" <<'PY'
import os
import sys

print(os.path.realpath(sys.argv[1]))
PY
}

relative_path_between() {
  python3 - "$1" "$2" <<'PY'
import os
import sys

print(os.path.relpath(sys.argv[2], sys.argv[1]))
PY
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
      index=$((index + 1))
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

  relative="$(relative_path_between "$root" "$path")"
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

is_macho_file() {
  file "$1" | grep -q 'Mach-O'
}

is_system_dependency_reference() {
  case "$1" in
    /System/*|/usr/lib/*|/System/Volumes/Preboot/Cryptexes/OS/usr/lib/*|/Library/Developer/CommandLineTools/*)
      return 0
      ;;
  esac
  return 1
}

list_macho_dependencies() {
  otool -L "$1" | awk 'NR > 1 { print $1 }'
}

list_macho_rpaths() {
  otool -l "$1" | awk '
    $1 == "cmd" && $2 == "LC_RPATH" { in_rpath = 1; next }
    in_rpath && $1 == "path" { print $2; in_rpath = 0 }
  '
}

resolve_special_path() {
  local path="$1"
  local source_file="$2"
  local source_dir

  source_dir="$(dirname "$source_file")"

  case "$path" in
    @loader_path/*)
      canonicalize_existing_path "$source_dir/${path#@loader_path/}"
      ;;
    @executable_path/*)
      canonicalize_existing_path "$source_dir/${path#@executable_path/}"
      ;;
    /*)
      canonicalize_existing_path "$path"
      ;;
    *)
      return 1
      ;;
  esac
}

resolve_dependency_path() {
  local dep_ref="$1"
  local source_file="$2"
  local source_dir
  local rpath
  local rpath_dir
  local candidate

  source_dir="$(dirname "$source_file")"

  case "$dep_ref" in
    @loader_path/*)
      candidate="$source_dir/${dep_ref#@loader_path/}"
      [[ -e "$candidate" ]] || return 1
      canonicalize_existing_path "$candidate"
      return
      ;;
    @executable_path/*)
      candidate="$source_dir/${dep_ref#@executable_path/}"
      [[ -e "$candidate" ]] || return 1
      canonicalize_existing_path "$candidate"
      return
      ;;
    @rpath/*)
      while IFS= read -r rpath; do
        [[ -n "$rpath" ]] || continue
        if ! rpath_dir="$(resolve_special_path "$rpath" "$source_file" 2>/dev/null)"; then
          continue
        fi
        candidate="$rpath_dir/${dep_ref#@rpath/}"
        if [[ -e "$candidate" ]]; then
          canonicalize_existing_path "$candidate"
          return
        fi
      done < <(list_macho_rpaths "$source_file")
      return 1
      ;;
    /*)
      [[ -e "$dep_ref" ]] || return 1
      canonicalize_existing_path "$dep_ref"
      return
      ;;
    *)
      return 1
      ;;
  esac
}

mark_runtime_lib_copied() {
  local dep_path="$1"

  if ! grep -Fqx "$dep_path" "$COPIED_LIBS_FILE"; then
    printf '%s\n' "$dep_path" >>"$COPIED_LIBS_FILE"
  fi
}

runtime_lib_already_copied() {
  local dep_path="$1"
  grep -Fqx "$dep_path" "$COPIED_LIBS_FILE"
}

bundle_relative_loader_path() {
  local target_dir="$1"
  local runtime_dir="$2"
  local basename="$3"
  local relative

  relative="$(relative_path_between "$target_dir" "$runtime_dir")"
  if [[ "$relative" == "." ]]; then
    printf '@loader_path/%s\n' "$basename"
  else
    printf '@loader_path/%s/%s\n' "$relative" "$basename"
  fi
}

rewrite_macho_loads() {
  local original_file="$1"
  local copied_file="$2"
  local dep_ref
  local dep_path
  local replacement
  local target_dir

  target_dir="$(dirname "$copied_file")"

  while IFS= read -r dep_ref; do
    [[ -n "$dep_ref" ]] || continue
    if is_system_dependency_reference "$dep_ref"; then
      continue
    fi

    dep_path="$(resolve_dependency_path "$dep_ref" "$original_file")" || die "Unable to resolve dependency '$dep_ref' referenced by '$original_file'."
    if is_system_dependency_reference "$dep_path"; then
      continue
    fi

    copy_runtime_library "$dep_path"
    replacement="$(bundle_relative_loader_path "$target_dir" "$PG_RUNTIME_LIB_DEST" "$(basename "$dep_path")")"

    if [[ "$dep_ref" != "$replacement" ]]; then
      install_name_tool -change "$dep_ref" "$replacement" "$copied_file"
    fi
  done < <(list_macho_dependencies "$original_file")
}

copy_runtime_library() {
  local dep_path="$1"
  local dep_base
  local dep_dest

  dep_base="$(basename "$dep_path")"
  dep_dest="$PG_RUNTIME_LIB_DEST/$dep_base"

  if runtime_lib_already_copied "$dep_path"; then
    return
  fi

  if [[ -e "$dep_dest" ]]; then
    die "Refusing to overwrite existing runtime library '$dep_dest' while bundling '$dep_path'."
  fi

  cp -L "$dep_path" "$dep_dest"
  chmod u+w "$dep_dest"
  mark_runtime_lib_copied "$dep_path"

  install_name_tool -id "@loader_path/$dep_base" "$dep_dest"
  rewrite_macho_loads "$dep_path" "$dep_dest"
}

run_postgres_layout_smoke_test() {
  local bundle_root="$1"
  local bin_relative="$2"
  local share_relative="$3"
  local bin_dir="$bundle_root/$bin_relative"
  local share_dir="$bundle_root/$share_relative"
  local smoke_root="$TMP_DIR/postgres-smoke"
  local data_dir="$smoke_root/data"

  mkdir -p "$smoke_root"

  echo "[PG] Running bundled PostgreSQL smoke test ..."
  "$bin_dir/postgres" -V >/dev/null
  "$bin_dir/initdb" -D "$data_dir" -A trust -U elms --no-sync -L "$share_dir" >/dev/null
  rm -rf "$smoke_root"
}

require_cmd brew
require_cmd curl
require_cmd tar
require_cmd otool
require_cmd install_name_tool
require_cmd file
require_cmd python3

# ── PostgreSQL ───────────────────────────────────────────────────────────────

PG_SENTINEL="$PG_DEST/.bundle-complete"
PG_LAYOUT_FILE="$PG_DEST/.layout.env"

if [[ -f "$PG_SENTINEL" ]] && manifest_layout_is_usable "$PG_LAYOUT_FILE" "$PG_DEST"; then
  echo "[PG] PostgreSQL $PG_VERSION already bundled — skipping."
else
  if [[ -d "$PG_DEST" ]]; then
    echo "[PG] Existing PostgreSQL bundle is missing the layout manifest or has stale paths — rebuilding."
    rm -rf "$PG_DEST"
  fi

  echo "[PG] Bundling PostgreSQL $PG_VERSION ..."

  PG_FORMULA="postgresql@$PG_VERSION"
  if ! brew list "$PG_FORMULA" &>/dev/null; then
    echo "[PG] Installing Homebrew formula $PG_FORMULA ..."
    HOMEBREW_NO_AUTO_UPDATE=1 brew install "$PG_FORMULA"
  fi

  PG_PREFIX="$(brew --prefix "$PG_FORMULA")"
  PG_CONFIG_BIN="$PG_PREFIX/bin/pg_config"
  [[ -x "$PG_CONFIG_BIN" ]] || die "Expected pg_config at $PG_CONFIG_BIN"

  PG_BIN_DIR="$(canonicalize_existing_path "$("$PG_CONFIG_BIN" --bindir)")"
  PG_SHARE_DIR="$(canonicalize_existing_path "$("$PG_CONFIG_BIN" --sharedir)")"
  PG_PKG_LIB_DIR="$(canonicalize_existing_path "$("$PG_CONFIG_BIN" --pkglibdir)")"
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

  mkdir -p "$PG_BIN_DEST" "$PG_SHARE_DEST" "$PG_PKG_LIB_DEST" "$PG_RUNTIME_LIB_DEST"

  echo "[PG] Copying executables from $PG_BIN_DIR ..."
  for exe in pg_ctl initdb pg_isready createdb postgres; do
    src="$PG_BIN_DIR/$exe"
    [[ -f "$src" ]] || die "Expected executable not found: $src"
    cp "$src" "$PG_BIN_DEST/"
    chmod u+w "$PG_BIN_DEST/$exe"
  done

  echo "[PG] Copying sharedir ($PG_SHARE_DIR) to $PG_SHARE_DEST ..."
  cp -R "$PG_SHARE_DIR/." "$PG_SHARE_DEST/"

  echo "[PG] Copying pkglibdir ($PG_PKG_LIB_DIR) to $PG_PKG_LIB_DEST ..."
  cp -R "$PG_PKG_LIB_DIR/." "$PG_PKG_LIB_DEST/"

  echo "[PG] Rewriting executable dependencies ..."
  for exe in pg_ctl initdb pg_isready createdb postgres; do
    rewrite_macho_loads "$PG_BIN_DIR/$exe" "$PG_BIN_DEST/$exe"
  done

  echo "[PG] Rewriting extension module dependencies ..."
  while IFS= read -r original_module; do
    [[ -n "$original_module" ]] || continue
    if ! is_macho_file "$original_module"; then
      continue
    fi

    module_relative="${original_module#$PG_PKG_LIB_DIR/}"
    copied_module="$PG_PKG_LIB_DEST/$module_relative"
    chmod u+w "$copied_module"
    rewrite_macho_loads "$original_module" "$copied_module"
  done < <(find "$PG_PKG_LIB_DIR" -type f)

  cat > "$PG_LAYOUT_FILE" <<EOF
POSTGRES_BIN_DIR=$PG_BIN_RELATIVE
POSTGRES_SHARE_DIR=$PG_SHARE_RELATIVE
POSTGRES_PKGLIB_DIR=$PG_PKG_LIB_RELATIVE
POSTGRES_RUNTIME_LIB_DIR=$PG_RUNTIME_LIB_RELATIVE
EOF

  run_postgres_layout_smoke_test "$PG_DEST" "$PG_BIN_RELATIVE" "$PG_SHARE_RELATIVE"

  echo "PostgreSQL $PG_VERSION bundled on $(date +%Y-%m-%d)" > "$PG_SENTINEL"

  echo "[PG] Done."
fi

# ── Node.js ──────────────────────────────────────────────────────────────────

NODE_SENTINEL="$NODE_DEST/.bundle-complete"
NODE_BIN="$NODE_DEST/node"
case "$NODE_ARCH" in
  arm64) NODE_DIST_TAG="darwin-arm64" ;;
  x64) NODE_DIST_TAG="darwin-x64" ;;
  *) die "Unsupported NODE_ARCH '$NODE_ARCH'. Expected 'arm64' or 'x64'." ;;
esac

if [[ -f "$NODE_SENTINEL" ]] && [[ -x "$NODE_BIN" ]] && grep -Fq "$NODE_DIST_TAG" "$NODE_SENTINEL"; then
  echo "[Node] Node.js $NODE_VERSION ($NODE_DIST_TAG) already bundled — skipping."
else
  if [[ -d "$NODE_DEST" ]]; then
    echo "[Node] Existing Node.js bundle does not match the requested architecture — rebuilding."
    rm -rf "$NODE_DEST"
  fi

  echo "[Node] Bundling Node.js $NODE_VERSION ($NODE_DIST_TAG) ..."

  NODE_TARBALL="node-v${NODE_VERSION}-${NODE_DIST_TAG}.tar.gz"
  NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TARBALL}"
  NODE_EXTRACT_DIR="$TMP_DIR/node-extract"

  mkdir -p "$NODE_EXTRACT_DIR" "$NODE_DEST"

  echo "[Node] Downloading $NODE_URL ..."
  curl -fsSL "$NODE_URL" -o "$TMP_DIR/$NODE_TARBALL"

  echo "[Node] Extracting ..."
  tar -xzf "$TMP_DIR/$NODE_TARBALL" -C "$NODE_EXTRACT_DIR"

  NODE_SOURCE="$NODE_EXTRACT_DIR/node-v${NODE_VERSION}-${NODE_DIST_TAG}"
  [[ -d "$NODE_SOURCE" ]] || die "Unexpected Node.js tarball layout — 'node-v${NODE_VERSION}-${NODE_DIST_TAG}' not found."

  echo "[Node] Copying node binary ..."
  cp "$NODE_SOURCE/bin/node" "$NODE_BIN"
  chmod +x "$NODE_BIN"

  echo "Node.js $NODE_VERSION ${NODE_DIST_TAG} bundled on $(date +%Y-%m-%d)" > "$NODE_SENTINEL"

  echo "[Node] Done."
fi

echo ""
echo "Bundle complete."
echo "  PostgreSQL : $PG_DEST"
echo "  Node.js    : $NODE_DEST"
