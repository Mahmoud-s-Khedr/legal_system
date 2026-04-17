-- Backfill row-level security coverage for firm-scoped tables that were
-- previously protected only at application query level.

-- Strict firm-bound tables
ALTER TABLE "FirmSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PowerOfAttorney" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClientPortalInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GoogleCalendarToken" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firmsettings_tenant_isolation" ON "FirmSettings"
  FOR ALL
  USING ("firmId"::text = current_setting('app.current_firm_id', true));

CREATE POLICY "invitation_tenant_isolation" ON "Invitation"
  FOR ALL
  USING ("firmId"::text = current_setting('app.current_firm_id', true));

CREATE POLICY "power_of_attorney_tenant_isolation" ON "PowerOfAttorney"
  FOR ALL
  USING ("firmId"::text = current_setting('app.current_firm_id', true));

CREATE POLICY "event_tenant_isolation" ON "Event"
  FOR ALL
  USING ("firmId"::text = current_setting('app.current_firm_id', true));

CREATE POLICY "custom_report_tenant_isolation" ON "CustomReport"
  FOR ALL
  USING ("firmId"::text = current_setting('app.current_firm_id', true));

CREATE POLICY "client_portal_invite_tenant_isolation" ON "ClientPortalInvite"
  FOR ALL
  USING ("firmId"::text = current_setting('app.current_firm_id', true));

CREATE POLICY "google_calendar_token_tenant_isolation" ON "GoogleCalendarToken"
  FOR ALL
  USING ("firmId"::text = current_setting('app.current_firm_id', true));

-- Shared + firm rows (SYSTEM rows use NULL firmId)
ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LegalCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentTemplate" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_visibility" ON "Role"
  FOR ALL
  USING (
    "firmId" IS NULL
    OR "firmId"::text = current_setting('app.current_firm_id', true)
  );

CREATE POLICY "legal_category_visibility" ON "LegalCategory"
  FOR ALL
  USING (
    "firmId" IS NULL
    OR "firmId"::text = current_setting('app.current_firm_id', true)
  );

CREATE POLICY "document_template_visibility" ON "DocumentTemplate"
  FOR ALL
  USING (
    "firmId" IS NULL
    OR "firmId"::text = current_setting('app.current_firm_id', true)
  );
