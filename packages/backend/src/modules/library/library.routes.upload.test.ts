import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const dispatchLibraryExtraction = vi.fn();
const fileTypeFromBuffer = vi.fn();
const requirePermission = vi.fn((permission: string) => `perm:${permission}`);

const prisma = {
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
  ALLOWED_MIME_TYPES: ["application/pdf"]
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
    prisma.libraryDocument.create.mockResolvedValue({ id: "doc-1" });
  });

  it("registers upload route with library:read permission gate", async () => {
    const app = createApp();
    await registerLibraryRoutes(app as never, { OCR_BACKEND: "tesseract" } as never);

    const uploadCall = app.post.mock.calls.find((call) => call[0] === "/api/library/documents/upload");
    expect(uploadCall).toBeDefined();
    const options = uploadCall?.[1] as { preHandler: unknown[] };
    expect(options.preHandler).toContain("perm:library:read");
  });

  it("allows library readers to upload firm-scoped documents", async () => {
    const app = createApp();
    await registerLibraryRoutes(app as never, { OCR_BACKEND: "tesseract" } as never);
    const uploadCall = app.post.mock.calls.find((call) => call[0] === "/api/library/documents/upload");
    const handler = uploadCall?.[2] as (request: unknown, reply: unknown) => Promise<unknown>;

    const actor = makeSessionUser({ permissions: ["library:read"], firmId: "firm-1" });
    const request = {
      sessionUser: actor,
      file: vi.fn().mockResolvedValue({
        filename: "law.pdf",
        file: Readable.from(Buffer.from("pdf-bytes")),
        fields: {
          title: { value: "Law 1" },
          scope: { value: "FIRM" }
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

  it("rejects system-scope upload for non-managers", async () => {
    const app = createApp();
    await registerLibraryRoutes(app as never, { OCR_BACKEND: "tesseract" } as never);
    const uploadCall = app.post.mock.calls.find((call) => call[0] === "/api/library/documents/upload");
    const handler = uploadCall?.[2] as (request: unknown, reply: unknown) => Promise<unknown>;

    const actor = makeSessionUser({ permissions: ["library:read"], firmId: "firm-1" });
    const request = {
      sessionUser: actor,
      file: vi.fn().mockResolvedValue({
        filename: "law.pdf",
        file: Readable.from(Buffer.from("pdf-bytes")),
        fields: {
          title: { value: "Law 1" },
          scope: { value: "SYSTEM" }
        }
      })
    };
    const reply = createReplyRecorder();

    await handler(request, reply);

    expect(reply.statusCode).toBe(403);
    expect(reply.payload).toEqual({ message: "Only library managers can upload system library documents" });
    expect(prisma.libraryDocument.create).not.toHaveBeenCalled();
  });

  it("allows system-scope upload for library managers", async () => {
    const app = createApp();
    await registerLibraryRoutes(app as never, { OCR_BACKEND: "tesseract" } as never);
    const uploadCall = app.post.mock.calls.find((call) => call[0] === "/api/library/documents/upload");
    const handler = uploadCall?.[2] as (request: unknown, reply: unknown) => Promise<unknown>;

    const actor = makeSessionUser({ permissions: ["library:read", "library:manage"], firmId: "firm-1" });
    const request = {
      sessionUser: actor,
      file: vi.fn().mockResolvedValue({
        filename: "law.pdf",
        file: Readable.from(Buffer.from("pdf-bytes")),
        fields: {
          title: { value: "Law 1" },
          scope: { value: "SYSTEM" }
        }
      })
    };
    const reply = createReplyRecorder();

    await handler(request, reply);

    expect(reply.statusCode).toBe(201);
    const createArgs = prisma.libraryDocument.create.mock.calls[0]?.[0];
    expect(createArgs?.data?.scope).toBe("SYSTEM");
    expect(createArgs?.data?.firmId).toBeNull();
  });
});
