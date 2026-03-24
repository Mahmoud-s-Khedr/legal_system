# ELMS — Feature Matrix

**Platform Version:** 0.1.0
**Status Date:** March 2026
**Phases Complete:** 1–7 (Production-Ready)

---

## Feature Status by Phase

### Phase 1 & 2 — Foundation and Access Control

| Feature | Status |
|---|---|
| Multi-tenant architecture (data isolation per firm) | Complete |
| JWT RS256 asymmetric authentication | Complete |
| Cloud authentication mode (email + password) | Complete |
| Local/offline authentication mode (desktop) | Complete |
| Invite-based user onboarding | Complete |
| 5 built-in system roles: firm_admin, senior_lawyer, junior_lawyer, paralegal, secretary | Complete |
| Custom roles per firm | Complete |
| 69 granular permissions | Complete |
| Permission assignment to roles | Complete |
| Firm settings: timezone, currency, preferred language | Complete |
| User management: invite, suspend, change role | Complete |
| Password reset flow | Complete |
| Session management | Complete |

**Phase 1–2 Feature Count:** 13 features

---

### Phase 3 — Case and Client Management

| Feature | Status |
|---|---|
| Client records: Individual type | Complete |
| Client records: Company type | Complete |
| Client records: Government type | Complete |
| Client contact management | Complete |
| Client portal access (clients log in to view their cases) | Complete |
| Case management with case number and judicial year | Complete |
| Court assignment per case | Complete |
| Multi-stage court tracking | Complete |
| Case statuses: ACTIVE, SUSPENDED, CLOSED, WON, LOST, SETTLED, ARCHIVED | Complete |
| Case assignments with roles: LEAD, SUPPORTING, PARALEGAL, CONSULTANT | Complete |
| Case parties: plaintiffs, defendants, opposing counsel | Complete |
| Case status history (full audit trail of status changes) | Complete |
| Power of Attorney tracking: GENERAL, SPECIAL, LITIGATION types | Complete |
| Configurable lookup tables (court names, case types, and other dropdowns) | Complete |

**Phase 3 Feature Count:** 14 features

---

### Phase 4 — Hearings and Tasks

| Feature | Status |
|---|---|
| Court session scheduling | Complete |
| Hearing outcomes: POSTPONED, DECIDED, PARTIAL_RULING, ADJOURNED, EVIDENCE, EXPERT, MEDIATION, PLEADING, CANCELLED | Complete |
| Next session date tracking | Complete |
| Task management with titles, descriptions, and due dates | Complete |
| Task priorities: LOW, MEDIUM, HIGH, URGENT | Complete |
| Task statuses: PENDING, IN_PROGRESS, REVIEW, DONE, CANCELLED | Complete |
| Task assignment to team members | Complete |
| Google Calendar sync for hearings | Complete |

**Phase 4 Feature Count:** 8 features

---

### Phase 5 — Documents, Billing, and Notifications

| Feature | Status |
|---|---|
| Document upload (up to 50 MB per file) | Complete |
| Supported formats: PDF, Word, Excel, images | Complete |
| OCR text extraction — offline (Tesseract.js, supports Arabic) | Complete |
| OCR text extraction — cloud (Google Cloud Vision) | Complete |
| Full-text search across all firm documents | Complete |
| Document versioning | Complete |
| Document templates: system-provided and firm-specific | Complete |
| Invoice management | Complete |
| Invoice lifecycle: DRAFT → ISSUED → PARTIALLY_PAID → PAID → VOID | Complete |
| Line-item invoicing with per-item tax and discount | Complete |
| Payment recording with payment method | Complete |
| Expense tracking by category | Complete |
| Receipt attachment to expenses | Complete |
| In-app notifications | Complete |
| Email notifications (SMTP or Resend) | Complete |
| SMS notifications (Twilio) | Complete |
| Desktop OS push notifications | Complete |
| Automated hearing reminders: 7-day, 1-day, day-of | Complete |
| Overdue task alerts | Complete |
| Overdue invoice alerts | Complete |
| 7 notification types across 4 delivery channels | Complete |

**Phase 5 Feature Count:** 21 features

---

### Phase 6 — Law Library

