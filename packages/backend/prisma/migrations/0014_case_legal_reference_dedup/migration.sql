-- Remove duplicate rows so unique indexes can be applied safely.
-- Keep the newest row per uniqueness bucket.
WITH ranked_non_null AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY "caseId", "documentId", "articleId"
      ORDER BY "createdAt" DESC, id DESC
    ) AS rn
  FROM "CaseLegalReference"
  WHERE "articleId" IS NOT NULL
), ranked_null AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY "caseId", "documentId"
      ORDER BY "createdAt" DESC, id DESC
    ) AS rn
  FROM "CaseLegalReference"
  WHERE "articleId" IS NULL
)
DELETE FROM "CaseLegalReference"
WHERE id IN (
  SELECT id FROM ranked_non_null WHERE rn > 1
  UNION ALL
  SELECT id FROM ranked_null WHERE rn > 1
);

CREATE UNIQUE INDEX "CaseLegalReference_case_document_article_unique"
  ON "CaseLegalReference" ("caseId", "documentId", "articleId")
  WHERE "articleId" IS NOT NULL;

CREATE UNIQUE INDEX "CaseLegalReference_case_document_unique_null_article"
  ON "CaseLegalReference" ("caseId", "documentId")
  WHERE "articleId" IS NULL;
