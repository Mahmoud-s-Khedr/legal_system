import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");

function parseModelNames(schema: string): string[] {
  const matches = schema.matchAll(/^model\s+(\w+)\s+\{/gm);
  return Array.from(matches, (m) => m[1]);
}

async function main() {
  const schema = fs.readFileSync(schemaPath, "utf8");
  const models = parseModelNames(schema);

  const tableChecks: Record<string, () => Promise<number>> = {
    LookupOption: () => prisma.lookupOption.count(),
    Firm: () => prisma.firm.count(),
    FirmSettings: () => prisma.firmSettings.count(),
    Role: () => prisma.role.count(),
    Permission: () => prisma.permission.count(),
    RolePermission: () => prisma.rolePermission.count(),
    User: () => prisma.user.count(),
    Invitation: () => prisma.invitation.count(),
    Client: () => prisma.client.count(),
    ClientContact: () => prisma.clientContact.count(),
    Case: () => prisma.case.count(),
    CaseCourt: () => prisma.caseCourt.count(),
    CaseAssignment: () => prisma.caseAssignment.count(),
    CaseParty: () => prisma.caseParty.count(),
    CaseStatusHistory: () => prisma.caseStatusHistory.count(),
    CaseSession: () => prisma.caseSession.count(),
    PowerOfAttorney: () => prisma.powerOfAttorney.count(),
    Task: () => prisma.task.count(),
    Document: () => prisma.document.count(),
    DocumentVersion: () => prisma.documentVersion.count(),
    DocumentTemplate: () => prisma.documentTemplate.count(),
    Invoice: () => prisma.invoice.count(),
    InvoiceItem: () => prisma.invoiceItem.count(),
    Payment: () => prisma.payment.count(),
    ClientCreditBalance: () => prisma.clientCreditBalance.count(),
    ClientCreditEntry: () => prisma.clientCreditEntry.count(),
    InvoiceCreditApplication: () => prisma.invoiceCreditApplication.count(),
    Expense: () => prisma.expense.count(),
    Event: () => prisma.event.count(),
    Notification: () => prisma.notification.count(),
    NotificationPreference: () => prisma.notificationPreference.count(),
    AuditLog: () => prisma.auditLog.count(),
    LegalCategory: () => prisma.legalCategory.count(),
    LibraryDocument: () => prisma.libraryDocument.count(),
    LegislationArticle: () => prisma.legislationArticle.count(),
    LibraryTag: () => prisma.libraryTag.count(),
    LibraryDocumentTag: () => prisma.libraryDocumentTag.count(),
    LibraryAnnotation: () => prisma.libraryAnnotation.count(),
    CaseLegalReference: () => prisma.caseLegalReference.count(),
    ResearchSession: () => prisma.researchSession.count(),
    ResearchMessage: () => prisma.researchMessage.count(),
    ResearchSessionSource: () => prisma.researchSessionSource.count(),
    CustomReport: () => prisma.customReport.count(),
    ClientPortalInvite: () => prisma.clientPortalInvite.count(),
    GoogleCalendarToken: () => prisma.googleCalendarToken.count()
  };

  const coverage: Array<{ model: string; ok: boolean; count: number | null; reason?: string }> = [];

  for (const model of models) {
    const check = tableChecks[model];
    if (!check) {
      coverage.push({ model, ok: false, count: null, reason: "No audit check defined" });
      continue;
    }
    const count = await check();
    coverage.push({ model, ok: count > 0, count, reason: count > 0 ? undefined : "No rows seeded" });
  }

  const routeDomainChecks = {
    auth: await prisma.user.count({ where: { email: { contains: "@elms.local" } } }),
    clients: await prisma.client.count({ where: { deletedAt: null } }),
    cases: await prisma.case.count({ where: { deletedAt: null } }),
    hearings: await prisma.caseSession.count(),
    tasks: await prisma.task.count({ where: { deletedAt: null } }),
    documents: await prisma.document.count({ where: { deletedAt: null } }),
    billing: await prisma.invoice.count(),
    notifications: await prisma.notification.count(),
    portal: await prisma.clientPortalInvite.count(),
    library: await prisma.libraryDocument.count(),
    research: await prisma.researchSession.count(),
    integrations: await prisma.googleCalendarToken.count()
  };

  const missingModels = coverage.filter((x) => !x.ok);
  const missingDomains = Object.entries(routeDomainChecks).filter(([, count]) => count < 1);

  if (missingModels.length > 0) {
    console.error("[seed-audit] Missing model coverage:");
    for (const m of missingModels) {
      console.error(` - ${m.model}: ${m.reason ?? "unknown"}`);
    }
  }

  if (missingDomains.length > 0) {
    console.error("[seed-audit] Missing route-domain preconditions:");
    for (const [domain, count] of missingDomains) {
      console.error(` - ${domain}: count=${count}`);
    }
  }

  if (missingModels.length > 0 || missingDomains.length > 0) {
    process.exitCode = 1;
  } else {
    console.log(`[seed-audit] OK. Models=${coverage.length} Domains=${Object.keys(routeDomainChecks).length}`);
  }
}

main()
  .catch((error) => {
    console.error("[seed-audit] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
