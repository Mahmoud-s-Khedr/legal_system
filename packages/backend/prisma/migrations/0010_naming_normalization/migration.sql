-- Normalize naming fields across Client, LegalCategory, and LibraryDocument.
-- 1) Client uses a single canonical name column.
-- 2) LibraryDocument uses a single title column.
-- 3) LegalCategory stores explicit AR/EN/FR names.

-- LegalCategory locale columns
ALTER TABLE "LegalCategory"
  ADD COLUMN IF NOT EXISTS "nameEn" TEXT,
  ADD COLUMN IF NOT EXISTS "nameFr" TEXT;

UPDATE "LegalCategory"
SET
  "nameAr" = COALESCE("nameAr", "name"),
  "nameEn" = COALESCE("nameEn", "name"),
  "nameFr" = COALESCE("nameFr", "name")
WHERE
  "nameAr" IS NULL
  OR "nameEn" IS NULL
  OR "nameFr" IS NULL;

ALTER TABLE "LegalCategory"
  ALTER COLUMN "nameAr" SET NOT NULL,
  ALTER COLUMN "nameEn" SET NOT NULL,
  ALTER COLUMN "nameFr" SET NOT NULL;

ALTER TABLE "LegalCategory"
  DROP COLUMN IF EXISTS "name";

-- Remove deprecated multilingual duplicate columns
ALTER TABLE "Client"
  DROP COLUMN IF EXISTS "nameAr";

ALTER TABLE "LibraryDocument"
  DROP COLUMN IF EXISTS "titleAr";

DROP INDEX IF EXISTS client_name_ar_trgm_idx;
