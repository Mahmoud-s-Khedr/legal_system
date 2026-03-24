-- Migration 0007: Enforce Case.clientId NOT NULL
-- Prerequisite: all existing Case rows must have clientId populated by the operator.
-- This migration adds a NOT NULL constraint using the safe two-phase approach:
--   1. Add a NOT NULL check constraint without validating existing rows (instant).
--   2. Validate the constraint in a separate step (validates without a full table lock).

-- Step 1: Add the constraint as NOT VALID so it applies only to new/updated rows.
ALTER TABLE "Case"
  ADD CONSTRAINT "Case_clientId_not_null"
  CHECK ("clientId" IS NOT NULL)
  NOT VALID;

-- Step 2: Validate the constraint against existing rows.
-- This takes a ShareUpdateExclusiveLock (non-blocking for reads/writes).
ALTER TABLE "Case"
  VALIDATE CONSTRAINT "Case_clientId_not_null";

-- Step 3: Drop the CHECK constraint now that NOT NULL is enforced by schema.
-- Prisma will represent this as a plain NOT NULL column type in schema.prisma.
ALTER TABLE "Case"
  DROP CONSTRAINT "Case_clientId_not_null";

-- Step 4: Set the column to NOT NULL at the DDL level.
ALTER TABLE "Case"
  ALTER COLUMN "clientId" SET NOT NULL;
