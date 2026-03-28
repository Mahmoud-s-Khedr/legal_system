# Internet-Required Features

This document lists only **currently implemented** ELMS features that require internet access or externally hosted services.

## Methodology

Include a feature here only if all of the following are true:

- It is currently implemented in the codebase.
- It is user-facing or operator-visible.
- It depends on external network access beyond local desktop `localhost` operation.

Do not include:

- Roadmap or wishlist items from product planning docs
- Internal observability or deployment concerns such as Sentry
- Generic statements like "cloud mode needs a network" unless a specific feature depends on an external service

## Implemented Features

| Feature | Status | Why internet is required | External dependency/service | Evidence | Offline behavior / fallback |
|---|---|---|---|---|---|
| AI Research assistant | Implemented | Research responses are streamed from an external LLM provider. | Anthropic Claude API | Code: `packages/backend/src/modules/research/ai.provider.ts`, `packages/backend/src/modules/research/research.service.ts`.<br>Docs: `README.md`, `docs/architecture/08-ai-research-pipeline.md`, `docs/dev/03-environment-variables.md` (`ANTHROPIC_API_KEY`) | Desktop troubleshooting explicitly says AI Research is unavailable offline until connected. |
| Premium OCR with Google Vision | Implemented | OCR requests are sent to Google's hosted Vision API when `OCR_BACKEND=google_vision`. | Google Cloud Vision API | Code: `packages/backend/src/modules/documents/ocr/GoogleVisionAdapter.ts`, `packages/backend/src/modules/documents/documents.service.ts`.<br>Docs: `README.md`, `docs/architecture/01-system-overview.md`, `docs/dev/03-environment-variables.md` (`GOOGLE_VISION_API_KEY`) | Local OCR remains available through Tesseract when `OCR_BACKEND=tesseract`; only the Google Vision path requires internet. |
| Google Calendar hearing sync | Implemented | OAuth, token exchange, token refresh, revoke, and event upserts all call Google endpoints. | Google OAuth 2.0 and Google Calendar API | Code: `packages/backend/src/modules/integrations/googleCalendar.service.ts`, `packages/backend/src/modules/integrations/google-calendar.routes.ts`.<br>Docs: `README.md`, `docs/user/core-workflows/07-hearings-and-calendar.md`, `docs/dev/03-environment-variables.md` (Google OAuth vars) | Desktop troubleshooting says hearings are still saved locally offline and sync resumes automatically when connected. |
| Email-backed notification and invite delivery | Implemented | Outbound messages require an SMTP server reachable over the network. This covers email notifications and operational email delivery such as staff invitations and portal invitation flows. | SMTP relay/provider | Code: `packages/backend/src/modules/notifications/channels/email.ts`, `packages/backend/src/modules/notifications/notification.service.ts`, `packages/backend/src/modules/invitations/invitations.service.ts`, `packages/backend/src/modules/portal/portal-auth.routes.ts`.<br>Docs: `README.md`, `docs/architecture/10-notification-system.md`, `docs/dev/03-environment-variables.md` (SMTP vars), `docs/user/getting-started/03-first-time-setup.md`, `docs/user/core-workflows/05-managing-clients.md` | If SMTP is not configured, the email channel is skipped. Current portal invite code can still return a raw invite token/URL for manual delivery by the caller instead of sending email directly. |
| SMS notifications | Implemented | SMS dispatch calls Twilio's hosted API. | Twilio | Code: `packages/backend/src/modules/notifications/channels/sms.ts`, `packages/backend/src/modules/notifications/notification.service.ts`.<br>Docs: `README.md`, `docs/architecture/10-notification-system.md`, `docs/dev/03-environment-variables.md` (`SMS_PROVIDER`, Twilio creds) | If `SMS_PROVIDER` is not `twilio` or credentials are missing, SMS is skipped; other channels can still deliver notifications. |
| Cloud document storage with signed downloads | Implemented | File upload, retrieval, deletion, and signed URL generation use Cloudflare's hosted object storage API when `STORAGE_DRIVER=r2`. | Cloudflare R2 | Code: `packages/backend/src/storage/R2StorageAdapter.ts`, `packages/backend/src/storage/index.ts`, `packages/backend/src/modules/documents/documents.service.ts`.<br>Docs: `README.md`, `docs/architecture/01-system-overview.md`, `docs/architecture/07-document-pipeline.md`, `docs/dev/03-environment-variables.md` (R2 vars) | Local filesystem storage remains available when `STORAGE_DRIVER=local`; only the R2-backed mode requires internet. |

## Intentional Exclusions

- Planned integrations in `NeededFeaturesList.md` such as MoJ portals, WhatsApp, ETA, Digital Egypt, and VLM OCR are not included because they are not currently implemented.
- Sentry is not included because it is an internal observability concern, not a product feature.
- Desktop-local capabilities that run against the embedded backend and database on `localhost` are not included because they do not require external internet access.
- The client portal itself is not listed as a separate internet-required feature here; the runtime dependency captured in this inventory is email-backed invitation delivery, while the portal application surface is a deployment/access mode rather than a distinct external service integration.

## Related References

- `docs/user/troubleshooting/23-desktop-connectivity.md`
- `docs/architecture/01-system-overview.md`
- `docs/architecture/08-ai-research-pipeline.md`
- `docs/architecture/10-notification-system.md`
- `docs/dev/03-environment-variables.md`

## Source of truth

- `docs/_inventory/source-of-truth.md`

