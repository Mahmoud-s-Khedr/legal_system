-- Phase 6 Foundation Migration
-- Adds new lifecycle states, PoA status enum, new notification types,
-- and new fields across PowerOfAttorney, FirmSettings, Client, and User models.
--
-- IMPORTANT: PostgreSQL ALTER TYPE ... ADD VALUE is non-transactional.
-- All enum additions are grouped here with IF NOT EXISTS guards.

-- ─── FirmLifecycleStatus: new states ────────────────────────────────────────
ALTER TYPE "FirmLifecycleStatus" ADD VALUE IF NOT EXISTS 'DATA_DELETION_PENDING';
ALTER TYPE "FirmLifecycleStatus" ADD VALUE IF NOT EXISTS 'LICENSED';

-- ─── PoaStatus enum (new) ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "PoaStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'PENDING');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ─── NotificationType: new values for Phase 6E, 7B, 10A ─────────────────────
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_DAILY_DIGEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CHEQUE_MATURITY_DUE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PORTAL_APPOINTMENT_REQUEST';

-- ─── User: add phone field ───────────────────────────────────────────────────
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- ─── FirmSettings: license + encryption fields ───────────────────────────────
ALTER TABLE "FirmSettings"
  ADD COLUMN IF NOT EXISTS "licenseKeyHash"      TEXT,
  ADD COLUMN IF NOT EXISTS "licenseActivatedAt"  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "trialSignatureB64"   TEXT,
  ADD COLUMN IF NOT EXISTS "dataEncryptionKeyRef" TEXT;

-- ─── PowerOfAttorney: Tawkeel metadata + revocation ─────────────────────────
ALTER TABLE "PowerOfAttorney"
  ADD COLUMN IF NOT EXISTS "status"                "PoaStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "revokedAt"             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "revocationReason"      TEXT,
  ADD COLUMN IF NOT EXISTS "scopeTextAr"           TEXT,
  ADD COLUMN IF NOT EXISTS "hasSelfContractClause" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "commercialRegisterId"  TEXT,
  ADD COLUMN IF NOT EXISTS "agentCertExpiry"       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "agentResidencyStatus"  TEXT;

-- ─── Client: encrypted national ID field ─────────────────────────────────────
ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "nationalIdEncrypted" TEXT;

-- ─── Indexes for new query patterns ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS power_of_attorney_firm_status_idx
  ON "PowerOfAttorney" ("firmId", "status");
CREATE INDEX IF NOT EXISTS power_of_attorney_client_idx
  ON "PowerOfAttorney" ("clientId");
