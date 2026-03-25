#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGETS="${DESKTOP_RELEASE_TARGETS:-linux,windows}"

if [[ "${1:-}" == "--targets" ]]; then
  TARGETS="${2:-}"
fi

if [[ ! -f /etc/os-release ]]; then
  echo "Unable to detect Linux distribution: /etc/os-release is missing." >&2
  exit 1
fi

# shellcheck disable=SC1091
source /etc/os-release

DISTRO_FAMILY=""
case "${ID:-}" in
  ubuntu|debian)
    DISTRO_FAMILY="ubuntu"
    ;;
  fedora)
    DISTRO_FAMILY="fedora"
    ;;
  *)
    if [[ "${ID_LIKE:-}" == *debian* ]]; then
      DISTRO_FAMILY="ubuntu"
    elif [[ "${ID_LIKE:-}" == *fedora* ]] || [[ "${ID_LIKE:-}" == *rhel* ]]; then
      DISTRO_FAMILY="fedora"
    fi
    ;;
esac

if [[ -z "$DISTRO_FAMILY" ]]; then
  echo "Unsupported Linux distribution '${PRETTY_NAME:-${ID:-unknown}}'. Supported local packaging hosts are Ubuntu-family and Fedora-family systems." >&2
  exit 1
fi

has_target() {
  local needle="$1"
  [[ ",$TARGETS," == *",$needle,"* ]]
}

have_archive_extractor() {
  if command -v 7z >/dev/null 2>&1 || command -v 7zz >/dev/null 2>&1 || command -v bsdtar >/dev/null 2>&1; then
    return 0
  fi

  node - "$ROOT_DIR" <<'EOF' >/dev/null 2>&1
const { createRequire } = require("node:module");
const { accessSync, chmodSync, constants } = require("node:fs");
const { join } = require("node:path");

const rootDir = process.argv[2];
const requireFromRoot = createRequire(join(rootDir, "package.json"));
const { path7za } = requireFromRoot("7zip-bin");
chmodSync(path7za, 0o755);
accessSync(path7za, constants.X_OK);
EOF
}

missing=()

require_cmd() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    missing+=("$command_name")
  fi
}

for command_name in pnpm node cargo rustup curl tar patchelf docker; do
  require_cmd "$command_name"
done

if has_target linux; then
  for command_name in dpkg-deb fakeroot rpmbuild rpm; do
    require_cmd "$command_name"
  done
fi

if has_target windows; then
  for command_name in cargo-xwin pwsh; do
    require_cmd "$command_name"
  done

  if ! command -v makensis >/dev/null 2>&1 && ! command -v makensis.exe >/dev/null 2>&1; then
    missing+=("makensis")
  fi

  if ! have_archive_extractor; then
    missing+=("archive-extractor")
  fi
fi

if [[ "${#missing[@]}" -eq 0 ]]; then
  echo "Desktop packaging host looks ready for targets: $TARGETS"
  echo "Detected Linux family: $DISTRO_FAMILY (${PRETTY_NAME:-${ID:-unknown}})"
  exit 0
fi

echo "Desktop packaging host is missing required tools for targets: $TARGETS" >&2
echo "Detected Linux family: $DISTRO_FAMILY (${PRETTY_NAME:-${ID:-unknown}})" >&2
printf 'Missing checks: %s\n' "${missing[*]}" >&2
echo >&2
echo "Install guidance:" >&2
echo "  - Node.js + pnpm: install Node.js 22, then run 'corepack enable pnpm'." >&2
echo "  - Rust toolchain: run 'curl https://sh.rustup.rs -sSf | sh -s -- -y' and reload your shell." >&2
echo "  - cargo-xwin: run 'cargo install --locked cargo-xwin'." >&2
echo "  - Repo-managed 7-Zip extractor: run 'pnpm install --frozen-lockfile'." >&2

if [[ "$DISTRO_FAMILY" == "ubuntu" ]]; then
  echo "  - Ubuntu packages: sudo apt-get update && sudo apt-get install -y curl tar file patchelf docker.io rpm fakeroot dpkg-dev nsis" >&2
  cat >&2 <<'EOF'
  - PowerShell:
    sudo apt-get update && sudo apt-get install -y wget apt-transport-https software-properties-common
    wget -q https://packages.microsoft.com/config/ubuntu/24.04/packages-microsoft-prod.deb -O /tmp/packages-microsoft-prod.deb
    sudo dpkg -i /tmp/packages-microsoft-prod.deb
    sudo apt-get update && sudo apt-get install -y powershell
EOF
else
  echo "  - Fedora packages: sudo dnf install -y curl tar file patchelf docker rpm-build rpm fakeroot dpkg dnf-plugins-core mingw64-nsis" >&2
  cat >&2 <<'EOF'
  - PowerShell:
    sudo dnf install -y dnf-plugins-core
    sudo dnf config-manager addrepo --from-repofile=https://packages.microsoft.com/config/fedora/$(rpm -E %fedora)/prod.repo
    sudo dnf install -y powershell
EOF
fi

exit 1
