#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE_DIR="$ROOT_DIR/apps/desktop/src-tauri/target/release/bundle"
TMP_DIR="$(mktemp -d -t elms-linux-verify-XXXXXX)"
VERIFY_LINUX_BUNDLES="${VERIFY_LINUX_BUNDLES:-appimage,deb,rpm}"

cleanup() {
  local status=$?

  if rm -rf "$TMP_DIR" 2>/dev/null; then
    exit "$status"
  fi

  if command -v docker >/dev/null 2>&1; then
    docker run --rm \
      -v "$TMP_DIR:/cleanup" \
      ubuntu:24.04 \
      bash -lc '
        set -euo pipefail
        find /cleanup -mindepth 1 -delete
      ' >/dev/null 2>&1 || true

    rm -rf "$TMP_DIR" 2>/dev/null || true
  fi

  if [[ -d "$TMP_DIR" ]]; then
    echo "WARN: Failed to fully remove temporary verification directory: $TMP_DIR" >&2
  fi

  exit "$status"
}
trap cleanup EXIT

die() {
  echo "ERROR: $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' is required but not found in PATH."
}

find_single_artifact() {
  local pattern="$1"
  local files=()
  shopt -s nullglob
  files=($pattern)
  shopt -u nullglob

  [[ "${#files[@]}" -gt 0 ]] || die "No artifact found for pattern: $pattern"
  printf '%s\n' "${files[0]}"
}

verify_bundle_root() {
  local bundle_root="$1"
  node "$ROOT_DIR/scripts/verify-packaged-desktop-tree.mjs" "$bundle_root"
}

run_postgres_runtime_smoke() {
  local image="$1"
  local mount_dir="$2"
  local bundle_root="$3"
  local label="$4"
  local smoke_uid
  local smoke_gid

  smoke_uid="$(id -u)"
  smoke_gid="$(id -g)"
  if [[ -z "$smoke_uid" || -z "$smoke_gid" ]]; then
    die "Failed to resolve host UID/GID for PostgreSQL smoke container."
  fi

  echo "Running PostgreSQL runtime smoke in $label: $bundle_root (container uid:gid ${smoke_uid}:${smoke_gid})"

  docker run --rm \
    --user "${smoke_uid}:${smoke_gid}" \
    -v "$mount_dir:/bundle:ro" \
    "$image" \
    bash -lc '
      set -euo pipefail
      BUNDLE_ROOT="$1"
      EFFECTIVE_UID="$(id -u)"
      EFFECTIVE_GID="$(id -g)"
      echo "PostgreSQL smoke effective uid:gid ${EFFECTIVE_UID}:${EFFECTIVE_GID}"
      if [[ "$EFFECTIVE_UID" -eq 0 ]]; then
        echo "PostgreSQL smoke must not run as root; initdb rejects UID 0." >&2
        exit 1
      fi
      POSTGRES_ROOT="$BUNDLE_ROOT/postgres"
      [[ -f "$POSTGRES_ROOT/.layout.env" ]] || { echo "Missing $POSTGRES_ROOT/.layout.env" >&2; exit 1; }
      # shellcheck disable=SC1090
      source "$POSTGRES_ROOT/.layout.env"

      BIN_DIR="$POSTGRES_ROOT/$POSTGRES_BIN_DIR"
      RUNTIME_LIB_DIR="$POSTGRES_ROOT/$POSTGRES_RUNTIME_LIB_DIR"
      [[ -d "$RUNTIME_LIB_DIR" ]] || { echo "Missing runtime library dir: $RUNTIME_LIB_DIR" >&2; exit 1; }

      LDD_OUTPUT="$(ldd "$BIN_DIR/postgres" 2>&1 || true)"
      if grep -q "not found" <<<"$LDD_OUTPUT"; then
        echo "Bundled postgres has unresolved shared libraries:" >&2
        echo "$LDD_OUTPUT" >&2
        exit 1
      fi

      export LD_LIBRARY_PATH="$RUNTIME_LIB_DIR${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
      SMOKE_ROOT="$(mktemp -d -t elms-pg-smoke-XXXXXX)"
      [[ -d "$SMOKE_ROOT" ]] || { echo "Failed to create smoke temp dir as uid:gid ${EFFECTIVE_UID}:${EFFECTIVE_GID}" >&2; exit 1; }
      DATA_DIR="$SMOKE_ROOT/data"
      LOG_FILE="$SMOKE_ROOT/postgres.log"
      SOCK_DIR="$SMOKE_ROOT/socket"
      PORT=55439
      mkdir -p "$SOCK_DIR"

      "$BIN_DIR/postgres" -V >/dev/null
      "$BIN_DIR/initdb" -D "$DATA_DIR" -A trust -U elms --no-sync >/dev/null
      "$BIN_DIR/pg_ctl" -D "$DATA_DIR" -l "$LOG_FILE" -o "-p $PORT -k $SOCK_DIR" start >/dev/null
      "$BIN_DIR/pg_isready" -h 127.0.0.1 -p "$PORT" -t 1 >/dev/null
      "$BIN_DIR/pg_ctl" -D "$DATA_DIR" -m fast stop >/dev/null
    ' _ "$bundle_root"
}

