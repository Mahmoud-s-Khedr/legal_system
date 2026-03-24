CREATE INDEX IF NOT EXISTS "User_firmId_email_idx"
  ON "User" ("firmId", "email");

CREATE INDEX IF NOT EXISTS "Invitation_firmId_status_expiresAt_idx"
  ON "Invitation" ("firmId", "status", "expiresAt");

CREATE INDEX IF NOT EXISTS "Client_firmId_deletedAt_createdAt_idx"
  ON "Client" ("firmId", "deletedAt", "createdAt");

CREATE INDEX IF NOT EXISTS "Case_firmId_deletedAt_idx"
  ON "Case" ("firmId", "deletedAt");

CREATE INDEX IF NOT EXISTS "Case_firmId_updatedAt_idx"
  ON "Case" ("firmId", "updatedAt");

CREATE INDEX IF NOT EXISTS "CaseSession_caseId_sessionDatetime_idx"
  ON "CaseSession" ("caseId", "sessionDatetime");

CREATE INDEX IF NOT EXISTS "CaseSession_assignedLawyerId_sessionDatetime_idx"
  ON "CaseSession" ("assignedLawyerId", "sessionDatetime");

CREATE INDEX IF NOT EXISTS "Task_firmId_status_deletedAt_idx"
  ON "Task" ("firmId", "status", "deletedAt");

CREATE INDEX IF NOT EXISTS "Task_assignedToId_status_idx"
  ON "Task" ("assignedToId", "status");

CREATE INDEX IF NOT EXISTS "Document_firmId_deletedAt_createdAt_idx"
  ON "Document" ("firmId", "deletedAt", "createdAt");

CREATE INDEX IF NOT EXISTS "Document_caseId_idx"
  ON "Document" ("caseId");
