# Database

ELMS uses **PostgreSQL 16** as its primary datastore, accessed through [Prisma ORM](https://www.prisma.io/) (v6). This document covers the schema location, the entity model, the migration workflow, seeding, the multi-tenant design, and the embedded PostgreSQL instance shipped with the desktop edition.

---

## Prisma setup

| Item | Path |
|---|---|
| Schema file | `packages/backend/prisma/schema.prisma` |
| Migration history | `packages/backend/prisma/migrations/` |
| Seed script | `packages/backend/prisma/seed.ts` |
| Generated client | `node_modules/@prisma/client` (emitted by `prisma generate`) |

The `datasource` block in `schema.prisma` reads the connection string from the environment:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## Migration workflow

### Development

Run migrations and auto-generate a new migration file when the schema changes:

```bash
pnpm --filter @elms/backend exec prisma migrate dev
```

This command:
1. Diffs the schema against the last applied migration
2. Generates a new SQL migration file in `prisma/migrations/`
3. Applies all pending migrations to the development database
4. Regenerates the Prisma client

### Production / CI

Apply existing migrations without generating new ones:

```bash
pnpm --filter @elms/backend exec prisma migrate deploy
```

### Current migration history

| Migration | Description |
|---|---|
| `0001_initial` | Full initial schema |
| `0002_raw` | Raw SQL additions |
| `0003_performance_indexes` | Additional query-performance indexes |
| `0004_user_email_unique` | Unique constraint on `(firmId, email)` for `User` |
| `0005_lookup_tables` | `LookupOption` table and related constraints |

---

## Seeding

```bash
# Cloud database (uses DATABASE_URL from .env)
pnpm seed:dev:cloud

# Desktop database (uses apps/desktop/.env.desktop)
pnpm seed:dev
```

Both commands run `packages/backend/prisma/seed.ts` via `tsx`. The seed creates system roles, permissions, lookup options, and an initial admin user for development purposes.

The `prisma.seed` field in `packages/backend/package.json` configures `prisma db seed` to use the same script:

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

---

## Multi-tenant design

ELMS is a multi-tenant system where each law firm is a **tenant**. The `Firm` model is the root of the tenant hierarchy. Every entity that belongs to a firm carries a `firmId: String @db.Uuid` foreign key:

```
Firm ──< User
     ──< Role ──< RolePermission ──< Permission
     ──< Client ──< ClientContact
     ──< Case ──< CaseAssignment
                ──< CaseParty
                ──< CaseStatusHistory
                ──< CaseCourt ──< CaseSession
                ──< Task
                ──< Document ──< DocumentVersion
                ──< Invoice ──< InvoiceItem
                              ──< Payment
                ──< Expense
                ──< Event
                ──< PowerOfAttorney
     ──< Notification ──< NotificationPreference
     ──< AuditLog
     ──< LibraryDocument (firm-scoped; SYSTEM-scoped docs have firmId = null)
     ──< LegalCategory
     ──< LibraryAnnotation
     ──< ResearchSession ──< ResearchMessage ──< ResearchSessionSource
     ──< CustomReport
     ──< DocumentTemplate (firm-scoped or system; firmId nullable)
     ──< LookupOption (firm-scoped or system; firmId nullable)
     ──< GoogleCalendarToken
```

The backend service layer always scopes Prisma queries with `where: { firmId: sessionUser.firmId }`. Cross-tenant data access is structurally prevented.

---

## Entity reference

### Identity and access

| Model | Key fields | Notes |
|---|---|---|
| `Firm` | `id`, `slug` (unique), `type`, `editionKey`, `lifecycleStatus` | Root tenant record; `lifecycleStatus` drives access restriction (ACTIVE → GRACE → SUSPENDED → PENDING_DELETION) |
| `FirmSettings` | `firmId` (1:1), `timezone`, `currency`, `preferredLanguage` | One settings record per firm |
| `Role` | `firmId?`, `key`, `scope` | `scope=SYSTEM` roles are shared; `scope=FIRM` roles are firm-specific. Unique on `(firmId, key)` |
| `Permission` | `key` (unique) | 69 permission strings seeded at startup |
| `RolePermission` | composite PK `(roleId, permissionId)` | Join table; cascades on role delete |
| `User` | `firmId`, `roleId`, `email`, `status` | Unique on `(firmId, email)`; soft-deleted via `deletedAt` |
| `Invitation` | `firmId`, `token` (unique), `status`, `expiresAt` | Statuses: PENDING, ACCEPTED, EXPIRED, REVOKED |

### Clients and cases

| Model | Key fields | Notes |
|---|---|---|
| `Client` | `firmId`, `name`, `type` (INDIVIDUAL/COMPANY/GOVERNMENT), `portalEmail` | Uses a single canonical `name` field; has portal access fields; soft-deleted via `deletedAt` |
| `ClientContact` | `clientId` | Additional contacts for a client |
| `Case` | `firmId`, `clientId`, `caseNumber`, `status` | Status enum: ACTIVE, SUSPENDED, CLOSED, WON, LOST, SETTLED, ARCHIVED |
| `CaseAssignment` | `caseId`, `userId`, `roleOnCase` | Records which staff are assigned and in what capacity (LEAD, SUPPORTING, PARALEGAL, CONSULTANT) |
| `CaseParty` | `caseId` | Opposing parties and our clients on a case |
| `CaseStatusHistory` | `caseId`, `fromStatus`, `toStatus`, `changedAt` | Full audit trail of case status transitions |
| `CaseCourt` | `caseId`, `stageOrder` | Tracks multi-stage court progression; ordered by `stageOrder` |
| `CaseSession` | `caseId`, `caseCourtId?`, `sessionDatetime`, `outcome` | Hearing sessions; `SessionOutcome` enum covers POSTPONED, DECIDED, PARTIAL_RULING, etc. |
| `PowerOfAttorney` | `firmId`, `clientId`, `caseId?`, `type` | PoaType: GENERAL, SPECIAL, LITIGATION |

### Tasks

| Model | Key fields | Notes |
|---|---|---|
| `Task` | `firmId`, `caseId?`, `status`, `priority`, `assignedToId` | Status: PENDING, IN_PROGRESS, REVIEW, DONE, CANCELLED. Priority: LOW, MEDIUM, HIGH, URGENT |

### Documents

| Model | Key fields | Notes |
|---|---|---|
| `Document` | `firmId`, `caseId?`, `clientId?`, `storageKey`, `extractionStatus`, `ocrBackend` | `extractionStatus`: PENDING, PROCESSING, INDEXED, FAILED |
| `DocumentVersion` | `documentId`, `versionNumber` | Immutable version history |
| `DocumentTemplate` | `firmId?`, `language`, `body` | System templates have `firmId=null` and `isSystem=true` |

### Billing

| Model | Key fields | Notes |
|---|---|---|
| `Invoice` | `firmId`, `invoiceNumber` (unique per firm), `status` | Status: DRAFT, ISSUED, PARTIALLY_PAID, PAID, VOID. Amounts stored as `Decimal(12,2)` |
| `InvoiceItem` | `invoiceId` | Line items; `total = quantity × unitPrice` |
| `Payment` | `invoiceId`, `amount`, `method` | Partial payment tracking |
| `Expense` | `firmId`, `caseId?`, `amount`, `receiptDocumentId?` | Case expense records with optional receipt document link |

### Events and notifications

| Model | Key fields | Notes |
|---|---|---|
| `Event` | `firmId`, `caseId?`, `sessionId?` (unique) | Calendar events; sessions project into events for calendar display |
| `Notification` | `firmId`, `userId`, `type`, `isRead` | NotificationType covers hearing reminders, task overdue, invoice overdue, document indexed, research complete |
| `NotificationPreference` | `userId`, `type`, `channel` | Per-user preference for each notification type/channel combination. Channels: IN_APP, EMAIL, SMS, DESKTOP_OS |
| `AuditLog` | `firmId?`, `userId?`, `action`, `entityType`, `entityId` | Stores `oldData` and `newData` as JSON |

### Law library

| Model | Key fields | Notes |
|---|---|---|
| `LegalCategory` | `firmId?`, `slug`, `parentId?`, `nameAr`, `nameEn`, `nameFr` | Self-referential tree via `LegalCategoryTree`; explicit tri-lingual category names |
| `LibraryDocument` | `firmId?`, `scope` (SYSTEM/FIRM), `type`, `title`, `legislationStatus?` | Single `title` field; stores legislation, judgments, legal articles. SYSTEM-scoped docs have `firmId=null` |
| `LegislationArticle` | `documentId`, `articleNumber`, `body` | Individual articles within a legislation document |
| `LibraryTag` / `LibraryDocumentTag` | `name` (unique) | Tagging join table |
| `LibraryAnnotation` | `firmId`, `documentId`, `userId` | Per-user annotations on library documents |
| `CaseLegalReference` | `caseId`, `documentId`, `articleId?` | Links a case to cited library documents and articles |

### Research

| Model | Key fields | Notes |
|---|---|---|
| `ResearchSession` | `firmId`, `caseId?`, `userId` | An AI research conversation |
| `ResearchMessage` | `sessionId`, `role` (USER/ASSISTANT/SYSTEM) | Individual chat turns |
| `ResearchSessionSource` | `sessionId`, `messageId?`, `documentId`, `articleId?` | Library sources cited by the AI in a message |

### Reports and portal

| Model | Key fields | Notes |
|---|---|---|
| `CustomReport` | `firmId`, `reportType`, `config` (JSON) | Saved report configurations |
| `ClientPortalInvite` | `clientId`, `firmId`, `tokenHash`, `expiresAt` | One-time invite tokens for client portal access |
| `GoogleCalendarToken` | `userId` (unique), `firmId`, `encryptedAccessToken`, `encryptedRefreshToken` | Encrypted OAuth tokens for Google Calendar sync |

---

## Desktop embedded PostgreSQL

The Tauri desktop application ships with a bundled PostgreSQL 16 instance. It binds to `127.0.0.1:5433` by default (configurable via `DESKTOP_POSTGRES_PORT`). The data directory is stored at `~/.local/share/com.elms.desktop/postgres/`.

The backend in desktop mode connects to this embedded instance using a `DATABASE_URL` constructed from `DESKTOP_POSTGRES_PORT`. The `AUTH_MODE=LOCAL` setting disables multi-firm registration and uses the in-memory session store instead of JWT cookies.

---

## Related

- [Getting Started](./01-getting-started.md) — migration and seeding commands
- [Environment Variables](./03-environment-variables.md) — `DATABASE_URL`, `DESKTOP_POSTGRES_PORT`
- [Architecture Internals](./04-architecture-internals.md) — multi-tenancy enforcement in service layer
