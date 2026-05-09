CREATE TABLE "LibraryDocType" (
  "id" UUID NOT NULL,
  "firmId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "nameAr" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "nameFr" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LibraryDocType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LibraryDocType_firmId_code_key" ON "LibraryDocType"("firmId", "code");
CREATE UNIQUE INDEX "LibraryDocType_firmId_slug_key" ON "LibraryDocType"("firmId", "slug");

ALTER TABLE "LegalCategory" ADD COLUMN "typeId" UUID;
ALTER TABLE "LibraryDocument" ADD COLUMN "typeId" UUID;

CREATE INDEX "LegalCategory_firmId_typeId_idx" ON "LegalCategory"("firmId", "typeId");

ALTER TABLE "LibraryDocType"
ADD CONSTRAINT "LibraryDocType_firmId_fkey"
FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LegalCategory"
ADD CONSTRAINT "LegalCategory_typeId_fkey"
FOREIGN KEY ("typeId") REFERENCES "LibraryDocType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LibraryDocument"
ADD CONSTRAINT "LibraryDocument_typeId_fkey"
FOREIGN KEY ("typeId") REFERENCES "LibraryDocType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
