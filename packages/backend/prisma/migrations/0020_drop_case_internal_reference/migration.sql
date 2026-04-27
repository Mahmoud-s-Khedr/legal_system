ALTER TABLE "Case"
  DROP COLUMN IF EXISTS "internalReference";

CREATE UNIQUE INDEX IF NOT EXISTS "CaseLegalReference_case_document_article_unique"
  ON "CaseLegalReference" ("caseId", "documentId", "articleId")
  WHERE "articleId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "CaseLegalReference_case_document_unique_null_article"
  ON "CaseLegalReference" ("caseId", "documentId")
  WHERE "articleId" IS NULL;
