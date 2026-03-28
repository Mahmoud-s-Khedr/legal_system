# 11 — Editions and Licensing

## Overview

ELMS uses an edition-based feature model to serve both individual practitioners and multi-user law firms across offline desktop and online cloud deployment targets. The edition system controls feature availability, seat limits, AI usage caps, and trial eligibility. Firm lifecycle state (ACTIVE, GRACE, SUSPENDED, PENDING_DELETION, DATA_DELETION_PENDING, LICENSED) is maintained by a nightly scheduler and enforced by global write guard middleware.

---

## Edition Tiers

Five editions are defined by the `EditionKey` enum:

### `solo_offline`

| Property | Value |
|---|---|
| Deployment | Desktop only |
| Users (seats) | 1 |
| Features | None of the online feature set |
| AI monthly limit | null (feature not available) |
| Trial | Enabled (30-day trial) |

Designed for a solo practitioner working entirely offline. No internet connectivity is assumed or required. Trial mode allows evaluation before purchase.

### `solo_online`

| Property | Value |
|---|---|
| Deployment | Cloud |
| Users (seats) | 1 |
| Features | All online features (email, SMS, WhatsApp notifications, Google Calendar sync, Google Vision OCR, AI research, cloud backup, online payments) |
| AI monthly limit | 500 messages/month |
| Trial | Disabled |

Single-user subscription with full online feature access.

### `local_firm_offline`

| Property | Value |
|---|---|
| Deployment | Desktop (LAN) |
| Users (seats) | Unlimited |
| Features | `multi_user` only |
| AI monthly limit | null (feature not available) |
| Trial | Disabled |

Multi-user firm running on a local network without internet. Seats are unlimited but none of the cloud-dependent features (AI, email, OCR, etc.) are available.

### `local_firm_online`

| Property | Value |
|---|---|
| Deployment | Cloud |
| Users (seats) | Unlimited |
| Features | `multi_user` + all online features |
| AI monthly limit | 2,000 messages/month |
| Trial | Disabled |

The standard multi-user subscription. Combines unlimited seats with the full cloud feature set and a higher AI usage cap.

### `enterprise`

| Property | Value |
|---|---|
| Deployment | Cloud |
| Users (seats) | Unlimited |
| Features | `multi_user` + all online features + `pwa_browser_access` |
| AI monthly limit | 0 (unlimited) |
| Trial | Disabled |

Enterprise adds Progressive Web App browser access and removes all AI usage restrictions. Intended for large firms with high research volume.

### Online Feature Set

The following features are available on all online-capable editions:

- `email_reminders`
- `sms_reminders`
- `whatsapp_notifications`
- `google_calendar_sync`
- `google_vision_ocr`
- `ai_research`
- `cloud_backup_sync`
- `payments_online`

`pwa_browser_access` is exclusive to `enterprise`. `multi_user` is available on all editions except `solo_offline` and `solo_online`.

---

## Firm Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> ACTIVE : Firm registered
    ACTIVE --> GRACE : trialEndsAt reached\n(trial editions only)\nDaily sweep at 02:05
    GRACE --> SUSPENDED : graceEndsAt reached\n(14 days after trial end)\nDaily sweep at 02:05
    SUSPENDED --> PENDING_DELETION : deletionDueAt reached\n(1 day after suspension)\nDaily sweep at 02:05
    PENDING_DELETION --> Deleted : deletedAt set\nnext sweep cycle

    note right of ACTIVE
        All features available
        All write operations permitted
    end note

    note right of GRACE
        Read-only mode
        Notifications sent
        No new creates
        Write guard → HTTP 423
    end note

    note right of SUSPENDED
        All writes blocked
        suspendedAt timestamp set
        Write guard → HTTP 423
    end note

    note right of PENDING_DELETION
        All writes blocked
        deletionDueAt set
        Soft deletion imminent
    end note
