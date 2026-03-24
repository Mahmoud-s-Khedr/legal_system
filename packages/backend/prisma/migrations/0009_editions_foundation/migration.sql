-- Migration 0009: edition and lifecycle foundation

DO $$
BEGIN
  CREATE TYPE "EditionKey" AS ENUM (
    'solo_offline',
    'solo_online',
    'local_firm_offline',
    'local_firm_online',
    'enterprise'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "FirmLifecycleStatus" AS ENUM (
    'ACTIVE',
    'GRACE',
    'SUSPENDED',
    'PENDING_DELETION'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "Firm"
  ADD COLUMN IF NOT EXISTS "editionKey"      "EditionKey"          NOT NULL DEFAULT 'solo_online',
  ADD COLUMN IF NOT EXISTS "lifecycleStatus" "FirmLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "trialStartedAt"  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "trialEndsAt"     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "graceEndsAt"     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "suspendedAt"     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "deletionDueAt"   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "deletedAt"       TIMESTAMPTZ;

-- Backfill defensively for existing rows in partially migrated environments.
UPDATE "Firm"
SET
  "editionKey"      = COALESCE("editionKey", 'solo_online'::"EditionKey"),
  "lifecycleStatus" = COALESCE("lifecycleStatus", 'ACTIVE'::"FirmLifecycleStatus")
WHERE
  "editionKey" IS NULL
  OR "lifecycleStatus" IS NULL;
