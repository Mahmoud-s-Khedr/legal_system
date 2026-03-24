-- Migration 0008: Phase 6 library ingestion + Phase 8 post-launch features

-- ─── LibraryDocument: file extraction support ─────────────────────────────────
ALTER TABLE "LibraryDocument"
  ADD COLUMN IF NOT EXISTS "storageKey"       TEXT,
  ADD COLUMN IF NOT EXISTS "extractionStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "ocrBackend"       TEXT NOT NULL DEFAULT 'TESSERACT';

-- ─── CaseSession: Google Calendar event ID ────────────────────────────────────
ALTER TABLE "CaseSession"
  ADD COLUMN IF NOT EXISTS "googleCalendarEventId" TEXT;

-- ─── Client: portal auth fields ───────────────────────────────────────────────
ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "portalEmail"         TEXT,
  ADD COLUMN IF NOT EXISTS "portalPasswordHash"  TEXT,
  ADD COLUMN IF NOT EXISTS "portalLastLoginAt"   TIMESTAMPTZ;

-- ─── CustomReport ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CustomReport" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "firmId"       UUID        NOT NULL,
  "name"         TEXT        NOT NULL,
  "description"  TEXT,
  "reportType"   TEXT        NOT NULL,
  "config"       JSONB       NOT NULL DEFAULT '{}',
  "createdById"  UUID,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "CustomReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomReport_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "CustomReport_firmId_idx" ON "CustomReport"("firmId");

-- ─── ClientPortalInvite ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ClientPortalInvite" (
  "id"        UUID        NOT NULL DEFAULT gen_random_uuid(),
  "clientId"  UUID        NOT NULL,
  "firmId"    UUID        NOT NULL,
  "email"     TEXT        NOT NULL,
  "tokenHash" TEXT        NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "usedAt"    TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ClientPortalInvite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClientPortalInvite_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ClientPortalInvite_tokenHash_idx" ON "ClientPortalInvite"("tokenHash");
CREATE INDEX IF NOT EXISTS "ClientPortalInvite_clientId_idx"  ON "ClientPortalInvite"("clientId");

-- ─── GoogleCalendarToken ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "GoogleCalendarToken" (
  "id"                    UUID        NOT NULL DEFAULT gen_random_uuid(),
  "userId"                UUID        NOT NULL,
  "firmId"                UUID        NOT NULL,
  "encryptedAccessToken"  TEXT        NOT NULL,
  "encryptedRefreshToken" TEXT        NOT NULL,
  "expiresAt"             TIMESTAMPTZ NOT NULL,
  "scope"                 TEXT        NOT NULL,
  "calendarId"            TEXT        NOT NULL DEFAULT 'primary',
  "syncToken"             TEXT,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "GoogleCalendarToken_pkey"       PRIMARY KEY ("id"),
  CONSTRAINT "GoogleCalendarToken_userId_key" UNIQUE ("userId"),
  CONSTRAINT "GoogleCalendarToken_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE
);
