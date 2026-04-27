import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const mockPrisma = {
  documentTemplate: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn()
  },
  case: { findFirst: vi.fn() },
  caseSession: { findFirst: vi.fn() }
};

const withTenant = vi.fn();
const writeAuditLog = vi.fn();
const htmlToDocx = vi.fn(async () => Buffer.from("docx"));

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn((...args: unknown[]) => withTenant(...args))
}));
vi.mock("../../services/audit.service.js", () => ({ writeAuditLog }));
vi.mock("html-to-docx", () => ({ default: htmlToDocx }));

const {
  substitute,
  htmlToPlainText,
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  renderTemplate,
  exportTemplateDocx
} = await import("./templates.service.js");

const actor = makeSessionUser({ firmId: "f-1" });
const audit = { ipAddress: "127.0.0.1", userAgent: "vitest" };

const now = new Date("2026-04-22T00:00:00.000Z");
const templateRow = {
  id: "tpl-1",
  firmId: "f-1",
  name: "Notice",
  language: "AR",
  body: "<p>Hello {{caseName}}</p>",
  isSystem: false,
  createdAt: now,
  updatedAt: now
};

beforeEach(() => {
  vi.clearAllMocks();
  withTenant.mockImplementation(async (_prisma, _firmId, fn) => fn(mockPrisma));
});

describe("templates.service", () => {
  it("replaces placeholders and converts html to plain text", () => {
    expect(substitute("{{caseName}} {{unknown}}", { caseName: "Case A" })).toBe("Case A {{unknown}}");
    expect(htmlToPlainText("<p>Hello</p><p>World<br/>Again</p>")).toBe("Hello\nWorld\nAgain");
    expect(htmlToPlainText("Line1\n\nLine2")).toBe("Line1\n\nLine2");
  });

  it("lists and gets templates", async () => {
    mockPrisma.documentTemplate.findMany.mockResolvedValue([templateRow]);
    mockPrisma.documentTemplate.findFirst.mockResolvedValue(templateRow);

    const listed = await listTemplates(actor);
    const single = await getTemplate(actor, "tpl-1");

    expect(listed).toHaveLength(1);
    expect(single?.id).toBe("tpl-1");
  });

  it("creates template and writes audit", async () => {
    mockPrisma.documentTemplate.create.mockResolvedValue(templateRow);

    const created = await createTemplate(
      actor,
      { name: "Notice", body: "<p>Hello</p>", language: "AR" },
      audit as never
    );

    expect(mockPrisma.documentTemplate.create).toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalledWith(
      mockPrisma,
      audit,
      expect.objectContaining({ action: "CREATE", entityType: "DocumentTemplate", entityId: "tpl-1" })
    );
    expect(created.name).toBe("Notice");
  });

  it("updates/deletes template with not-found branches", async () => {
    mockPrisma.documentTemplate.findFirst
      .mockResolvedValueOnce(templateRow)
      .mockResolvedValueOnce(templateRow)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockPrisma.documentTemplate.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    mockPrisma.documentTemplate.deleteMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    const updated = await updateTemplate(actor, "tpl-1", { name: "Updated" }, audit as never);
    expect(updated?.name).toBe("Notice");

    const notUpdated = await updateTemplate(actor, "tpl-1", { name: "Updated" }, audit as never);
    expect(notUpdated).toBeNull();

    const deleted = await deleteTemplate(actor, "tpl-1", audit as never);
    expect(deleted).toBe(true);

    const notDeleted = await deleteTemplate(actor, "tpl-1", audit as never);
    expect(notDeleted).toBe(false);
  });

  it("renders template with case context and handles missing template/case", async () => {
    mockPrisma.documentTemplate.findFirst.mockReset();
    mockPrisma.case.findFirst.mockReset();
    mockPrisma.caseSession.findFirst.mockReset();

    mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(null);
    const missingTemplate = await renderTemplate(actor, "missing", "case-1");
    expect(missingTemplate).toBeNull();

    mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(templateRow);
    mockPrisma.case.findFirst.mockResolvedValueOnce(null);
    const missingCase = await renderTemplate(actor, "tpl-1", "case-1");
    expect(missingCase).toBeNull();

    mockPrisma.documentTemplate.findFirst.mockResolvedValue(templateRow);
    mockPrisma.case.findFirst.mockResolvedValueOnce({
      id: "case-1",
      title: "Case A",
      caseNumber: "100",
      legalReferences: [
        {
          document: { title: "Civil Code" },
          article: { articleNumber: "12", title: "General scope" }
        }
      ],
      client: { name: "Client" },
      courts: [{ courtName: "Court", courtLevel: "First" }]
    });
    mockPrisma.caseSession.findFirst.mockResolvedValueOnce({ sessionDatetime: new Date("2026-05-01T00:00:00.000Z") });

    const rendered = await renderTemplate(actor, "tpl-1", "case-1");
    expect(rendered?.renderedHtml).toContain("Case A");
    expect(rendered?.variables.caseNumber).toBe("100");
    expect(rendered?.variables.legalReference).toBe("Civil Code § 12");
  });

  it("exports template and rendered docx variants", async () => {
    mockPrisma.documentTemplate.findFirst.mockReset();
    mockPrisma.case.findFirst.mockReset();
    mockPrisma.caseSession.findFirst.mockReset();
    mockPrisma.documentTemplate.findFirst.mockResolvedValue(templateRow);

    const templateDoc = await exportTemplateDocx(actor, "tpl-1", "template");
    expect(templateDoc?.fileName).toContain("elms-template-notice-");
    expect(templateDoc?.buffer.toString()).toContain("docx");

    const missingCaseId = await exportTemplateDocx(actor, "tpl-1", "rendered");
    expect(missingCaseId).toBeNull();

    mockPrisma.documentTemplate.findFirst.mockResolvedValue(templateRow);
    mockPrisma.case.findFirst.mockResolvedValueOnce({
      id: "case-1",
      title: "Case A",
      caseNumber: "100",
      legalReferences: [],
      client: { name: "Client" },
      courts: []
    });
    mockPrisma.caseSession.findFirst.mockResolvedValueOnce(null);

    const renderedDoc = await exportTemplateDocx(actor, "tpl-1", "rendered", "case-1");
    expect(renderedDoc?.fileName).toContain("elms-document-notice-case-1-");

    mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(null);
    const missingTemplate = await exportTemplateDocx(actor, "missing", "template");
    expect(missingTemplate).toBeNull();
  });
});