verify_appimage() {
  local appimage_file="$1"
  local extract_dir="$TMP_DIR/appimage"

  echo "Verifying AppImage payload: $appimage_file"
  mkdir -p "$extract_dir"
  cp "$appimage_file" "$extract_dir/ELMS.AppImage"
  chmod +x "$extract_dir/ELMS.AppImage"

  (
    cd "$extract_dir"
    ./ELMS.AppImage --appimage-extract >/dev/null
  )

  verify_bundle_root "$extract_dir/squashfs-root/usr/lib/ELMS"
  run_postgres_runtime_smoke "ubuntu:24.04" "$extract_dir/squashfs-root" "/bundle/usr/lib/ELMS" "Ubuntu container (AppImage)"
}

verify_deb() {
  local deb_file="$1"
  local extract_dir="$TMP_DIR/deb"
  local deb_relative="${deb_file#"$ROOT_DIR"/}"

  echo "Verifying Debian package payload: $deb_file"
  mkdir -p "$extract_dir"

  docker run --rm \
    -v "$ROOT_DIR:/workspace:ro" \
    -v "$extract_dir:/extract" \
    ubuntu:24.04 \
    bash -lc '
      set -euo pipefail
      dpkg-deb -x "/workspace/'"$deb_relative"'" /extract
    '

  verify_bundle_root "$extract_dir/usr/lib/ELMS"
  run_postgres_runtime_smoke "ubuntu:24.04" "$extract_dir" "/bundle/usr/lib/ELMS" "Ubuntu container (.deb)"
}

verify_rpm() {
  local rpm_file="$1"
  local install_root="$TMP_DIR/fedora-root"

  echo "Verifying RPM install in Fedora container: $rpm_file"
  mkdir -p "$install_root"

  docker run --rm \
    -v "$ROOT_DIR:/workspace:ro" \
    -v "$install_root:/verify-root" \
    fedora:41 \
    bash -lc '
      set -euo pipefail
      rpm --root /verify-root --initdb
      rpm --root /verify-root -ivh --nodeps --nosignature /workspace/'"${rpm_file#"$ROOT_DIR"/}"' >/dev/null
    '

  verify_bundle_root "$install_root/usr/lib/ELMS"
  run_postgres_runtime_smoke "fedora:41" "$install_root" "/bundle/usr/lib/ELMS" "Fedora container (.rpm)"
}

IFS=',' read -r -a bundle_types <<<"$VERIFY_LINUX_BUNDLES"

for bundle_type in "${bundle_types[@]}"; do
  case "$bundle_type" in
    appimage)
      require_cmd node
      APPIMAGE_FILE="$(find_single_artifact "$BUNDLE_DIR/appimage/*.AppImage")"
      verify_appimage "$APPIMAGE_FILE"
      ;;
    deb)
      require_cmd node
      require_cmd docker
      DEB_FILE="$(find_single_artifact "$BUNDLE_DIR/deb/*.deb")"
      verify_deb "$DEB_FILE"
      ;;
    rpm)
      require_cmd node
      require_cmd docker
      RPM_FILE="$(find_single_artifact "$BUNDLE_DIR/rpm/*.rpm")"
      verify_rpm "$RPM_FILE"
      ;;
    "")
      ;;
    *)
      die "Unsupported Linux bundle type: $bundle_type"
      ;;
  esac
done

echo "Linux package artifacts verified."