| Feature | Status |
|---|---|
| Hierarchical legal category taxonomy (tree structure) | Complete |
| Library document types: legislation, court rulings, legal principles | Complete |
| Individual legislation article records within a law | Complete |
| SYSTEM scope documents (vendor-provided) | Complete |
| FIRM scope documents (firm-specific, private) | Complete |
| Document tagging | Complete |
| Personal annotations on library documents | Complete |
| Link library documents to case matters | Complete |
| Full-text search on library content | Complete |

**Phase 6 Feature Count:** 9 features

---

### Phase 7 — AI Research Assistant

| Feature | Status |
|---|---|
| Claude AI (Anthropic API) powered chat interface | Complete |
| Retrieval-augmented generation from the firm's law library | Complete |
| Streaming AI responses (Server-Sent Events) | Complete |
| Session-based conversation history | Complete |
| Citation chips: AI responses link to specific library documents and articles | Complete |
| Monthly AI query usage limit per firm (configurable, default 500) | Complete |
| Research sessions linkable to specific cases | Complete |

**Phase 7 Feature Count:** 7 features

---

### Additional Platform Features (Cross-Phase)

| Feature | Status |
|---|---|
| Dashboard with analytics and summary widgets | Complete |
| Custom report builder (configurable report definitions) | Complete |
| Data import tools | Complete |
| Audit log: every change recorded with user, IP, user agent, old and new values | Complete |
| Soft delete pattern (data recoverable, not permanently removed) | Complete |

**Additional Feature Count:** 5 features

---

## Feature Count Summary

| Phase | Area | Features |
|---|---|---|
| Phase 1–2 | Foundation and Access Control | 13 |
| Phase 3 | Case and Client Management | 14 |
| Phase 4 | Hearings and Tasks | 8 |
| Phase 5 | Documents, Billing, and Notifications | 21 |
| Phase 6 | Law Library | 9 |
| Phase 7 | AI Research Assistant | 7 |
| Additional | Platform-Wide | 5 |
| **Total** | | **77** |

---

## Planned Features — Phases 6–17 (Post-Launch Feature Completion)

### Phase 6 — Security, Trial System & Core Fixes

| Feature | Status |
|---|---|
| Trial 24h countdown modal with data export ZIP (DATA_DELETION_PENDING state) | Planned |
| Full data deletion on trial expiry (DELETED state) | Planned |
| RSA-signed trial.json tamper detection | Planned |
| License key activation via offline RSA validation | Planned |
| AES-256-GCM field-level encryption for national IDs and financial data | Planned |
| Immutable read audit trail (Law No. 151/2020 compliance) | Planned |
| Tawkeel per-type metadata enforcement (General, Special, Commercial Agency) | Planned |
| Tawkeel revocation lock (blocks documents, billing, filings under revoked POA) | Planned |
| Conflict of interest check on case party add and client intake | Planned |
| Kanban board with RTL-aware column order | Planned |
| Daily overdue task digest notification | Planned |
| French legal document templates | Planned |

**Phase 6 Feature Count:** 12 features

---

### Phase 7 — Billing Completeness

| Feature | Status |
|---|---|
| Blended fee type (flat + hourly phases) | Planned |
| Success / Contingency fee triggered on case WON outcome | Planned |
| Milestone billing — auto-invoice on case milestone | Planned |
| Retainer (periodic fee) with auto-scheduled next invoice | Planned |
| Appearance fee per session — auto-invoice on session outcome | Planned |
| Post-dated cheque tracking with ChequeStatus lifecycle | Planned |
| Cheque maturity date alerts (3-day advance warning) | Planned |
| Installment payment plan (split invoice into scheduled payments) | Planned |
| VAT engine: 14% standard, reverse charge, simplified regime | Planned |
| Input VAT tracker for firm purchases | Planned |
| Quarterly VAT report (output VAT, input VAT, net payable) | Planned |
| Law 157/2025 real estate VAT advisory | Planned |

**Phase 7 Feature Count:** 12 features

---

### Phase 8 — Arabic Search, Session Enhancements & Stamp Fees