```

**Note:** The trial lifecycle only applies to editions with `trialEnabled: true`. Currently only `solo_offline` has trial enabled. All other editions start and remain ACTIVE until manually changed or subscription is cancelled.

### Lifecycle Timeline (Trial Edition — `solo_offline`)

```
Day 0  : Firm created → ACTIVE, trialStartedAt = createdAt
Day 30 : trialEndsAt reached → GRACE, 14-day grace period begins; orange blocking banner shown
Day 44 : graceEndsAt reached → DATA_DELETION_PENDING, deletionDueAt = now() + 24h
           TrialCountdownModal appears (full-screen, blocking); auto-export ZIP to OS Desktop begins
Day 45 : deletionDueAt reached → DELETED:
           1. DROP SCHEMA public CASCADE; CREATE SCHEMA public; (Prisma $executeRaw)
           2. rm -rf uploads directory
           3. Prisma connection pool reset
```

Alternatively, if the user enters a valid license key at any point:
```
ANY_STATE → LICENSED (activateLicense endpoint)
```

All date fields (`trialStartedAt`, `trialEndsAt`, `graceEndsAt`, `deletionDueAt`) are lazily computed on first sweep if not already set on the firm record.

---

## Lifecycle Scheduler

The scheduler runs at **02:05 daily** (`cron: "5 2 * * *"`), calling `runFirmLifecycleSweep()`:

1. Load all non-deleted firms from the database
2. For each firm: skip if `trialEnabled` is false for the edition
3. Compute missing date fields (lazy initialisation)
4. Apply state transitions in order: ACTIVE → GRACE → SUSPENDED → PENDING_DELETION → soft-deleted
5. Write only fields that changed (`patch` object accumulation)

The sweep returns a `LifecycleSweepResult` with counts for each transition type, written to the server log.

Desktop mode uses `node-cron`; cloud mode uses a BullMQ repeating job on the `edition-lifecycle-scan` queue.

---

## Feature Gating Middleware

### `requireEditionFeature`

Route-level middleware (`middleware/requireEditionFeature.ts`) reads the actor's `editionKey` from the session and calls `hasEditionFeature(editionKey, feature)`. Returns HTTP 403 if the feature is not in the edition's feature set.

Example: all research routes are guarded with `requireEditionFeature("ai_research")`.

### Seat Limit Enforcement

`assertCanCreateLocalUser()` and `assertCanCreateInvitation()` in `editionPolicy.ts` count active users and pending invitations against the edition's `seatLimit`. Editions with `seatLimit: null` have unlimited seats. Exceeding the limit throws HTTP 403.

### `firmLifecycleWriteGuard`

A global `preHandler` hook registered on the Fastify instance. It intercepts all write methods (POST, PUT, PATCH, DELETE) and returns **HTTP 423 Locked** if the firm's `lifecycleStatus` is `SUSPENDED` or `PENDING_DELETION`:

```typescript
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const BLOCKED_STATUSES = new Set([
  FirmLifecycleStatus.SUSPENDED,
  FirmLifecycleStatus.PENDING_DELETION
]);
```

The only exempt write path is `POST /api/auth/logout`. This ensures users can always sign out even when their firm account is blocked.

GRACE status does **not** block writes at the middleware level. However, the scheduler transitions GRACE to SUSPENDED after 14 days, at which point writes are blocked.

---

## RSA Trial Integrity & License Activation (Phase 6A)

### Trial Tamper Detection

The `solo_offline` trial generates a signed integrity file at first launch:

```
~/.local/share/com.elms.desktop/trial.json
```

Content:

```json
{
  "firmId": "uuid",
  "trialStartedAt": "2026-01-01T00:00:00Z",
  "signature": "<RSA-SHA256-signature-over-payload>"
}
```

On every Tauri startup, `lifecycle.service.ts` calls `verifyTrialJson(firmId)`:
1. Read `trial.json` from the app data directory
2. Reconstruct the signed payload `{firmId, trialStartedAt}`
3. Verify the RSA-SHA256 signature using the public key embedded in the Tauri binary at build time (`apps/desktop/src-tauri/resources/elms_pub.pem`)
4. If missing or invalid → immediately transition firm to `GRACE`

The public key is embedded at build time — never fetched at runtime. The private key is held exclusively by the vendor.

### License Key Activation

Users purchase a license via the ELMS payment page (opened in the system browser via `Tauri open()`, NOT in the Tauri webview). A license key is emailed after payment.

`activateLicense(firmId, licenseKey)` in `lifecycle.service.ts`:

1. Base64-decode the license key
2. Parse the JSON payload `{ firmId, editionKey, expiresAt, firmName }`
3. Verify RSA-SHA256 signature against the embedded public key
4. Assert `payload.firmId === firmId` and `expiresAt > now()`
5. Hash the key with SHA-256 and store in `FirmSettings.licenseKeyHash`
6. Set `FirmSettings.licenseActivatedAt = now()`
7. Transition `Firm.lifecycleStatus → LICENSED`

A `LICENSED` firm is not subject to the trial scheduler sweep.

### LAN License Grace Mode (Phase 15)

`local_firm_offline` and `local_firm_online` editions use the signed license file for validation.
On license expiry (`expiresAt` in the past):

- Firm transitions to `GRACE` (30-day read-only window)
- `licenseGraceGuard` middleware intercepts all non-GET requests and returns:
  ```json
  HTTP 403
  { "code": "LICENSE_GRACE", "message": "License expired — read-only mode active" }
  ```
- Frontend detects `LICENSE_GRACE` and:
  - Shows persistent orange banner with days remaining
  - Disables all Create / Edit / Delete buttons with tooltip "Renew license to enable"
- After 30 days: transition to `SUSPENDED` (existing write guard → HTTP 423)

`licenseGraceGuard` is applied after `requireAuth` in the Fastify plugin chain. The only exempt paths are `GET *` and `POST /api/auth/logout`.

---

## Desktop License

### License Format

The license is an RSA-2048 signed JSON payload:

```json
{
  "firmId": "uuid",
  "editionKey": "solo_offline",
  "expiresAt": "2027-01-01T00:00:00Z",
  "firmName": "Example Law Firm"
}
```

The payload is signed using PKCS#1v15 with SHA-256. The signature covers the canonical JSON representation of the payload.

### License File Location

```
~/.local/share/com.elms.desktop/elms.license
```

### Validation

Desktop startup no longer validates this file as part of the Rust bootstrap path. The signed file format remains relevant for backend licensing and commercial fulfillment flows, but the desktop shell now launches without requiring `elms.license` to be present locally.

### License Generation

Licenses are generated using `scripts/generate-license.ts`, which requires the private key (held exclusively by the vendor). The private key is never distributed with the application.

```bash
# Vendor-side only:
DESKTOP_LICENSE_PRIVATE_KEY=<base64-private-key> \
  tsx scripts/generate-license.ts \
  --firmId <uuid> \
  --editionKey solo_offline \
  --expiresAt 2027-01-01
