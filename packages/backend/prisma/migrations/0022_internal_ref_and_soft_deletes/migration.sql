-- Add internalRef serial number to Client
ALTER TABLE "Client" ADD COLUMN "internalRef" TEXT;

-- Add internalRef serial number to Case
ALTER TABLE "Case" ADD COLUMN "internalRef" TEXT;

-- Add soft-delete to CaseSession (hearings)
ALTER TABLE "CaseSession" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Add soft-delete to Expense
ALTER TABLE "Expense" ADD COLUMN "deletedAt" TIMESTAMP(3);
