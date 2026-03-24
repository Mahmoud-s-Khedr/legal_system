-- Migration 0006: Case Court Progression + Mandatory Client
-- Adds CaseCourt model for multi-court case tracking.
-- Adds Case.clientId FK for mandatory client association.
-- Adds CaseSession.caseCourtId for linking sessions to a court stage.

-- ============================================================
-- PART 1: Add clientId to Case (nullable first for safe backfill)
-- ============================================================

ALTER TABLE "Case" ADD COLUMN "clientId" UUID;

-- Backfill from the first CaseParty where isOurClient=true and clientId is set
UPDATE "Case" c
SET "clientId" = cp."clientId"
FROM "CaseParty" cp
WHERE cp."caseId" = c."id"
  AND cp."isOurClient" = true
  AND cp."clientId" IS NOT NULL
  AND c."clientId" IS NULL;

-- Add the FK constraint (DEFERRABLE so the column can be NULL during migrations)
ALTER TABLE "Case"
  ADD CONSTRAINT "Case_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

-- ============================================================
-- PART 2: Create CaseCourt table
-- ============================================================

CREATE TABLE "CaseCourt" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "caseId"     UUID         NOT NULL,
  "courtName"  TEXT         NOT NULL,
  "courtLevel" TEXT         NOT NULL,
  "circuit"    TEXT,
  "caseNumber" TEXT,
  "stageOrder" INTEGER      NOT NULL DEFAULT 0,
  "startedAt"  TIMESTAMP(3),
  "endedAt"    TIMESTAMP(3),
  "isActive"   BOOLEAN      NOT NULL DEFAULT true,
  "notes"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseCourt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CaseCourt_caseId_fkey" FOREIGN KEY ("caseId")
    REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CaseCourt_caseId_stageOrder_idx" ON "CaseCourt" ("caseId", "stageOrder");

-- ============================================================
-- PART 3: Backfill CaseCourt from existing Case court fields
-- One stage-0 row per case that had courtName or courtLevel set.
-- ============================================================

INSERT INTO "CaseCourt" ("id","caseId","courtName","courtLevel","circuit","stageOrder","isActive","createdAt","updatedAt")
SELECT
  gen_random_uuid(),
  c."id",
  COALESCE(c."courtName", 'Unknown'),
  COALESCE(c."courtLevel", 'PRIMARY'),
  c."circuit",
  0,
  true,
  c."createdAt",
  c."updatedAt"
FROM "Case" c
WHERE c."courtName" IS NOT NULL OR c."courtLevel" IS NOT NULL;

-- ============================================================
-- PART 4: Add caseCourtId to CaseSession
-- ============================================================

ALTER TABLE "CaseSession" ADD COLUMN "caseCourtId" UUID;

ALTER TABLE "CaseSession"
  ADD CONSTRAINT "CaseSession_caseCourtId_fkey"
  FOREIGN KEY ("caseCourtId") REFERENCES "CaseCourt"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Link existing sessions to their case's stage-0 court
UPDATE "CaseSession" cs
SET "caseCourtId" = cc."id"
FROM "CaseCourt" cc
WHERE cc."caseId" = cs."caseId"
  AND cc."stageOrder" = 0;

-- ============================================================
-- PART 5: Drop old court columns from Case
-- (data already migrated to CaseCourt in Part 3)
-- ============================================================

ALTER TABLE "Case" DROP COLUMN IF EXISTS "courtName";
ALTER TABLE "Case" DROP COLUMN IF EXISTS "courtLevel";
ALTER TABLE "Case" DROP COLUMN IF EXISTS "circuit";

-- ============================================================
-- PART 6: Row-Level Security for CaseCourt
-- Access is inherited from the parent Case's firmId.
-- ============================================================

ALTER TABLE "CaseCourt" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "casecourt_tenant_isolation" ON "CaseCourt"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Case" ca
      WHERE ca."id" = "CaseCourt"."caseId"
        AND ca."firmId"::text = current_setting('app.current_firm_id', true)
    )
  );

-- NOTE: Case.clientId NOT NULL enforcement is intentionally deferred.
-- After operators have reviewed and assigned clients to pre-existing cases,
-- run migration 0007 to apply: ALTER TABLE "Case" ALTER COLUMN "clientId" SET NOT NULL;