| Feature | Status |
|---|---|
| Arabic name search with diacritics-tolerant pg_trgm trigram matching | Planned |
| Remote session support (video link, credentials, in-person vs video flag) | Planned |
| Lawyer session conflict detection (±30 min overlap warning) | Planned |
| Khobara referral auto-task generation for paralegal | Planned |
| Bar Association stamp fee (دمغة محاماة) tracking per document | Planned |
| Court filing fee as distinct billable expense category | Planned |

**Phase 8 Feature Count:** 6 features

---

### Phase 9 — Company Formation Module

| Feature | Status |
|---|---|
| Company type differentiation: LLC vs Joint Stock Company deposit rules | Planned |
| Formation status workflow: INTAKE → COMPLETED (7-step stepper UI) | Planned |
| JSC blocked deposit validation (≥10% of capital, min 25,000 EGP) | Planned |
| Formation fee tracker (Notary, Chamber, Bar Association, GAFI categories) | Planned |
| Golden License program tracker (Investment Law 160/2023) | Planned |
| Commercial register tracking per corporate client with renewal alerts | Planned |

**Phase 9 Feature Count:** 6 features

---

### Phase 10 — Client Portal Completion + PWA

| Feature | Status |
|---|---|
| Client appointment request form (portal → admin task) | Planned |
| ETA-compliant e-invoice download from portal (gated on Phase 12) | Planned |
| PWA conflict resolution UI (queued write vs server state side-by-side diff) | Planned |

**Phase 10 Feature Count:** 3 features

---

### Phase 11 — Reports Completion + Settings

| Feature | Status |
|---|---|
| Hearing outcomes trend report (monthly, grouped by outcome) | Planned |
| ETA submission log report | Planned |
| Tawkeel status report (active / expiring / revoked) | Planned |
| Bar Association stamp fee expenditure report | Planned |
| ETA adapter configuration UI (middleware vs HSM) | Planned |
| License key management UI (desktop editions) | Planned |

**Phase 11 Feature Count:** 6 features

---

### Phase 12 — ETA e-Invoicing Pipeline

| Feature | Status |
|---|---|
| IETAAdapter interface with middleware implementation (Paymob/Fawateer) | Planned |
| IETAAdapter HSM/USB token implementation (enterprise) | Planned |
| ETA invoice builder — ELMS invoice → ETA JSON mapping | Planned |
| BullMQ submission queue with 3-retry logic | Planned |
| ETA UUID stored on invoice after successful submission | Planned |
| B2C e-receipt via ETA POS endpoint | Planned |
| ETA submission confirmation and failure notifications | Planned |

**Phase 12 Feature Count:** 7 features

---

### Phase 13 — WhatsApp Business API

| Feature | Status |
|---|---|
| WhatsApp notification channel (Meta Cloud API) | Planned |
| Per-client WhatsApp number field | Planned |
| Court roll update notifications via WhatsApp | Planned |
| Client portal activity notifications via WhatsApp | Planned |
| WhatsApp opt-in preference per user | Planned |

**Phase 13 Feature Count:** 5 features

---

### Phase 14 — VLM Handwritten OCR + AI Document Analysis

| Feature | Status |
|---|---|
| VLM OCR adapter (GPT-4o Vision or Gemini 1.5 Pro) for handwritten documents | Planned |
| Desktop fallback to Tesseract with limitation notice | Planned |
| AI document analysis endpoint (VLM extraction → Anthropic one-shot) | Planned |
| "Analyze Document" tab in ResearchPage | Planned |

**Phase 14 Feature Count:** 4 features

---

### Phase 15 — LAN License Enforcement

| Feature | Status |
|---|---|
| RSA-SHA256 offline license validation against embedded public key | Planned |
| licenseGraceGuard middleware (403 LICENSE_GRACE for non-GET requests) | Planned |
| Grace-mode persistent banner with days remaining | Planned |
| Mutation buttons disabled with tooltip in grace mode | Planned |

**Phase 15 Feature Count:** 4 features

---

### Phase 16 — International Tawkeel Authentication Chain

| Feature | Status |
|---|---|
| TawkeelAuthChainStep model (3 steps: Foreign Notary, Egyptian Consulate, MoFA) | Planned |
| Guard: block ACTIVE status on foreign-client POA until all chain steps complete | Planned |
| Document upload slot per authentication step | Planned |
| "Book via Digital Egypt" browser link (integration stub) | Planned |

