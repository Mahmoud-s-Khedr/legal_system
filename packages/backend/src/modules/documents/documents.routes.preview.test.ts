import { beforeEach, describe, expect, it, vi } from "vitest";

const streamDocumentPreview = vi.fn();
const recordDocumentPrintAudit = vi.fn();
const recordDocumentScanAudit = vi.fn();
const requirePermission = vi.fn((permission: string) => `perm:${permission}`);

vi.mock("../../middleware/requireAuth.js", () => ({
  requireAuth: vi.fn()
}));

vi.mock("../../middleware/requirePermission.js", () => ({
  requirePermission
}));

vi.mock("../../utils/auditContext.js", () => ({
  getAuditContext: vi.fn(() => ({ ipAddress: "127.0.0.1", userAgent: "vitest" }))
}));

vi.mock("./documents.service.js", () => ({
  ALLOWED_MIME_TYPES: ["application/pdf"],
  createDocument: vi.fn(),
  getDocument: vi.fn(),
  getDownloadUrl: vi.fn(),
  listDocuments: vi.fn(),
  softDeleteDocument: vi.fn(),
  streamDocument: vi.fn(),
  streamDocumentPreview,
  updateDocument: vi.fn(),
  uploadNewVersion: vi.fn(),
  recordDocumentPrintAudit,
  recordDocumentScanAudit
}));

const { registerDocumentRoutes } = await import("./documents.routes.js");

function createApp() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    storage: {
      put: vi.fn(),
      delete: vi.fn(),
      get: vi.fn(),
      getSignedUrl: vi.fn(),
      supportsSignedUrls: false
    }
  };
}

describe("document preview route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers /api/documents/:id/preview and delegates to streamDocumentPreview", async () => {
    const app = createApp();
    await registerDocumentRoutes(app as never, {} as never);

    const previewCall = app.get.mock.calls.find((call) => call[0] === "/api/documents/:id/preview");
    expect(previewCall).toBeDefined();
    const handler = previewCall?.[2] as (request: unknown, reply: unknown) => Promise<unknown>;
    const reply = {};
    const request = {
      sessionUser: { firmId: "firm-1", permissions: ["documents:read"] },
      params: { id: "doc-1" }
    };

    await handler(request, reply);

    expect(streamDocumentPreview).toHaveBeenCalledWith(
      request.sessionUser,
      "doc-1",
      app.storage,
      reply
    );
  });

  it("registers print/scan audit routes with explicit permission guards", async () => {
    const app = createApp();
    await registerDocumentRoutes(app as never, {} as never);

    const printAuditCall = app.post.mock.calls.find(
      (call) => call[0] === "/api/documents/:id/print-audit"
    );
    const scanAuditCall = app.post.mock.calls.find(
      (call) => call[0] === "/api/documents/scan-audit"
    );

    expect(printAuditCall).toBeDefined();
    expect(scanAuditCall).toBeDefined();
    expect(requirePermission).toHaveBeenCalledWith("documents:print");
    expect(requirePermission).toHaveBeenCalledWith("documents:scan");
  });
});
