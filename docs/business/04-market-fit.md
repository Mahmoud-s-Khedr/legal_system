# ELMS — Product/Workflow Fit (Code-Truth Framing)

This document is constrained to repository-verifiable workflow coverage.

## Covered workflow areas in implementation

- Intake and client records
- Case lifecycle and court/session tracking
- Task management and reminders
- Document upload, extraction, and search
- Billing and expense management
- Notifications and report generation
- Role-based team administration

## Delivery fit by topology

- Cloud: multi-firm runtime with web stack and optional cloud integrations.
- Desktop: local runtime with offline-capable local deployment path.

## Out of scope in this code-truth version

- TAM/SAM/SOM estimates
- Pricing strategy narrative
- Competitive demand claims

## Source of truth

- `packages/backend/src/modules/**`
- `packages/frontend/src/router.tsx`
- `archive/cloud/apps/web/docker-compose*.yml`
- `apps/desktop/src-tauri/tauri.conf.json`
