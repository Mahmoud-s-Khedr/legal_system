-- Deduplicate system lookups and enforce unique system keys for LookupOption.

-- 1) Deduplicate system CourtLevel/CourtType rows by (entity,key), keep deterministic survivor.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "entity", "key"
      ORDER BY "isActive" DESC, "isSystem" DESC, "sortOrder" ASC, "createdAt" ASC, "id" ASC
    ) AS rn
  FROM "LookupOption"
  WHERE "firmId" IS NULL
    AND "entity" IN ('CourtLevel', 'CourtType')
)
DELETE FROM "LookupOption"
WHERE "id" IN (
  SELECT "id" FROM ranked WHERE rn > 1
);

-- 2) Keep CourtLevel strictly canonical (4 keys) and legacy values inactive.
UPDATE "LookupOption"
SET "isActive" = false,
    "isSystem" = true,
    "updatedAt" = now()
WHERE "firmId" IS NULL
  AND "entity" = 'CourtLevel'
  AND "key" NOT IN ('PARTIAL', 'PRIMARY', 'APPEAL', 'CASSATION');

-- 3) Enforce uniqueness for system rows where firmId IS NULL.
CREATE UNIQUE INDEX IF NOT EXISTS "LookupOption_system_entity_key_unique"
  ON "LookupOption" ("entity", "key")
  WHERE "firmId" IS NULL;
