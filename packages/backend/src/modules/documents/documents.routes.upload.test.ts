import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const createDocument = vi.fn();
const fileTypeFromBuffer = vi.fn();
const requirePermission = vi.fn((permission: string) => `perm:${permission}`);

vi.mock("file-type", () => ({
  fileTypeFromBuffer
}));

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
  ALLOWED_MIME_TYPES: ["application/pdf", "image/webp"],
  createDocument,
  getDocument: vi.fn(),
  getDownloadUrl: vi.fn(),
  listDocuments: vi.fn(),
  softDeleteDocument: vi.fn(),
  streamDocument: vi.fn(),
  updateDocument: vi.fn(),
  uploadNewVersion: vi.fn()
}));

const { registerDocumentRoutes } = await import("./documents.routes.js");

function createReplyRecorder() {
  const recorder = {
    statusCode: 200,
    payload: undefined as unknown,
    status: vi.fn((code: number) => {
      recorder.statusCode = code;
      return {
        send: (payload: unknown) => {
          recorder.payload = payload;
          return payload;
        }
      };
    }),
    send: vi.fn((payload: unknown) => {
      recorder.payload = payload;
      return payload;
    })
  };
  return recorder;
}

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

describe("document upload route multipart field parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fileTypeFromBuffer.mockResolvedValue({ mime: "application/pdf" });
    createDocument.mockResolvedValue({ id: "doc-1" });
  });

  it("reads multipart fields after file stream consumption", async () => {
    const app = createApp();
    await registerDocumentRoutes(app as never, {} as never);

    const uploadCall = app.post.mock.calls.find((call) => call[0] === "/api/documents");
    expect(uploadCall).toBeDefined();
    const handler = uploadCall?.[2] as (request: unknown, reply: unknown) => Promise<unknown>;

    let streamConsumed = false;
    const file = new Readable({
      read() {
        if (streamConsumed) return;
        this.push(Buffer.from("pdf-bytes"));
        this.push(null);
        streamConsumed = true;
      }
    });

    const request = {
      sessionUser: makeSessionUser({ permissions: ["documents:create"] }),
      file: vi.fn().mockResolvedValue({
        filename: "evidence.pdf",
        file,
        get fields() {
          return streamConsumed
            ? {
                title: { value: "Case Evidence" },
                type: { value: "GENERAL" },
                caseId: { value: "11111111-1111-1111-1111-111111111111" },
                clientId: { value: "22222222-2222-2222-2222-222222222222" }
              }
            : {};
        }
      })
    };
    const reply = createReplyRecorder();

    await handler(request, reply);

    expect(reply.statusCode).toBe(201);
    expect(createDocument).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: "Case Evidence",
        type: "GENERAL",
        caseId: "11111111-1111-1111-1111-111111111111",
        clientId: "22222222-2222-2222-2222-222222222222",
        fileName: "evidence.pdf",
        mimeType: "application/pdf"
      }),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  it("accepts newly allowed image MIME types", async () => {
    const app = createApp();
    await registerDocumentRoutes(app as never, {} as never);

    const uploadCall = app.post.mock.calls.find((call) => call[0] === "/api/documents");
    const handler = uploadCall?.[2] as (request: unknown, reply: unknown) => Promise<unknown>;

    fileTypeFromBuffer.mockResolvedValueOnce({ mime: "image/webp" });

    const request = {
      sessionUser: makeSessionUser({ permissions: ["documents:create"] }),
      file: vi.fn().mockResolvedValue({
        filename: "scan.webp",
        file: Readable.from(Buffer.from("webp-bytes")),
        fields: {
          title: { value: "Scanner Image" },
          type: { value: "GENERAL" }
        }
      })
    };
    const reply = createReplyRecorder();

    await handler(request, reply);

    expect(reply.statusCode).toBe(201);
    expect(createDocument).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        fileName: "scan.webp",
        mimeType: "image/webp"
      }),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });
});
