# Product Roadmap

## Completed: v1.0 (Phases 1–7)

All core features are production-ready as of March 2026. The platform was built in seven sequential phases, each adding a cohesive layer of functionality.

| Phase | Focus | Key Deliverables | Status |
|-------|-------|-----------------|--------|
| **1** | Foundation | Multi-tenant auth, JWT security, firm onboarding, invite-based team management | ✅ Complete |
| **2** | Access Control | RBAC with 5 system roles, 69 permissions, custom role builder | ✅ Complete |
| **3** | Case & Client Management | Client (individual/company/government), case lifecycle, multi-court tracking, assignments, parties, status history | ✅ Complete |
| **4** | Hearings & Tasks | Court session scheduling, session outcomes, task management with priorities and assignments | ✅ Complete |
| **5** | Documents & Billing | Document upload + OCR + full-text search, invoice lifecycle, payment recording, expense tracking, multi-channel notifications, automated reminders | ✅ Complete |
| **6** | Law Library | Hierarchical legal taxonomy, legislation articles, library documents, personal annotations, case-legal references, library search | ✅ Complete |
| **7** | AI Research | Claude AI chat assistant, retrieval-augmented generation from firm library, SSE streaming, citation chips, monthly usage limits | ✅ Complete |

---

## Planned: Phases 6–17 (Post-Launch Feature Completion)

These phases cover all 🚫-marked features in `NeededFeaturesList.md`. Phases 6–11 and 15–16 have
zero external API dependencies and can be started immediately. Phases 12–14 require external API
access. Phase 17 is blocked on Egyptian government API availability.

### Phase 6 — Foundation: Security, Trial System & Core Fixes

**Effort:** 3–4 weeks | **External deps:** None

| Sub-phase | Deliverables |
|-----------|-------------|
| 6A — Trial System | `DATA_DELETION_PENDING` state, 24h countdown modal, auto-export ZIP to OS Desktop, data deletion on expiry, RSA-signed `trial.json` tamper detection, license key activation |
| 6B — AES-256 + Read Audit | Per-firm field-level AES-256-GCM encryption for national IDs and financial data; immutable read audit log (Law No. 151/2020) |
| 6C — Tawkeel Enforcement | Per-type metadata enforcement (General, Special, Commercial); `PoaStatus` enum; revocation lock guard across documents, billing, and hearings |
| 6D — Conflict Checks | Cross-reference opposing parties against client database on case party add and new client intake; dismissible conflict warning banner |
| 6E — Kanban + Digest | RTL-aware 4-column Kanban board (`@dnd-kit`); daily 08:00 overdue task digest notification |
| 6F — French Templates | French-language versions of all system document templates |

---

### Phase 7 — Billing Completeness

**Effort:** 3 weeks | **External deps:** None

| Sub-phase | Deliverables |
|-----------|-------------|
| 7A — New Fee Structures | Seed `FeeType` lookup: `BLENDED`, `SUCCESS_FEE`, `MILESTONE`; retainer auto-scheduling; contingency trigger on case WON; appearance fee on session outcome |
| 7B — Cheques + Installments | `ChequePayment` model (`ChequeStatus` enum); `InstallmentPlan` + `InstallmentPayment` models; maturity date alert jobs |
| 7C — VAT Engine | `VatType` enum; 14% standard + reverse charge + simplified regime; input VAT tracker; quarterly VAT report; Law 157/2025 advisory for real estate |

---

### Phase 8 — Arabic Search, Session Enhancements & Stamp Fees

**Effort:** 2 weeks | **External deps:** None (pg_trgm is a built-in PostgreSQL extension)

| Sub-phase | Deliverables |
|-----------|-------------|
| 8A — Arabic pg_trgm Search | `pg_trgm` extension; diacritics-stripped generated column; GIN index; trigram similarity search for client names |
| 8B — Session Enhancements | `isRemote`, `videoLink`, `videoCredentials` fields; lawyer session conflict detection (±30 min); Khobara referral auto-task generation |
| 8C — Stamp Fees | `BAR_STAMP_FEE` and `COURT_FILING_FEE` lookup seeds; `stampFeeAmount` on Document; inline stamp fee recording after upload |

---

### Phase 9 — Company Formation Module

**Effort:** 2 weeks | **External deps:** None (GAFI API integration = Phase 12+)

New module at `packages/backend/src/modules/company-formation/`.

**Deliverables:**
- `CompanyFormation`, `FormationFeeItem`, `FormationStatusHistory` models
- `CompanyType` and `FormationStatus` enums; `FormationFeeCategory` lookup entity
- JSC blocked deposit validation (≥ 10% of capital, min 25,000 EGP)
- Golden License (Investment Law 160/2023) eligibility flagging
- Stepper UI matching formation status; commercial register renewal alerts

---

### Phase 10 — Client Portal Completion + PWA Conflict Resolution

**Effort:** 2 weeks | **External deps:** None

| Sub-phase | Deliverables |
|-----------|-------------|
| 10A — Portal Features | `AppointmentRequest` model; appointment form → auto-creates Task for admin; ETA invoice download (stub, gated on `eta_einvoice` edition feature) |
| 10B — PWA Conflicts | `ConflictResolutionModal.tsx` — side-by-side diff of local vs server version when Background Sync replay returns 409 |

---

### Phase 11 — Reports Completion + Settings Additions

**Effort:** 1.5 weeks | **External deps:** None

**New reports (additive SQL on existing data):**
- Hearing outcomes trend (monthly `GROUP BY outcome`)
- VAT quarterly report (output VAT, input VAT, net payable)
- ETA submission log (stub until Phase 12)
- Tawkeel status report (count by `PoaStatus` per type)
- Bar Association stamp fee expenditure report

