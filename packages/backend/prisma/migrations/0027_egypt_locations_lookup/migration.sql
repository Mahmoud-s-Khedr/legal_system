ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "city" TEXT;

CREATE TABLE IF NOT EXISTS "GovernorateLookup" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL,
  "labelAr" TEXT NOT NULL,
  "labelEn" TEXT NOT NULL,
  "labelFr" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernorateLookup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GovernorateLookup_key_key"
  ON "GovernorateLookup"("key");

CREATE INDEX IF NOT EXISTS "GovernorateLookup_isActive_sortOrder_idx"
  ON "GovernorateLookup"("isActive", "sortOrder");

CREATE TABLE IF NOT EXISTS "CityLookup" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "governorateId" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "labelAr" TEXT NOT NULL,
  "labelEn" TEXT NOT NULL,
  "labelFr" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CityLookup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CityLookup_governorateId_fkey" FOREIGN KEY ("governorateId")
    REFERENCES "GovernorateLookup"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CityLookup_governorateId_key_key"
  ON "CityLookup"("governorateId", "key");

CREATE INDEX IF NOT EXISTS "CityLookup_governorateId_isActive_sortOrder_idx"
  ON "CityLookup"("governorateId", "isActive", "sortOrder");
