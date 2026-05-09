ALTER TABLE "LegalCategory"
ADD COLUMN "documentType" TEXT NOT NULL DEFAULT 'LEGISLATION';

DROP INDEX IF EXISTS "LegalCategory_firmId_slug_key";

CREATE UNIQUE INDEX "LegalCategory_firmId_slug_documentType_key"
ON "LegalCategory"("firmId", "slug", "documentType");
