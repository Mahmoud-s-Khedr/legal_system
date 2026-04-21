import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const mockPrisma = {
  legalCategory: {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn()
  },
  libraryDocument: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn()
  },
  libraryTag: {
    upsert: vi.fn()
  },
  libraryAnnotation: {
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  caseLegalReference: {
    findFirst: vi.fn(),
    delete: vi.fn()
  },
  legislationArticle: {
    findFirst: vi.fn()
  },
  $queryRaw: vi.fn()
};

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn(async (_prisma: unknown, _firmId: string, fn: (tx: typeof mockPrisma) => unknown) =>
    fn(mockPrisma)
  )
}));

const {
  createCategory,
  getDocument,
  listCategories,
  listDocuments,
  searchLibrary,
  softDeleteDocument,
  updateCategory,
  updateDocument
} = await import("./library.service.js");

const actor = makeSessionUser();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("library.service", () => {
  it("builds category tree for system and firm categories", async () => {
    mockPrisma.legalCategory.findMany.mockResolvedValueOnce([
      {
        id: "root",
        nameAr: "جذر",
        nameEn: "Root",
        nameFr: "Racine",
        slug: "root",
        firmId: null,
        parentId: null
      },
      {
        id: "child",
        nameAr: "فرع",
        nameEn: "Child",
        nameFr: "Enfant",
        slug: "child",
        firmId: actor.firmId,
        parentId: "root"
      }
    ]);

    const result = await listCategories(actor);

    expect(result).toHaveLength(1);
    expect(result[0].children[0]?.id).toBe("child");
  });

  it("lists documents with mapping to summary DTO", async () => {
    const now = new Date("2026-04-21T00:00:00.000Z");
    mockPrisma.libraryDocument.findMany.mockResolvedValueOnce([
      {
        id: "doc-1",
        type: "LAW",
        scope: "SYSTEM",
        title: "Law 1",
        summary: "Summary",
        lawNumber: "10",
        lawYear: 2020,
        judgmentNumber: null,
        judgmentDate: null,
        publishedAt: now,
        legislationStatus: "ACTIVE",
        categoryId: null,
        firmId: null,
        createdAt: now
      }
    ]);
    mockPrisma.libraryDocument.count.mockResolvedValueOnce(1);

    const result = await listDocuments(actor, { q: "law" }, 1, 20);

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ id: "doc-1", title: "Law 1" });
    expect(mockPrisma.libraryDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) })
    );
  });

  it("returns null for unavailable document and maps details when found", async () => {
    mockPrisma.libraryDocument.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "doc-1",
        type: "LAW",
        scope: "SYSTEM",
        title: "Law 1",
        summary: "Summary",
        lawNumber: null,
        lawYear: null,
        judgmentNumber: null,
        judgmentDate: null,
        publishedAt: null,
        legislationStatus: null,
        categoryId: null,
        firmId: null,
        createdAt: new Date("2026-04-21T00:00:00.000Z"),
        contentText: "Body",
        legalPrinciple: null,
        author: "Author",
        articles: [
          {
            id: "a1",
            articleNumber: "1",
            title: "Article",
            body: "Text"
          }
        ],
        tags: [{ tag: { name: "civil" } }],
        annotations: [
          {
            id: "ann-1",
            body: "note",
            userId: actor.id,
            createdAt: new Date("2026-04-21T00:00:00.000Z"),
            updatedAt: new Date("2026-04-21T00:00:00.000Z")
          }
        ]
      });

    const missing = await getDocument(actor, "missing", actor.id);
    const found = await getDocument(actor, "doc-1", actor.id);

    expect(missing).toBeNull();
    expect(found?.tags).toEqual(["civil"]);
    expect(found?.articles[0]?.articleNumber).toBe("1");
  });

  it("updates category and document fields when records exist", async () => {
    mockPrisma.legalCategory.findFirst
      .mockResolvedValueOnce({
        id: "cat-1",
        firmId: actor.firmId,
        nameAr: "A",
        nameEn: "A",
        nameFr: "A",
        slug: "a",
        parentId: null
      })
      .mockResolvedValueOnce({
        id: "cat-1",
        firmId: actor.firmId,
        nameAr: "B",
        nameEn: "B",
        nameFr: "B",
        slug: "b",
        parentId: null
      });
    mockPrisma.legalCategory.updateMany.mockResolvedValueOnce({ count: 1 });

    mockPrisma.libraryDocument.findFirst.mockResolvedValueOnce({
      id: "doc-1",
      title: "Old",
      summary: null,
      contentText: null,
      legalPrinciple: null,
      lawNumber: null,
      lawYear: null,
      legislationStatus: null,
      categoryId: null,
      publishedAt: null,
      author: null
    });
    mockPrisma.libraryDocument.update.mockResolvedValueOnce({
      id: "doc-1",
      type: "LAW",
      scope: "SYSTEM",
      title: "New",
      summary: null,
      lawNumber: null,
      lawYear: null,
      judgmentNumber: null,
      judgmentDate: null,
      publishedAt: null,
      legislationStatus: null,
      categoryId: null,
      firmId: null,
      createdAt: new Date("2026-04-21T00:00:00.000Z")
    });

    const category = await updateCategory(actor, "cat-1", { nameEn: "B", slug: "b" });
    const updatedDoc = await updateDocument(actor, "doc-1", { title: "New" });

    expect(category?.nameEn).toBe("B");
    expect(updatedDoc?.title).toBe("New");
  });

  it("soft deletes only firm-owned documents", async () => {
    mockPrisma.libraryDocument.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "doc-1" });
    mockPrisma.libraryDocument.update.mockResolvedValueOnce({ id: "doc-1" });

    const missing = await softDeleteDocument(actor, "missing");
    const deleted = await softDeleteDocument(actor, "doc-1");

    expect(missing).toBe(false);
    expect(deleted).toBe(true);
  });

  it("maps full-text search rows into API results", async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([
      {
        id: "doc-1",
        type: "LAW",
        title: "Law 1",
        summary: "Summary",
        scope: "SYSTEM",
        categoryId: null,
        article_id: "a1",
        article_number: "5",
        article_body: "Matched body",
        rank: 0.4
      },
      {
        id: "doc-2",
        type: "JUDGMENT",
        title: "Judgment",
        summary: null,
        scope: "FIRM",
        categoryId: "cat-1",
        article_id: null,
        article_number: null,
        article_body: null,
        rank: 0.2
      }
    ]);

    const result = await searchLibrary(actor, "law", {}, 20);

    expect(result[0]?.articleMatch?.articleNumber).toBe("5");
    expect(result[1]?.articleMatch).toBeUndefined();
  });

  it("creates category under actor firm", async () => {
    mockPrisma.legalCategory.create.mockResolvedValueOnce({
      id: "cat-1",
      nameAr: "أ",
      nameEn: "A",
      nameFr: "A",
      slug: "a",
      firmId: actor.firmId
    });

    const created = await createCategory(actor, {
      nameAr: "أ",
      nameEn: "A",
      nameFr: "A",
      slug: "a"
    });

    expect(created.firmId).toBe(actor.firmId);
    expect(created.children).toEqual([]);
  });
});
