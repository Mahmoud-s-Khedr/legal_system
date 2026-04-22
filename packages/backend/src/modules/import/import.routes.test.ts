import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermission = vi.fn((permission: string) => `perm:${permission}`);

const previewClientImport = vi.fn();
const executeClientImport = vi.fn();
const previewCaseImport = vi.fn();
const executeCaseImport = vi.fn();
const executeCaseImportPreview = vi.fn();
const executeClientImportPreview = vi.fn();
const listImportPreviewRows = vi.fn();

vi.mock("../../middleware/requireAuth.js", () => ({ requireAuth: "auth-guard" }));
vi.mock("../../middleware/requirePermission.js", () => ({ requirePermission }));
vi.mock("./import.service.js", () => ({
  previewClientImport,
  executeClientImport,
  previewCaseImport,
  executeCaseImport,
  executeCaseImportPreview,
  executeClientImportPreview,
  listImportPreviewRows
}));

const { registerImportRoutes } = await import("./import.routes.js");

function createApp() {
  return { get: vi.fn(), post: vi.fn() };
}

function findHandler(calls: unknown[][], path: string) {
  const call = calls.find((entry) => entry[0] === path);
  return call?.[2] as ((request: unknown, reply?: unknown) => Promise<unknown>) | undefined;
}

describe("registerImportRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists preview rows with pagination and returns 404 when preview missing", async () => {
    const app = createApp();
    await registerImportRoutes(app as never);

    const handler = findHandler(app.get.mock.calls, "/api/import/previews/:previewId/rows");
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };

    listImportPreviewRows.mockReturnValueOnce(null);
    const missing = await handler!(
      { params: { previewId: "p1" }, query: { page: "-1", limit: "500" }, sessionUser: { id: "u1" } } as never,
      reply as never
    );
    expect(reply.status).toHaveBeenCalledWith(404);
    expect(missing).toBe(reply);

    listImportPreviewRows.mockReturnValueOnce({ items: [], total: 0, page: 1, pageSize: 50 });
    const found = await handler!(
      { params: { previewId: "p2" }, query: { page: "2", limit: "10" }, sessionUser: { id: "u1" } } as never,
      reply as never
    );

    expect(listImportPreviewRows).toHaveBeenCalledWith(
      { id: "u1" },
      "p2",
      expect.objectContaining({ page: 2, limit: 10 })
    );
    expect(found).toEqual({ items: [], total: 0, page: 1, pageSize: 50 });
  });

  it("validates file presence and mime type for client preview/execute", async () => {
    const app = createApp();
    await registerImportRoutes(app as never);

    const previewHandler = findHandler(app.post.mock.calls, "/api/import/clients/preview");
    const executeHandler = findHandler(app.post.mock.calls, "/api/import/clients/execute");
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };

    await previewHandler!({ file: vi.fn().mockResolvedValue(null), sessionUser: { id: "u1" } } as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(400);

    await previewHandler!(
      { file: vi.fn().mockResolvedValue({ mimetype: "application/pdf", file: {} }), sessionUser: { id: "u1" } } as never,
      reply as never
    );
    expect(reply.status).toHaveBeenCalledWith(422);

    previewClientImport.mockResolvedValueOnce({ previewId: "pc1" });
    const previewResult = await previewHandler!(
      {
        file: vi.fn().mockResolvedValue({ mimetype: "text/csv", file: "stream" }),
        sessionUser: { id: "u1" }
      } as never,
      reply as never
    );
    expect(previewResult).toEqual({ previewId: "pc1" });

    executeClientImport.mockResolvedValueOnce({ success: 3, failed: 0 });
    await executeHandler!(
      {
        file: vi.fn().mockResolvedValue({ mimetype: "text/csv", file: "stream" }),
        sessionUser: { id: "u1" },
        ip: "127.0.0.1",
        headers: { "user-agent": "vitest" }
      } as never,
      reply as never
    );
    expect(executeClientImport).toHaveBeenCalled();
  });

  it("executes previews for clients/cases and handles missing previewId/session", async () => {
    const app = createApp();
    await registerImportRoutes(app as never);

    const clientPreviewHandler = findHandler(app.post.mock.calls, "/api/import/clients/execute-preview");
    const casePreviewHandler = findHandler(app.post.mock.calls, "/api/import/cases/execute-preview");
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };

    await clientPreviewHandler!({ body: {}, sessionUser: { id: "u1" } } as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(422);

    executeClientImportPreview.mockResolvedValueOnce(null);
    await clientPreviewHandler!(
      { body: { previewId: "missing" }, sessionUser: { id: "u1" }, ip: "1", headers: {} } as never,
      reply as never
    );
    expect(reply.status).toHaveBeenCalledWith(404);

    executeClientImportPreview.mockResolvedValueOnce({ success: 2, failed: 1 });
    await clientPreviewHandler!(
      { body: { previewId: "ok" }, sessionUser: { id: "u1" }, ip: "1", headers: {} } as never,
      reply as never
    );
    expect(reply.status).toHaveBeenCalledWith(200);

    executeCaseImportPreview.mockResolvedValueOnce({ success: 1, failed: 0 });
    await casePreviewHandler!(
      { body: { previewId: "ok-case" }, sessionUser: { id: "u1" }, ip: "1", headers: {} } as never,
      reply as never
    );
    expect(reply.status).toHaveBeenCalledWith(200);
  });

  it("handles case preview/execute flows", async () => {
    const app = createApp();
    await registerImportRoutes(app as never);

    const previewHandler = findHandler(app.post.mock.calls, "/api/import/cases/preview");
    const executeHandler = findHandler(app.post.mock.calls, "/api/import/cases/execute");
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };

    previewCaseImport.mockResolvedValueOnce({ previewId: "case-p" });
    const previewResult = await previewHandler!(
      {
        file: vi.fn().mockResolvedValue({ mimetype: "application/vnd.ms-excel", file: "stream" }),
        sessionUser: { id: "u1" }
      } as never,
      reply as never
    );
    expect(previewResult).toEqual({ previewId: "case-p" });

    executeCaseImport.mockResolvedValueOnce({ success: 4, failed: 1 });
    await executeHandler!(
      {
        file: vi.fn().mockResolvedValue({ mimetype: "application/csv", file: "stream" }),
        sessionUser: { id: "u1" },
        ip: "127.0.0.1",
        headers: { "user-agent": "vitest" }
      } as never,
      reply as never
    );

    expect(executeCaseImport).toHaveBeenCalled();
    expect(requirePermission).toHaveBeenCalledWith("clients:create");
    expect(requirePermission).toHaveBeenCalledWith("cases:create");
  });
});
