-- Link documents to tasks
-- Adds nullable task relation and supporting index for task-scoped document queries.

ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "taskId" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Document_taskId_fkey'
  ) THEN
    ALTER TABLE "Document"
      ADD CONSTRAINT "Document_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "Task"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Document_taskId_idx" ON "Document" ("taskId");