**Settings UI additions:**
- ETA adapter configuration (middleware vs HSM) in `SettingsPage.tsx`
- License key input (desktop editions only)

---

### Phase 12 — ETA e-Invoicing Pipeline

**Effort:** 4–5 weeks | **External deps:** Egyptian Tax Authority API + Paymob/Fawateer middleware or HSM device

New module at `packages/backend/src/modules/billing/eta/`.

**Deliverables:**
- `IETAAdapter` interface with `MiddlewareETAAdapter` and `HsmETAAdapter` implementations
- `etaInvoice.builder.ts` — maps Invoice + Client + FirmSettings → ETA JSON
- BullMQ queue + worker with 3-retry logic; `etaUuid`/`etaStatus` stored on Invoice
- B2C e-receipt via separate POS-style ETA endpoint
- `ETA_SUBMISSION_CONFIRMATION` and `ETA_SUBMISSION_FAILED` notification types

---

### Phase 13 — WhatsApp Business API Channel

**Effort:** 1 week code + Meta Business approval time | **External deps:** Meta WhatsApp Business API

**Deliverables:**
- `WHATSAPP` notification channel; `whatsapp.ts` channel implementation (Meta Cloud API v18)
- `whatsappNumber` field on Client
- `COURT_ROLL_UPDATE` and `PORTAL_ACTIVITY` notification types
- WhatsApp config section in SettingsPage; opt-in in NotificationPreferencesPage

---

### Phase 14 — VLM Handwritten OCR + AI Document Analysis

**Effort:** 1 week | **External deps:** OpenAI API or Google Gemini API

**Deliverables:**
- `VlmOcrAdapter` implementing `IOcrAdapter` — GPT-4o Vision or Gemini 1.5 Pro
- `VLM` added to `OcrBackend` enum; desktop falls back to Tesseract with notice
- `POST /api/research/analyze-document` endpoint — VLM extraction → Anthropic one-shot analysis
- "Analyze Handwritten Document" button in DocumentUploadPage; "Analyze Document" tab in ResearchPage

---

### Phase 15 — LAN License Enforcement + RSA Offline Validation

**Effort:** 1 week | **External deps:** None

**Deliverables:**
- `license.service.ts` — RSA-SHA256 verification against embedded public key (`elms_pub.pem`)
- `licenseGraceGuard` middleware — 403 `{ code: 'LICENSE_GRACE' }` for all non-GET requests in grace
- `LICENSED` and `DATA_DELETION_PENDING` `FirmLifecycleStatus` values
- Persistent orange grace banner; mutation buttons disabled with tooltip

---

### Phase 16 — International Tawkeel Authentication Chain

**Effort:** 1 week | **External deps:** None (Digital Egypt API = stub)

**Deliverables:**
- `TawkeelAuthStep` enum; `TawkeelAuthChainStep` model (Foreign Notary → Egyptian Consulate → MoFA)
- `assertInternationalPoaChainComplete()` guard before setting ACTIVE on foreign-client POA
- 3-step checklist UI in PowerCreatePage with document upload slots
- "Book via Digital Egypt" button opens system browser (integration stub)

---

### Phase 17 — MoJ / State Council Portal Integration

**Effort:** Preparatory stubs only | **External deps:** Egyptian government API (not yet available)

**Deliverables:**
- `courtRollUpdateSource` field on `CaseSession` (`"MANUAL" | "MOJ_PORTAL" | "ESC_PORTAL"`)
- `IMojAdapter` stub interface + `MojAdapterStub` returning empty results
- `COURT_ROLL_UPDATE` notification type (if not added in Phase 13)
- Full implementation proceeds when government API access is granted

---

## Roadmap Summary

```
2026 Q1 ─── v1.0 Launch (Phases 1–7 complete)
              │
              ├── Phase 6:  Security, trial, Tawkeel, conflict, Kanban, French  (3–4 wks)
              ├── Phase 7:  Billing completeness — fees, cheques, VAT           (3 wks)
              │
2026 Q2 ─────┤
              ├── Phase 8:  Arabic search, sessions, stamp fees                  (2 wks)
              ├── Phase 9:  Company formation module                             (2 wks)
              ├── Phase 10: Client portal + PWA conflict resolution              (2 wks)
              ├── Phase 11: Reports + settings                                   (1.5 wks)
              │
2026 Q3 ─────┤
              ├── Phase 12: ETA e-invoicing pipeline                            (4–5 wks)
              ├── Phase 13: WhatsApp Business API                               (1 wk + approval)
              ├── Phase 14: VLM handwritten OCR + AI doc analysis               (1 wk)
              │
2026 Q3–Q4 ──┤
              ├── Phase 15: LAN license enforcement                             (1 wk)
              ├── Phase 16: International Tawkeel auth chain                    (1 wk)
              └── Phase 17: MoJ/State Council stubs                             (future)
```

**Total self-contained work (Phases 6–11, 15–16):** ~17–19 weeks
**Total including external integrations (Phases 12–14):** ~23–25 weeks + Meta approval time

---

## Additional Post-Launch Features (Previously Planned)

These items from the original post-launch plan remain valid and can be scheduled after the feature
completion phases above:

- **Egyptian Official Gazette Monitoring** — automated scraping → Law Library ingestion + alerts
- **Bidirectional Google Calendar Sync** — webhook listener for rescheduled hearings
- **Advanced Report Builder** — drag-and-drop visual report builder on `CustomReport` model
- **Bulk Data Import Improvements** — duplicate detection, per-row error reporting, competitor migration
- **External API Access** — API key auth, per-key scoping, usage dashboard
- **Mobile App** — Tauri Mobile native shells for iOS/Android
