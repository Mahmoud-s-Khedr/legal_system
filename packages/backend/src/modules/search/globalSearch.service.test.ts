import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const mockPrisma = {
  case: { findMany: vi.fn() },
  client: { findMany: vi.fn() },
  task: { findMany: vi.fn() },
  document: { findMany: vi.fn() },
  libraryDocument: { findMany: vi.fn() }
};

vi.mock("../../db/prisma.js", () => ({
  prisma: mockPrisma
}));

vi.mock("../../utils/fuzzySearch.js", () => ({
  buildFuzzySearchCandidates: (query: string) => [query]
}));

const { globalSearch } = await import("./globalSearch.service.js");

const actor = makeSessionUser({
  firmId: "11111111-1111-1111-1111-111111111111",
  permissions: ["documents:read"]
});

describe("globalSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.case.findMany.mockResolvedValue([]);
    mockPrisma.client.findMany.mockResolvedValue([]);
    mockPrisma.task.findMany.mockResolvedValue([]);
    mockPrisma.libraryDocument.findMany.mockResolvedValue([]);
  });

  it("ranks stronger field matches above weaker matches", async () => {
    mockPrisma.document.findMany.mockResolvedValue([
      {
        id: "doc-weak",
        title: "Quarterly Notes",
        fileName: "notes.pdf",
        contentText: "This mentions alpha once."
      },
      {
        id: "doc-strong",
        title: "Alpha Agreement",
        fileName: "agreement.pdf",
        contentText: "Detailed contract terms."
      }
    ]);

    const results = await globalSearch(actor, {
      q: "alpha",
      entities: ["documents"],
      page: 1,
      pageSize: 10
    });

    expect(results.items.map((result) => result.id)).toEqual([
      "doc-strong",
      "doc-weak"
    ]);
    expect(results.total).toBe(2);
    expect(results.page).toBe(1);
    expect(results.pageSize).toBe(10);
    expect(results.items[0]?.rank).toBeGreaterThan(results.items[1]?.rank ?? 0);
    expect(results.items[0]?.url).toBe("/app/documents/doc-strong");
  });

  it("uses deterministic title sorting when ranks are equal", async () => {
    mockPrisma.document.findMany.mockResolvedValue([
      {
        id: "doc-b",
        title: "Beta",
        fileName: "same.pdf",
        contentText: ""
      },
      {
        id: "doc-a",
        title: "Alpha",
        fileName: "same.pdf",
        contentText: ""
      }
    ]);

    const results = await globalSearch(actor, {
      q: "zzz",
      entities: ["documents"],
      page: 1,
      pageSize: 10
    });

    expect(results.items.map((result) => result.title)).toEqual(["Alpha", "Beta"]);
  });

  it("returns the requested page slice and total count", async () => {
    mockPrisma.document.findMany.mockResolvedValue([
      {
        id: "doc-a",
        title: "Alpha",
        fileName: "alpha.pdf",
        contentText: "alpha"
      },
      {
        id: "doc-b",
        title: "Beta",
        fileName: "beta.pdf",
        contentText: "alpha"
      },
      {
        id: "doc-c",
        title: "Gamma",
        fileName: "gamma.pdf",
        contentText: "alpha"
      }
    ]);

    const results = await globalSearch(actor, {
      q: "alpha",
      entities: ["documents"],
      page: 2,
      pageSize: 1
    });

    expect(results.total).toBe(3);
    expect(results.page).toBe(2);
    expect(results.pageSize).toBe(1);
    expect(results.items.map((result) => result.id)).toEqual(["doc-b"]);
  });
});
