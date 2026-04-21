-- Migration 0017: Case Party Rework + Client PoA Number
-- 1. Add partyType column with default 'OPPONENT'
-- 2. Migrate existing data: isOurClient=true → partyType='CLIENT'
-- 3. Drop isOurClient and opposingCounselName columns
-- 4. Add index on (caseId, partyType)
-- 5. Add poaNumber to Client

-- Step 1: add partyType with a safe default
ALTER TABLE "CaseParty" ADD COLUMN "partyType" TEXT NOT NULL DEFAULT 'OPPONENT';

-- Step 2: migrate existing boolean values
UPDATE "CaseParty" SET "partyType" = 'CLIENT' WHERE "isOurClient" = true;

-- Step 3: drop old columns
ALTER TABLE "CaseParty" DROP COLUMN "isOurClient";
ALTER TABLE "CaseParty" DROP COLUMN "opposingCounselName";

-- Step 4: add index
CREATE INDEX "CaseParty_caseId_partyType_idx" ON "CaseParty"("caseId", "partyType");

-- Step 5: add poaNumber to Client
ALTER TABLE "Client" ADD COLUMN "poaNumber" TEXT;
