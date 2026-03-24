DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "User"
    GROUP BY "firmId", "email"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add unique constraint User(firmId, email): duplicate rows exist';
  END IF;
END $$;

DROP INDEX IF EXISTS "User_firmId_email_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "User_firmId_email_key"
  ON "User" ("firmId", "email");
