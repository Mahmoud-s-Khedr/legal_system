import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";
import { DocumentType } from "@elms/shared";
import { makeSessionUser } from "../../test-utils/session-user.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockDocument = {
  count: vi.fn(),
  findMany: vi.fn(),
  findFirstOrThrow: vi.fn(),
  create: vi.fn(),
  update: vi.fn()
};
const mockDocumentVersion = {
  create: vi.fn()
};
const mockAuditLog = { create: vi.fn() };

const mockPrisma = {
  document: mockDocument,
  documentVersion: mockDocumentVersion,
  auditLog: mockAuditLog
};

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn((_prisma: unknown, _firmId: string, fn: (tx: typeof mockPrisma) => unknown) =>
    fn(mockPrisma)
  )
}));
vi.mock("../../services/audit.service.js", () => ({
  writeAuditLog: vi.fn()
}));
vi.mock("../../jobs/extractionDispatcher.js", () => ({
  dispatchExtraction: vi.fn().mockResolvedValue(undefined)
}));
vi.mock("../editions/editionPolicy.js", () => ({
  hasEditionFeature: vi.fn().mockReturnValue(false)
}));

const {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  ALLOWED_MIME_TYPES
} = await import("./documents.service.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

const actor = makeSessionUser({
  email: "admin@elms.test",
  fullName: "Admin",
  permissions: ["documents:read", "documents:create", "documents:update", "documents:delete"]
});

const audit = { actor };
const now = new Date("2026-03-21T00:00:00.000Z");

const mockEnv = {
  OCR_BACKEND: "tesseract",
  AUTH_MODE: "LOCAL"
} as never;

const mockStorage = {
  put: vi.fn().mockResolvedValue(undefined),
  get: vi.fn(),
  delete: vi.fn().mockResolvedValue(undefined),
  getSignedUrl: vi.fn(),
  supportsSignedUrls: false
};

function makeDocumentRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "doc-1",
    firmId: "firm-1",
    caseId: "case-1",
    clientId: null,
    uploadedById: "user-1",
    title: "Contract.pdf",
    fileName: "Contract.pdf",
    mimeType: "application/pdf",
    storageKey: "firm-1/doc-1/Contract.pdf",
    type: "CONTRACT",
    extractionStatus: "PENDING",
    ocrBackend: "TESSERACT",
    contentText: null,
    createdAt: now,
    updatedAt: now,
    versions: [],
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── ALLOWED_MIME_TYPES ────────────────────────────────────────────────────────

describe("ALLOWED_MIME_TYPES", () => {
  it("includes PDF and DOCX", () => {
    expect(ALLOWED_MIME_TYPES).toContain("application/pdf");
    expect(ALLOWED_MIME_TYPES).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  });

  it("includes common image types", () => {
    expect(ALLOWED_MIME_TYPES).toContain("image/jpeg");
    expect(ALLOWED_MIME_TYPES).toContain("image/png");
  });
});

// ── listDocuments ──────────────────────────────────────────────────────────────

describe("listDocuments", () => {
  it("returns paginated documents filtered by firmId", async () => {
    mockDocument.count.mockResolvedValue(2);
    mockDocument.findMany.mockResolvedValue([makeDocumentRecord(), makeDocumentRecord({ id: "doc-2" })]);

    const result = await listDocuments(actor, {}, { page: 1, limit: 20 });

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].firmId).toBe("firm-1");
  });

  it("applies deletedAt: null filter to exclude soft-deleted documents", async () => {
    mockDocument.count.mockResolvedValue(0);
    mockDocument.findMany.mockResolvedValue([]);

    await listDocuments(actor, {}, { page: 1, limit: 20 });

    expect(mockDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ firmId: "firm-1", deletedAt: null })
      })
    );
  });

  it("filters by caseId when provided", async () => {
    mockDocument.count.mockResolvedValue(0);
    mockDocument.findMany.mockResolvedValue([]);

    await listDocuments(actor, { caseId: "case-42" }, { page: 1, limit: 10 });

    expect(mockDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ caseId: "case-42" })
      })
    );
  });

  it("applies pagination correctly", async () => {
    mockDocument.count.mockResolvedValue(100);
    mockDocument.findMany.mockResolvedValue([]);

    await listDocuments(actor, {}, { page: 3, limit: 10 });

    expect(mockDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });
});

// ── getDocument ────────────────────────────────────────────────────────────────