```

The resulting license file can still be delivered to the customer for licensing workflows, but it is not required for the application to boot.

---

## Desktop Release Distribution

Desktop releases are currently distributed as full installers only. Linux, Windows, and macOS release workflows build installer artifacts and publish those artifacts directly; the Tauri updater plugin and OTA manifest flow are not part of the active release train.

---

## Business Model Summary

| Model | Edition | Pricing |
|---|---|---|
| Desktop perpetual license | `solo_offline`, `local_firm_offline` | One-time purchase, time-limited license artifact, installer-based upgrades |
| Cloud subscription | `solo_online`, `local_firm_online`, `enterprise` | Monthly/annual SaaS, lifecycle managed by ELMS scheduler |

Cloud subscriptions use the lifecycle state machine for trial, grace, and suspension. Desktop perpetual licenses still rely on licensing metadata, but desktop startup is no longer gated by a local license-file check.

---

## Related Documents

- [01 — System Overview](./01-system-overview.md) — deployment targets
- [10 — Notification System](./10-notification-system.md) — email/SMS reminders gated by edition features
- [08 — AI Research Pipeline](./08-ai-research-pipeline.md) — `ai_research` feature gate and `aiMonthlyLimit`
- [12 — CI/CD Pipeline](./12-cicd-pipeline.md) — installer build workflows and remaining signing secrets

## Source of truth

- `docs/_inventory/source-of-truth.md`

