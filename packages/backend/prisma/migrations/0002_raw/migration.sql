CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- unaccent() is not IMMUTABLE by default, which prevents its use in GENERATED
-- ALWAYS AS STORED columns.  This wrapper is declared IMMUTABLE by pinning the
-- dictionary, which is the standard PostgreSQL workaround.
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$func$
  SELECT public.unaccent('unaccent'::regdictionary, $1)
$func$;

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Case" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LibraryDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LibraryAnnotation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ResearchSession" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_sql text;
BEGIN
  FOR policy_sql IN
    SELECT format(
      'CREATE POLICY %I ON %I USING ("firmId"::text = current_setting(''app.current_firm_id'', true));',
      lower(table_name) || '_tenant_isolation',
      table_name
    )
    FROM (VALUES
      ('User'),
      ('Client'),
      ('Case'),
      ('Task'),
      ('Document'),
      ('Invoice'),
      ('Expense'),
      ('Notification'),
      ('AuditLog'),
      ('LibraryAnnotation'),
      ('ResearchSession')
    ) AS tenant_tables(table_name)
  LOOP
    EXECUTE policy_sql;
  END LOOP;
END $$;

CREATE POLICY library_document_visibility ON "LibraryDocument"
  USING ("firmId" IS NULL OR "firmId"::text = current_setting('app.current_firm_id', true));

CREATE UNIQUE INDEX IF NOT EXISTS user_email_active_idx
  ON "User" ("email")
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS client_name_trgm_idx
  ON "Client"
  USING gin ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS client_name_ar_trgm_idx
  ON "Client"
  USING gin ("nameAr" gin_trgm_ops);

ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("title", ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("contentText", ''))), 'B')
  ) STORED;

ALTER TABLE "LibraryDocument"
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("title", ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("legalPrinciple", ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("contentText", ''))), 'B')
  ) STORED;

ALTER TABLE "LegislationArticle"
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("articleNumber", ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("body", ''))), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS document_search_vector_idx
  ON "Document"
  USING gin (search_vector);

CREATE INDEX IF NOT EXISTS library_document_search_vector_idx
  ON "LibraryDocument"
  USING gin (search_vector);

CREATE INDEX IF NOT EXISTS legislation_article_search_vector_idx
  ON "LegislationArticle"
  USING gin (search_vector);
