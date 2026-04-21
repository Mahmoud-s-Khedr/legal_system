import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const searchLibrary = vi.fn();
const requirePermission = vi.fn((permission: string) => `perm:${permission}`);

vi.mock("../../middleware/requireAuth.js", () => ({
  requireAuth: "auth-guard"
}));

vi.mock("../../middleware/requirePermission.js", () => ({
  requirePermission
}));

vi.mock("file-type", () => ({
  fileTypeFromBuffer: vi.fn()
}));

vi.mock("../../jobs/libraryExtractionDispatcher.js", () => ({
  dispatchLibraryExtraction: vi.fn()
}));

vi.mock("../../db/prisma.js", () => ({
  prisma: {
    libraryDocument: {
      create: vi.fn(),
      findFirst: vi.fn()
    }
  }
}));

vi.mock("../documents/documents.service.js", () => ({
  ALLOWED_MIME_TYPES: ["application/pdf"]
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
  searchLibrary
}));

const { registerLibraryRoutes } = await import("./library.routes.js");

describe("library search route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts one-character query and forwards trimmed q", async () => {
    const app = {
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

    await registerLibraryRoutes(
      app as never,
      { OCR_BACKEND: "tesseract" } as never
    );

    const searchCall = app.get.mock.calls.find(
      (call) => call[0] === "/api/library/search"
    );
    expect(searchCall).toBeDefined();

    const handler = searchCall?.[2] as ((request: unknown) => Promise<unknown>) | undefined;
    expect(handler).toBeDefined();

    const actor = makeSessionUser({ permissions: ["library:read"] });
    searchLibrary.mockResolvedValueOnce([]);

    await handler!({
      query: { q: " ا " },
      sessionUser: actor
    });

    expect(searchLibrary).toHaveBeenCalledWith(
      actor,
      "ا",
      expect.any(Object),
      20
    );
  });
});
