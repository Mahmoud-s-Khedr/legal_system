ALTER TABLE "CaseCourt"
  ADD COLUMN IF NOT EXISTS "courtType" TEXT,
  ADD COLUMN IF NOT EXISTS "governorateValue" TEXT,
  ADD COLUMN IF NOT EXISTS "cityValue" TEXT;

CREATE INDEX IF NOT EXISTS "CaseCourt_governorateValue_idx"
  ON "CaseCourt" ("governorateValue");

CREATE INDEX IF NOT EXISTS "CaseCourt_cityValue_idx"
  ON "CaseCourt" ("cityValue");
