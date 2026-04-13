# Linux Packaging Fedora Follow-up

Date: 2026-04-13

## Context

The immediate CI hotfix is in `scripts/verify-linux-packages.sh` (UID/GID fallback for container smoke tests).  
This note tracks Fedora-local issues observed during reproduction that are **not** blockers for the CI UID fix.

## Repro Findings

1. Fedora-built PostgreSQL bundle fails Ubuntu `.deb` smoke:
- Command:
  - `VERIFY_LINUX_BUNDLES=deb bash scripts/verify-linux-packages.sh`
- Observed:
  - `Bundled postgres has unresolved shared libraries`
  - `libc.so.6: version 'GLIBC_ABI_GNU2_TLS' not found`
  - Multiple unresolved libs (`libeconf.so.0`, `libkrb5.so.3`, `libevent-2.1.so.7`, `libsasl2.so.3`, `libicudata.so.77`, ...)
- Interpretation:
  - Fedora-host bundled runtime libs are not ABI-compatible with Ubuntu 24.04 verification container.

2. Local `deb,rpm` packaging run can terminate with SIGTERM near RPM bundling:
- Command:
  - `DESKTOP_BUNDLES=deb,rpm pnpm --filter @elms/desktop package:linux`
- Observed in `.logs/desktop-linux-package-deb--rpm.log`:
  - `Bundling ELMS-0.1.0-1.x86_64.rpm ...`
  - Then `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL ... Command failed with signal "SIGTERM"`
  - Log still reports both bundle output paths at end.

## Follow-up Actions

1. Define supported local host matrix for Linux packaging verification:
- Prefer Ubuntu host for `.deb` verification parity with CI (`ubuntu-latest`).
- Treat Fedora-local `.deb` verification as unsupported unless compatibility layer is added.

2. Stabilize rpm local packaging behavior on Fedora:
- Re-run with verbose Tauri/RPM logs and capture parent process sending SIGTERM.
- Verify whether timeout, wrapper signal handling, or rpmbuild subprocess lifecycle is the trigger.

3. Documentation update after investigation:
- Add explicit host expectations and known limitations in `docs/dev/11-desktop-build.md`.