describe("getDocument", () => {
  it("returns mapped document DTO", async () => {
    mockDocument.findFirstOrThrow.mockResolvedValue(makeDocumentRecord());

    const result = await getDocument(actor, "doc-1");

    expect(result.id).toBe("doc-1");
    expect(result.title).toBe("Contract.pdf");
    expect(result.extractionStatus).toBe("PENDING");
  });

  it("queries by id and firmId for tenant isolation", async () => {
    mockDocument.findFirstOrThrow.mockResolvedValue(makeDocumentRecord());

    await getDocument(actor, "doc-1");

    expect(mockDocument.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "doc-1", firmId: "firm-1", deletedAt: null })
      })
    );
  });
});

// ── createDocument ─────────────────────────────────────────────────────────────

describe("createDocument", () => {
  const validPayload = {
    title: "Contract",
    type: "CONTRACT",
    caseId: "case-1",
    fileName: "Contract.pdf",
    mimeType: "application/pdf" as const,
    stream: Readable.from(["test content"])
  };

  it("rejects unsupported MIME types", async () => {
    const badPayload = { ...validPayload, mimeType: "text/plain" as never };

    await expect(createDocument(actor, badPayload, mockEnv, mockStorage, audit)).rejects.toThrow(
      "Unsupported file type: text/plain"
    );

    expect(mockStorage.put).not.toHaveBeenCalled();
  });

  it("uploads to storage before creating DB record", async () => {
    mockDocument.create.mockResolvedValue(makeDocumentRecord());
    mockDocumentVersion.create.mockResolvedValue({});

    await createDocument(actor, validPayload, mockEnv, mockStorage, audit);

    // storage.put must be called before document.create
    const putCallOrder = mockStorage.put.mock.invocationCallOrder[0];
    const createCallOrder = mockDocument.create.mock.invocationCallOrder[0];
    expect(putCallOrder).toBeLessThan(createCallOrder);
  });

  it("creates DB record with PENDING extraction status", async () => {
    mockDocument.create.mockResolvedValue(makeDocumentRecord());
    mockDocumentVersion.create.mockResolvedValue({});

    await createDocument(actor, validPayload, mockEnv, mockStorage, audit);

    expect(mockDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firmId: "firm-1",
          uploadedById: "user-1",
          extractionStatus: "PENDING"
        })
      })
    );
  });

  it("creates a version-1 record for the document", async () => {
    mockDocument.create.mockResolvedValue(makeDocumentRecord());
    mockDocumentVersion.create.mockResolvedValue({});

    await createDocument(actor, validPayload, mockEnv, mockStorage, audit);

    expect(mockDocumentVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ versionNumber: 1 })
      })
    );
  });

  it("cleans up storage if DB transaction fails", async () => {
    mockDocument.create.mockRejectedValue(new Error("DB error"));
    mockDocumentVersion.create.mockResolvedValue({});

    await expect(createDocument(actor, validPayload, mockEnv, mockStorage, audit)).rejects.toThrow("DB error");

    expect(mockStorage.delete).toHaveBeenCalled();
  });

  it("sanitizes filenames with special characters", async () => {
    const payload = { ...validPayload, fileName: "../../../etc/passwd.pdf" };
    mockDocument.create.mockResolvedValue(makeDocumentRecord());
    mockDocumentVersion.create.mockResolvedValue({});

    await createDocument(actor, payload, mockEnv, mockStorage, audit);

    // storageKey should not contain path traversal
    const storageKey: string = mockDocument.create.mock.calls[0][0].data.storageKey;
    expect(storageKey).not.toContain("..");
  });
});

// ── updateDocument ─────────────────────────────────────────────────────────────

describe("updateDocument", () => {
  it("updates title and type", async () => {
    mockDocument.findFirstOrThrow.mockResolvedValue(makeDocumentRecord());
    mockDocument.update.mockResolvedValue(
      makeDocumentRecord({ title: "Updated Contract", type: DocumentType.COURT_FILING })
    );

    const result = await updateDocument(
      actor,
      "doc-1",
      { title: "Updated Contract", type: DocumentType.COURT_FILING },
      audit
    );

    expect(mockDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Updated Contract", type: DocumentType.COURT_FILING })
      })
    );
    expect(result.title).toBe("Updated Contract");
  });

  it("queries with firmId to enforce tenant isolation", async () => {
    mockDocument.findFirstOrThrow.mockResolvedValue(makeDocumentRecord());
    mockDocument.update.mockResolvedValue(makeDocumentRecord());

    await updateDocument(actor, "doc-1", { title: "New Title" }, audit);

    expect(mockDocument.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ firmId: "firm-1" })
      })
    );
  });
});
