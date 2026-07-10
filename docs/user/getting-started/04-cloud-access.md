# Cloud Access

## Status

- `Implemented`: Hosted browser runtime for controlled SaaS / paid-beta access.
- `Implemented`: Desktop/local runtime remains supported for packaged deployments.
- `Archived Reference`: Older cloud-access and PWA guidance that does not match the current hosted beta rollout.

As of June 30, 2026, hosted browser access is operational for controlled deployments. The hosted rollout currently assumes manual firm onboarding, manual billing, and operator-managed support.

## Current hosted guidance

Hosted firms access ELMS through their deployment URL provided by the operator.

- Sign in through the standard browser login page.
- Registration is available only when the hosted deployment exposes firm self-registration.
- Billing and subscription changes for the hosted beta are handled manually by the operator.
- If your firm cannot sign in or your invitation has expired, contact the deployment operator rather than using desktop recovery steps.

## Desktop guidance

Use desktop/local workflows only for packaged local deployments:

- [Desktop Installation](./02-desktop-installation.md)
- [First-Time Setup](./03-first-time-setup.md)
- [Desktop Connectivity](../troubleshooting/23-desktop-connectivity.md)

## Source of truth

- `packages/backend/src/config/env.ts`
- `packages/backend/src/modules/auth/createAuthService.ts`
- `packages/frontend/src/router.tsx`