**Phase 16 Feature Count:** 4 features

---

### Phase 17 — MoJ / State Council Portal Integration

| Feature | Status |
|---|---|
| courtRollUpdateSource field on CaseSession (MANUAL / MOJ_PORTAL / ESC_PORTAL) | Planned |
| IMojAdapter stub interface (full impl blocked on government API access) | Planned |

**Phase 17 Feature Count:** 2 features (preparatory only)

---

### Additional Post-Launch Features (Previously Planned)

| Feature | Status |
|---|---|
| Egyptian Official Gazette monitoring (automated legislation update alerts) | Planned |
| Bidirectional Google Calendar sync | Planned |
| Advanced analytics and enhanced report builder | Planned |
| Bulk data import improvements | Planned |
| External API access for third-party integrations | Planned |
| Mobile app (PWA progressive enhancement foundation already in place) | Planned |

---

## Feature Count Summary (Updated)

| Phase | Area | Features |
|---|---|---|
| Phase 1–2 | Foundation and Access Control | 13 |
| Phase 3 | Case and Client Management | 14 |
| Phase 4 | Hearings and Tasks | 8 |
| Phase 5 | Documents, Billing, and Notifications | 21 |
| Phase 6 (old) | Law Library | 9 |
| Phase 7 (old) | AI Research Assistant | 7 |
| Additional | Platform-Wide | 5 |
| **Subtotal (Shipped)** | | **77** |
| Phase 6 (new) | Security, Trial, Tawkeel, Conflicts, Kanban | 12 |
| Phase 7 (new) | Billing Completeness | 12 |
| Phase 8 (new) | Search, Sessions, Stamp Fees | 6 |
| Phase 9 | Company Formation | 6 |
| Phase 10 | Client Portal + PWA | 3 |
| Phase 11 | Reports + Settings | 6 |
| Phase 12 | ETA e-Invoicing | 7 |
| Phase 13 | WhatsApp | 5 |
| Phase 14 | VLM OCR + AI Doc Analysis | 4 |
| Phase 15 | LAN License Enforcement | 4 |
| Phase 16 | International Tawkeel Chain | 4 |
| Phase 17 | MoJ Portal Stubs | 2 |
| **Subtotal (Planned)** | | **71** |
| **Grand Total** | | **148** |

---

## Cloud vs. Desktop Deployment Feature Comparison

| Feature | Cloud SaaS | Desktop License |
|---|---|---|
| **Deployment** | Browser-based, hosted by vendor | Installed application, runs on firm's hardware |
| **Internet required** | Yes | No — fully offline |
| **Multi-user access** | Yes — unlimited users per subscription tier | Yes — multi-user on local network |
| **Authentication** | Email/password, invite-based | Local authentication, offline-capable |
| **Case and client management** | Full | Full |
| **Hearing scheduling and reminders** | Full | Full |
| **Task management** | Full | Full |
| **Document management and OCR** | Full (cloud OCR available) | Full (offline OCR via Tesseract.js) |
| **Law Library** | Full | Full |
| **AI Research Assistant** | Full (requires API key) | Full (requires API key; internet needed only for AI queries) |
| **Billing and invoicing** | Full | Full |
| **In-app notifications** | Yes | Yes |
| **Email notifications** | Yes | Yes (requires SMTP configuration) |
| **SMS notifications** | Yes (via Twilio) | Yes (requires internet) |
| **Desktop OS push notifications** | Not applicable | Yes — native OS notifications |
| **Google Calendar sync** | Yes | Yes (requires internet) |
| **Audit log** | Yes | Yes |
| **Data location** | Vendor-managed cloud storage | Firm's own hardware — full data sovereignty |
| **Backups** | Managed by vendor | Firm's responsibility (tooling provided) |
| **Software updates** | Automatic | Over-the-air update mechanism |
| **Egyptian payment gateways** | Yes (Connect Misr, Paymob) | Yes (Connect Misr, Paymob) |
| **Pricing model** | Monthly or annual subscription | One-time perpetual license (optional annual update plan) |
| **IT requirements** | None — browser only | Minimal — one-click installer |
| **Suitable for** | Teams of 2–200+ lawyers | Solo practitioners to mid-size firms |
