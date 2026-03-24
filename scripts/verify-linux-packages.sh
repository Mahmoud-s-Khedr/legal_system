#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE_DIR="$ROOT_DIR/apps/desktop/src-tauri/target/release/bundle"
TMP_DIR="$(mktemp -d -t elms-linux-verify-XXXXXX)"

trap 'rm -rf "$TMP_DIR"' EXIT

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
}

verify_deb() {
  local deb_file="$1"
  local extract_dir="$TMP_DIR/deb"

  echo "Verifying Debian package payload: $deb_file"
  mkdir -p "$extract_dir"
  dpkg-deb -x "$deb_file" "$extract_dir"
  verify_bundle_root "$extract_dir/usr/lib/ELMS"
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
}

require_cmd node
require_cmd dpkg-deb
require_cmd docker

APPIMAGE_FILE="$(find_single_artifact "$BUNDLE_DIR/appimage/*.AppImage")"
DEB_FILE="$(find_single_artifact "$BUNDLE_DIR/deb/*.deb")"
RPM_FILE="$(find_single_artifact "$BUNDLE_DIR/rpm/*.rpm")"

verify_appimage "$APPIMAGE_FILE"
verify_deb "$DEB_FILE"
verify_rpm "$RPM_FILE"

echo "Linux package artifacts verified."
