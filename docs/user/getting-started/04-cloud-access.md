# Cloud Access

## Status

- `Implemented`: Desktop/local runtime remains the active production path.
- `Archived Reference`: Older cloud-access and PWA guidance.
- `Planned`: Updated cloud user-access guide after cloud runtime is re-enabled.

As of May 18, 2026, cloud auth/runtime is non-operational in backend startup behavior; cloud docs here are retained as reference only.

## Archived Reference

This section is preserved for future cloud rollout work and historical context:

- Browser access and login flow examples for hosted ELMS URLs.
- PWA installation steps for desktop/mobile browsers.
- Session behavior notes for cloud browser workflows.

Do not treat this page as current operational setup guidance.

## Current operational guidance

Use desktop/local workflows instead:

- [Desktop Installation](./02-desktop-installation.md)
- [First-Time Setup](./03-first-time-setup.md)
- [Desktop Connectivity](../troubleshooting/23-desktop-connectivity.md)

## Planned

When cloud runtime is re-enabled, this page will be replaced with verified cloud onboarding, login, and session guidance tied to active code paths.

## Source of truth

- `packages/backend/src/config/env.ts`
- `packages/backend/src/modules/auth/createAuthService.ts`
- `packages/frontend/src/router.tsx`
