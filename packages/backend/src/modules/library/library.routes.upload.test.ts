import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const dispatchLibraryExtraction = vi.fn();
const fileTypeFromBuffer = vi.fn();
const requirePermission = vi.fn((permission: string) => `perm:${permission}`);

const prisma = {
  libraryDocType: {
    findFirst: vi.fn()
  },
  legalCategory: {
    findFirst: vi.fn()
  },
  libraryDocument: {
    create: vi.fn(),
    findFirst: vi.fn()
  }
};

vi.mock("file-type", () => ({
  fileTypeFromBuffer
}));

vi.mock("../../middleware/requireAuth.js", () => ({
  requireAuth: vi.fn()
}));

vi.mock("../../middleware/requirePermission.js", () => ({
  requirePermission
}));

vi.mock("../documents/documents.service.js", () => ({
  ALLOWED_MIME_TYPES: ["application/pdf", "image/webp"]
}));

vi.mock("../../jobs/libraryExtractionDispatcher.js", () => ({
  dispatchLibraryExtraction
}));

vi.mock("../../db/prisma.js", () => ({
  prisma
}));

vi.mock("../editions/editionPolicy.js", () => ({
  hasEditionFeature: vi.fn().mockReturnValue(false)
}));

vi.mock("./library.service.js", () => ({
  listLibraryTypes: vi.fn(),
  createLibraryType: vi.fn(),
  updateLibraryType: vi.fn(),
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  listDocuments: vi.fn(),
  getDocument: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  softDeleteDocument: vi.fn(),
  getArticle: vi.fn(),
  createAnnotation: vi.fn(),
  updateAnnotation: vi.fn(),
  deleteAnnotation: vi.fn(),
  listCaseLegalReferences: vi.fn(),
  linkDocumentToCase: vi.fn(),
  unlinkDocumentFromCase: vi.fn(),
  searchLibrary: vi.fn()
}));

const { registerLibraryRoutes } = await import("./library.routes.js");

function createReplyRecorder() {
  const recorder = {
    statusCode: 200,
    payload: undefined as unknown,
    headers: {} as Record<string, string>,
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
    }),
    header: vi.fn((name: string, value: string) => {
      recorder.headers[name] = value;
      return recorder;
    }),
    redirect: vi.fn()
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

