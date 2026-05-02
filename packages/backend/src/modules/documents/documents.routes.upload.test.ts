import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const createDocument = vi.fn();
const sniffMimeAndReplayStream = vi.fn();
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
vi.mock("../../utils/upload.js", () => ({
  sniffMimeAndReplayStream
}));

vi.mock("./documents.service.js", () => ({
  ALLOWED_MIME_TYPES: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/webp"
  ],
  createDocument,
  getDocument: vi.fn(),
  getDownloadUrl: vi.fn(),
  listDocuments: vi.fn(),
  softDeleteDocument: vi.fn(),
  streamDocument: vi.fn(),
  streamDocumentPreview: vi.fn(),
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
    sniffMimeAndReplayStream.mockResolvedValue({
      mimeType: "application/pdf",
      sniffBytes: Buffer.from("%PDF"),
      stream: Readable.from(Buffer.from("pdf-bytes"))
    });
    createDocument.mockResolvedValue({ id: "doc-1" });
  });

  it("reads multipart fields and forwards the streamed payload", async () => {
    const app = createApp();
    await registerDocumentRoutes(app as never, {} as never);

    const uploadCall = app.post.mock.calls.find((call) => call[0] === "/api/documents");
    expect(uploadCall).toBeDefined();
    const handler = uploadCall?.[2] as (request: unknown, reply: unknown) => Promise<unknown>;

    const file = new Readable({
      read() {
        this.push(Buffer.from("pdf-bytes"));
        this.push(null);
      }
    });

    const request = {
      sessionUser: makeSessionUser({ permissions: ["documents:create"] }),
      file: vi.fn().mockResolvedValue({
        filename: "evidence.pdf",
        file,
        fields: {
          title: { value: "Case Evidence" },
          type: { value: "GENERAL" },
          caseId: { value: "11111111-1111-1111-1111-111111111111" },
          clientId: { value: "22222222-2222-2222-2222-222222222222" }
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
        mimeType: "application/pdf",
        stream: expect.anything()
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

    sniffMimeAndReplayStream.mockResolvedValueOnce({
      mimeType: "image/webp",
      sniffBytes: Buffer.from("RIFF"),
      stream: Readable.from(Buffer.from("webp-bytes"))
    });

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

  it("rejects undetectable file types", async () => {
    const app = createApp();
    await registerDocumentRoutes(app as never, {} as never);

    const uploadCall = app.post.mock.calls.find((call) => call[0] === "/api/documents");
    const handler = uploadCall?.[2] as (request: unknown, reply: unknown) => Promise<unknown>;

    sniffMimeAndReplayStream.mockResolvedValueOnce({
      mimeType: null,
      sniffBytes: Buffer.from("unknown"),
      stream: Readable.from(Buffer.from("unknown"))
    });

    const request = {
      sessionUser: makeSessionUser({ permissions: ["documents:create"] }),
      file: vi.fn().mockResolvedValue({
        filename: "unknown.bin",
        file: Readable.from(Buffer.from("unknown")),
        fields: {}
      })
    };
    const reply = createReplyRecorder();

    await handler(request, reply);

    expect(reply.statusCode).toBe(422);
    expect(createDocument).not.toHaveBeenCalled();
  });

  it("accepts docx fallback when zip signature and multipart metadata match", async () => {
    const app = createApp();
    await registerDocumentRoutes(app as never, {} as never);

    const uploadCall = app.post.mock.calls.find((call) => call[0] === "/api/documents");
    const handler = uploadCall?.[2] as (request: unknown, reply: unknown) => Promise<unknown>;

    sniffMimeAndReplayStream.mockResolvedValueOnce({
      mimeType: null,
      sniffBytes: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      stream: Readable.from(Buffer.from("docx-bytes"))
    });

    const request = {
      sessionUser: makeSessionUser({ permissions: ["documents:create"] }),
      file: vi.fn().mockResolvedValue({
        filename: "brief.docx",
        mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        file: Readable.from(Buffer.from("docx-bytes")),
        fields: {
          title: { value: "Brief" },
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
        fileName: "brief.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      }),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });
});
