import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const mockPrisma = {
  client: {
    create: vi.fn(),
    findFirst: vi.fn()
  },
  case: {
    create: vi.fn()
  }
};

const writeAuditLog = vi.fn();
const createTableSession = vi.fn();
const getTableSession = vi.fn();

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../../services/audit.service.js", () => ({ writeAuditLog }));
vi.mock("../../utils/tableSessionStore.js", () => ({
  createTableSession,
  getTableSession
}));

const {
  executeCaseImport,
  executeCaseImportPreview,
  executeClientImportPreview,
  listImportPreviewRows,
  previewClientImport
} = await import("./import.service.js");

const actor = makeSessionUser();

function csvStream(csv: string) {
  return Readable.from([Buffer.from(csv)]);
}

beforeEach(() => {
  vi.clearAllMocks();
  createTableSession.mockReturnValue({
    id: "import_preview_1",
    expiresAt: "2026-04-30T00:00:00.000Z"
  });
});

describe("import.service", () => {
  it("previews client CSV and stores parsed rows", async () => {
    const result = await previewClientImport(
      csvStream("name,email\nAcme,test@example.com\nBad,not-email\n"),
      "text/csv",
      actor
    );

    expect(createTableSession).toHaveBeenCalledWith(
      "import_preview",
      `${actor.firmId}:${actor.id}`,
      expect.any(Array),
      { meta: { entityType: "clients" } }
    );
    expect(result).toMatchObject({ total: 2, valid: 1, invalid: 1 });
  });

  it("returns null when preview session is missing", () => {
    getTableSession.mockReturnValueOnce(null);
    expect(
      listImportPreviewRows(actor, "missing", { page: 1, limit: 10 })
    ).toBeNull();
  });

  it("lists preview rows with status filter", () => {
    getTableSession.mockReturnValueOnce({
      expiresAt: Date.parse("2026-04-30T00:00:00.000Z"),
      rows: [
        { rowNumber: 2, data: { name: "Acme" }, errors: [] },
        { rowNumber: 3, data: { name: "Bad" }, errors: ["email: Invalid email"] }
      ]
    });

    const result = listImportPreviewRows(actor, "import_preview_1", {
      page: 1,
      limit: 10,
      status: "invalid"
    });

    expect(result?.total).toBe(1);
    expect(result?.items[0]?.rowNumber).toBe(3);
  });

  it("executes client import preview with mixed success rows", async () => {
    getTableSession.mockReturnValueOnce({
      meta: { entityType: "clients" },
      rows: [
        { rowNumber: 2, data: { name: "Acme", email: "ok@test.com", type: "COMPANY" }, errors: [] },
        { rowNumber: 3, data: { name: "Bad", email: "invalid", type: "COMPANY" }, errors: [] }
      ]
    });
    mockPrisma.client.create.mockResolvedValueOnce({ id: "c1" });

    const result = await executeClientImportPreview(actor, "import_preview_1", {
      ipAddress: "127.0.0.1"
    });

    expect(result).toMatchObject({ imported: 1, failed: 1 });
    expect(writeAuditLog).toHaveBeenCalledTimes(1);
  });

  it("executes case import and reports rows with missing client binding", async () => {
    const result = await executeCaseImport(
      csvStream(
        "title,caseNumber,type,status\nLease Dispute,2026/1,CIVIL,ACTIVE\n"
      ),
      "text/csv",
      actor,
      {}
    );

    expect(mockPrisma.case.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ imported: 0, failed: 1 });
    expect(result.errors[0]?.error).toContain("Invalid");
  });

  it("executes case import preview and fails rows without resolvable client", async () => {
    getTableSession.mockReturnValueOnce({
      meta: { entityType: "cases" },
      rows: [
        {
          rowNumber: 2,
          data: {
            title: "Case A",
            caseNumber: "2026/1",
            type: "CIVIL",
            status: "ACTIVE"
          },
          errors: []
        }
      ]
    });

    const result = await executeCaseImportPreview(actor, "import_preview_1", {});

    expect(result).toMatchObject({ imported: 0, failed: 1 });
    expect(result?.errors[0]?.error).toContain("client_id or client_name required");
  });
});
