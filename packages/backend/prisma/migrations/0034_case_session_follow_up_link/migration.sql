ALTER TABLE "CaseSession"
ADD COLUMN "parentSessionId" UUID;

CREATE UNIQUE INDEX "CaseSession_parentSessionId_key"
ON "CaseSession"("parentSessionId")
WHERE "parentSessionId" IS NOT NULL;

CREATE INDEX "CaseSession_parentSessionId_idx"
ON "CaseSession"("parentSessionId");

ALTER TABLE "CaseSession"
ADD CONSTRAINT "CaseSession_parentSessionId_fkey"
FOREIGN KEY ("parentSessionId") REFERENCES "CaseSession"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
