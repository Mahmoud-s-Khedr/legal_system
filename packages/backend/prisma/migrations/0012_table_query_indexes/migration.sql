-- Table-query performance indexes for server-side searching/sorting/pagination

-- ─── CaseSession / Hearings ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS case_session_case_created_idx
  ON "CaseSession" ("caseId", "createdAt");
CREATE INDEX IF NOT EXISTS case_session_session_datetime_idx
  ON "CaseSession" ("sessionDatetime");

-- ─── Tasks ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS task_firm_deleted_due_idx
  ON "Task" ("firmId", "deletedAt", "dueAt");
CREATE INDEX IF NOT EXISTS task_firm_deleted_created_idx
  ON "Task" ("firmId", "deletedAt", "createdAt");

-- ─── Documents ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS document_firm_deleted_updated_idx
  ON "Document" ("firmId", "deletedAt", "updatedAt");
CREATE INDEX IF NOT EXISTS document_firm_deleted_type_created_idx
  ON "Document" ("firmId", "deletedAt", "type", "createdAt");
CREATE INDEX IF NOT EXISTS document_client_idx
  ON "Document" ("clientId");

-- ─── Invoices ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS invoice_firm_created_idx
  ON "Invoice" ("firmId", "createdAt");
CREATE INDEX IF NOT EXISTS invoice_firm_status_due_idx
  ON "Invoice" ("firmId", "status", "dueDate");
CREATE INDEX IF NOT EXISTS invoice_firm_client_created_idx
  ON "Invoice" ("firmId", "clientId", "createdAt");
CREATE INDEX IF NOT EXISTS invoice_firm_case_created_idx
  ON "Invoice" ("firmId", "caseId", "createdAt");

-- ─── Notifications ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS notification_firm_user_read_created_idx
  ON "Notification" ("firmId", "userId", "isRead", "createdAt");
CREATE INDEX IF NOT EXISTS notification_firm_user_type_created_idx
  ON "Notification" ("firmId", "userId", "type", "createdAt");