describe("library upload route authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fileTypeFromBuffer.mockResolvedValue({ mime: "application/pdf" });
    prisma.libraryDocType.findFirst.mockResolvedValue({
      id: "type-1",
      code: "LEGISLATION"
    });
    prisma.legalCategory.findFirst.mockResolvedValue({
      id: "cat-1",
      typeId: "type-1",
      documentType: "LEGISLATION"
    });
    prisma.libraryDocument.create.mockResolvedValue({ id: "doc-1" });
  });

  it("registers upload route with library:manage permission gate", async () => {
    const app = createApp();
    await registerLibraryRoutes(app as never, { OCR_BACKEND: "tesseract" } as never);

    const uploadCall = app.post.mock.calls.find((call) => call[0] === "/api/library/documents/upload");
    expect(uploadCall).toBeDefined();
    const options = uploadCall?.[1] as { preHandler: unknown[] };
    expect(options.preHandler).toContain("perm:library:manage");
    expect(options.preHandler).not.toContain("perm:library:read");
  });

  it("allows library managers to upload firm-scoped documents", async () => {
    const app = createApp();
    await registerLibraryRoutes(app as never, { OCR_BACKEND: "tesseract" } as never);
    const uploadCall = app.post.mock.calls.find((call) => call[0] === "/api/library/documents/upload");
    const handler = uploadCall?.[2] as (request: unknown, reply: unknown) => Promise<unknown>;

    const actor = makeSessionUser({ permissions: ["library:manage"], firmId: "firm-1" });
    const request = {
      sessionUser: actor,
      file: vi.fn().mockResolvedValue({
        filename: "law.pdf",
        file: Readable.from(Buffer.from("pdf-bytes")),
        fields: {
          title: { value: "Law 1" },
          typeId: { value: "type-1" },
          scope: { value: "FIRM" },
          categoryId: { value: "cat-1" }
        }
      })
    };
    const reply = createReplyRecorder();

    await handler(request, reply);

    expect(reply.statusCode).toBe(201);
    expect(prisma.libraryDocument.create).toHaveBeenCalled();
    const createArgs = prisma.libraryDocument.create.mock.calls[0]?.[0];
    expect(createArgs?.data?.scope).toBe("FIRM");
    expect(createArgs?.data?.firmId).toBe("firm-1");
  });

  it("reads multipart fields after file stream consumption", async () => {
    const app = createApp();
    await registerLibraryRoutes(app as never, { OCR_BACKEND: "tesseract" } as never);
    const uploadCall = app.post.mock.calls.find((call) => call[0] === "/api/library/documents/upload");
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

    const actor = makeSessionUser({ permissions: ["library:manage"], firmId: "firm-1" });
    const request = {
      sessionUser: actor,
      file: vi.fn().mockResolvedValue({
        filename: "law.pdf",
        file,
        get fields() {
          return streamConsumed
            ? {
                title: { value: "Law Parsed After Stream" },
                type: { value: "LEGISLATION" },
                typeId: { value: "type-1" },
                scope: { value: "FIRM" },
                categoryId: { value: "cat-1" }
              }
            : {};
        }
      })
    };
    const reply = createReplyRecorder();

    await handler(request, reply);

    expect(reply.statusCode).toBe(201);
    const createArgs = prisma.libraryDocument.create.mock.calls.at(-1)?.[0];
    expect(createArgs?.data?.title).toBe("Law Parsed After Stream");
    expect(createArgs?.data?.type).toBe("LEGISLATION");
    expect(createArgs?.data?.scope).toBe("FIRM");
  });

  it("forces firm scope even when system scope is requested", async () => {
    const app = createApp();
    await registerLibraryRoutes(app as never, { OCR_BACKEND: "tesseract" } as never);
    const uploadCall = app.post.mock.calls.find((call) => call[0] === "/api/library/documents/upload");
    const handler = uploadCall?.[2] as (request: unknown, reply: unknown) => Promise<unknown>;

    const actor = makeSessionUser({
      permissions: ["library:read", "library:manage"],
      firmId: "firm-1"
    });
    const request = {
      sessionUser: actor,
      file: vi.fn().mockResolvedValue({
        filename: "law.pdf",
        file: Readable.from(Buffer.from("pdf-bytes")),
        fields: {
          title: { value: "Law 1" },
          typeId: { value: "type-1" },
          scope: { value: "SYSTEM" }
        }
      })
    };
    const reply = createReplyRecorder();

    await handler(request, reply);

    expect(reply.statusCode).toBe(201);
    const createArgs = prisma.libraryDocument.create.mock.calls[0]?.[0];
    expect(createArgs?.data?.scope).toBe("FIRM");
    expect(createArgs?.data?.firmId).toBe("firm-1");
  });

  it("accepts newly allowed image MIME types", async () => {
    const app = createApp();
    await registerLibraryRoutes(app as never, { OCR_BACKEND: "tesseract" } as never);
    const uploadCall = app.post.mock.calls.find((call) => call[0] === "/api/library/documents/upload");
    const handler = uploadCall?.[2] as (request: unknown, reply: unknown) => Promise<unknown>;

    fileTypeFromBuffer.mockResolvedValueOnce({ mime: "image/webp" });

    const actor = makeSessionUser({ permissions: ["library:manage"], firmId: "firm-1" });
    const request = {
      sessionUser: actor,
      file: vi.fn().mockResolvedValue({
        filename: "scan.webp",
        file: Readable.from(Buffer.from("webp-bytes")),
        fields: {
          title: { value: "WebP Scan" },
          typeId: { value: "type-1" },
          scope: { value: "FIRM" }
        }
      })
    };
    const reply = createReplyRecorder();

    await handler(request, reply);

    expect(reply.statusCode).toBe(201);
    const createArgs = prisma.libraryDocument.create.mock.calls.at(-1)?.[0];
    expect(createArgs?.data?.title).toBe("WebP Scan");
  });

  it("applies tenant/scope visibility filter to download route lookup", async () => {
    const app = createApp();
    await registerLibraryRoutes(app as never, { OCR_BACKEND: "tesseract" } as never);

    const downloadCall = app.get.mock.calls.find(
      (call) => call[0] === "/api/library/documents/:documentId/download"
    );
    const handler = downloadCall?.[2] as (
      request: unknown,
      reply: unknown
    ) => Promise<unknown>;

    const actor = makeSessionUser({ permissions: ["library:manage"], firmId: "firm-1" });
    prisma.libraryDocument.findFirst.mockResolvedValueOnce({
      id: "doc-1",
      scope: "FIRM",
      storageKey: "library/firm-1/doc-1/file.pdf"
    });

    const reply = createReplyRecorder();
    await handler({ params: { documentId: "doc-1" }, sessionUser: actor }, reply);

    expect(prisma.libraryDocument.findFirst).toHaveBeenCalledWith({
      where: {
        id: "doc-1",
        deletedAt: null,
        OR: [{ scope: "SYSTEM" }, { firmId: "firm-1" }]
      }
    });
  });

  it("returns 404 for stream route when no visible document is found", async () => {
    const app = createApp();
    await registerLibraryRoutes(app as never, { OCR_BACKEND: "tesseract" } as never);

    const streamCall = app.get.mock.calls.find(
      (call) => call[0] === "/api/library/documents/:documentId/stream"
    );
    const handler = streamCall?.[2] as (
      request: unknown,
      reply: unknown
    ) => Promise<unknown>;

    prisma.libraryDocument.findFirst.mockResolvedValueOnce(null);
    const actor = makeSessionUser({ permissions: ["library:read"], firmId: "firm-1" });
    const reply = createReplyRecorder();

    await handler({ params: { documentId: "doc-x" }, sessionUser: actor }, reply);

    expect(reply.statusCode).toBe(404);
    expect(reply.payload).toEqual({ error: "File not found" });
  });

  it("sets stream headers for visible library document", async () => {
    const app = createApp();
    await registerLibraryRoutes(app as never, { OCR_BACKEND: "tesseract" } as never);

    const streamCall = app.get.mock.calls.find(
      (call) => call[0] === "/api/library/documents/:documentId/stream"
    );
    const handler = streamCall?.[2] as (
      request: unknown,
      reply: unknown
    ) => Promise<unknown>;

    prisma.libraryDocument.findFirst.mockResolvedValueOnce({
      id: "doc-1",
      title: "Law 1.pdf",
      mimeType: "application/pdf",
      storageKey: "library/firm-1/doc-1/law.pdf"
    });
    app.storage.get.mockResolvedValue(Readable.from(Buffer.from("pdf")));

    const actor = makeSessionUser({ permissions: ["library:read"], firmId: "firm-1" });
    const reply = createReplyRecorder();

    await handler({ params: { documentId: "doc-1" }, sessionUser: actor }, reply);

    expect(reply.header).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(reply.header).toHaveBeenCalledWith(
      "Content-Disposition",
      'attachment; filename="Law%201.pdf"'
    );
  });

  it("rejects category that does not match document type", async () => {
    const app = createApp();
    await registerLibraryRoutes(app as never, { OCR_BACKEND: "tesseract" } as never);
    const uploadCall = app.post.mock.calls.find((call) => call[0] === "/api/library/documents/upload");
    const handler = uploadCall?.[2] as (request: unknown, reply: unknown) => Promise<unknown>;

    prisma.legalCategory.findFirst.mockResolvedValueOnce({
      id: "cat-2",
      typeId: "type-2",
      documentType: "JUDGMENT"
    });

    const actor = makeSessionUser({ permissions: ["library:read"], firmId: "firm-1" });
    const request = {
      sessionUser: actor,
      file: vi.fn().mockResolvedValue({
        filename: "law.pdf",
        file: Readable.from(Buffer.from("pdf-bytes")),
        fields: {
          title: { value: "Law 1" },
          typeId: { value: "type-1" },
          type: { value: "LEGISLATION" },
          categoryId: { value: "cat-2" }
        }
      })
    };
    const reply = createReplyRecorder();

    await handler(request, reply);

    expect(reply.statusCode).toBe(400);
    expect(reply.payload).toEqual({
      message: "Category does not match selected document type"
    });
    expect(prisma.libraryDocument.create).not.toHaveBeenCalled();
  });
});
