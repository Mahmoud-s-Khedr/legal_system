-- Hybrid document search substrate
-- Adds normalized text for trigram/substring matching while keeping existing FTS vector.
-- Note: GIN trigram index build time scales with Document row count/content size.

CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "searchTextNormalized" TEXT
  GENERATED ALWAYS AS (
    lower(
      immutable_unaccent(
        trim(
          coalesce("title", '') || ' ' ||
          coalesce("fileName", '') || ' ' ||
          coalesce("contentText", '')
        )
      )
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS document_search_text_normalized_trgm_idx
  ON "Document"
  USING gin ("searchTextNormalized" gin_trgm_ops);
