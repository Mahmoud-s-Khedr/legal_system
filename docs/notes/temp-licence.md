# Context

User requested a review of the licensing system — how keys are generated, how users activate licenses, and how the system enforces access. This is a read-only review/documentation task, not a code change.

---

## Licensing System Overview

### Key Generation (Vendor Side)

**Script:** `scripts/generate-license.ts`

- Algorithm: RSA-2048 + PKCS#1v15 + SHA-256
- Payload: `{ firm, slug, issuedAt, expiresAt, features: ["core"] }`
- Output: JSON file → `<base64_payload>.<base64_signature>`
- CLI flags: `--firm`, `--slug`, `--expires`, `--private-key`, `--out`
- If no private key provided → generates fresh key pair and prints public key for embedding

### User Activation Flow

1. User opens **Settings** page (`packages/frontend/src/routes/app/SettingsPage.tsx`)
2. User pastes activation key into form
3. Frontend calls `POST /api/licenses/activate` with `{ activationKey: string }`
4. Backend (`packages/backend/src/modules/editions/license.service.ts`):
   - Splits key on last `.` → payload + signature
   - Verifies RSA-SHA256 signature against public key (env: `DESKTOP_LICENSE_PUBLIC_KEY`)
   - Validates: firmId match, edition in self-serve set, expiresAt > now
   - Stores SHA-256 hash in `FirmSettings.licenseKeyHash`
   - Transitions `Firm.lifecycleStatus` → `LICENSED`
   - Records `licenseActivatedAt`
5. Frontend: clears form, refreshes session, shows "License Active" banner

### Access Guard Middleware

**File:** `packages/backend/src/middleware/licenseAccessGuard.ts`

- `LICENSED` firms → full access
- Trial-eligible editions (`solo_offline`) → allowed during trial window
- All others → HTTP 403 `LICENSE_REQUIRED` (except allowlisted settings routes)

### Edition Tiers

| Edition | Seats | Trial | Key Features |
|---|---|---|---|
| `solo_offline` | 1 | Yes (30 days) | Desktop only |
| `solo_online` | 1 | No | 500 AI/mo, cloud sync |
| `local_firm_offline` | Unlimited | No | Multi-user |
| `local_firm_online` | Unlimited | No | 2000 AI/mo, all features |
| `enterprise` | Unlimited | No | Custom (no self-serve) |

### Trial Lifecycle (Daily 02:05 UTC sweep)

```
ACTIVE → GRACE (trial ends) → SUSPENDED (grace ends +14d) → DATA_DELETION_PENDING (+24h) → PENDING_DELETION (soft deleted)
```

LICENSED status bypasses the entire lifecycle sweep.

### Feature Gating

**File:** `packages/backend/src/middleware/requireEditionFeature.ts`

Route-level: `requireEditionFeature("ai_research")` etc. Returns HTTP 403 if edition lacks the feature.

### Critical Files

- `scripts/generate-license.ts` — key generation
- `packages/backend/src/modules/editions/license.service.ts` — validation & activation
- `packages/backend/src/modules/editions/editionPolicy.ts` — edition capabilities
- `packages/backend/src/middleware/licenseAccessGuard.ts` — access enforcement
- `packages/backend/src/middleware/requireEditionFeature.ts` — feature gating
- `packages/backend/src/modules/editions/lifecycle.service.ts` — trial state machine
- `packages/backend/src/modules/editions/trialDates.ts` — timeline constants
- `packages/frontend/src/routes/app/SettingsPage.tsx` — activation UI
- `packages/shared/src/dtos/firms.ts` — shared DTOs
- `docs/architecture/11-editions-and-licensing.md` — full architecture doc

---------------------------------------------

Here's the full breakdown of the licensing system:

License Key Generation (Vendor Side)
Script: scripts/generate-license.ts

Algorithm: RSA-2048 + PKCS#1v15 + SHA-256 signature
Key format: <base64_payload>.<base64_signature> (split on last .)
Payload: { firm, slug, issuedAt, expiresAt, features: ["core"] }
CLI usage:

ts-node generate-license.ts \
  --firm "Acme Law" \
  --slug "acme-law" \
  --expires "2027-01-01" \
  --private-key ./private.pem \
  --out ./acme.license
If no --private-key is provided, a fresh RSA-2048 key pair is generated and the public key is printed for embedding.
User Activation Flow
User goes to Settings → pastes activation key
Frontend calls POST /api/licenses/activate with { activationKey: string }
Backend (license.service.ts):
Splits key on last . → payload + signature
Verifies RSA-SHA256 signature against public key (env var: DESKTOP_LICENSE_PUBLIC_KEY)
Validates: firmId match, edition in self-serve set, expiresAt > now
Stores SHA-256 hash in FirmSettings.licenseKeyHash
Transitions Firm.lifecycleStatus → LICENSED
Records licenseActivatedAt timestamp
Returns { editionKey, expiresAt, firmName, status: "activated" | "already_activated" }
Activation errors:

Code	Meaning
LICENSE_INVALID	Bad signature or malformed key
LICENSE_FIRM_MISMATCH	Key is for a different firm
LICENSE_EDITION_MISMATCH	Edition can't be self-served
LICENSE_EXPIRED	Key past its expiresAt date
How the System Enforces Access
1. License Access Guard (licenseAccessGuard.ts)
Pre-handler hook on every request:

lifecycleStatus === LICENSED → full access
Edition has trial enabled + trial still active → allowed
Anything else → HTTP 403 LICENSE_REQUIRED
Only a small allowlist of settings/auth routes bypass this guard.

2. Feature Gating (requireEditionFeature.ts)
Route-level middleware: requireEditionFeature("ai_research") etc. Returns HTTP 403 if the firm's edition doesn't include that feature.

3. Write Guard (firmLifecycleWriteGuard.ts)
Blocks all POST/PUT/PATCH/DELETE for SUSPENDED or PENDING_DELETION firms with HTTP 423.

Edition Tiers
Edition	Seats	Trial	AI Limit	Notable Features
solo_offline	1	30 days	None	Desktop only
solo_online	1	No	500/mo	Cloud sync, PWA
local_firm_offline	Unlimited	No	None	Multi-user
local_firm_online	Unlimited	No	2000/mo	All features
enterprise	Unlimited	No	Custom	No self-serve activation
Defined in editionPolicy.ts.

Trial Lifecycle (for solo_offline)
A daily cron at 02:05 UTC sweeps all firms and advances state:


ACTIVE ──(trial ends)──► GRACE ──(+14 days)──► SUSPENDED ──(+24h)──► DATA_DELETION_PENDING ──► PENDING_DELETION
LICENSED firms are skipped entirely from this sweep
Trial = 30 days, Grace = 14 days, then soft-deleted
Key Files Summary
File	Purpose
scripts/generate-license.ts	Key generation (vendor tool)
packages/backend/src/modules/editions/license.service.ts	Decode, verify, activate
packages/backend/src/modules/editions/editionPolicy.ts	Edition capabilities
packages/backend/src/middleware/licenseAccessGuard.ts	Global access enforcement
packages/backend/src/middleware/requireEditionFeature.ts	Per-route feature gating
packages/backend/src/modules/editions/lifecycle.service.ts	Trial state machine
packages/frontend/src/routes/app/SettingsPage.tsx	Activation UI
docs/architecture/11-editions-and-licensing.md	Full architecture doc
Claude’s Plan gentle-painting-brook.md
User approved the plan
This was a pure review — no code changes needed. The licensing system is well-structured and complete. Let me know if you want to dig deeper into any specific part (e.g., the key generation script itself, adding a new edition tier, or how to handle enterprise licensing).

