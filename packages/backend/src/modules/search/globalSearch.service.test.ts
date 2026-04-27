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
      limit: 10
    });

    expect(results.map((result) => result.id)).toEqual(["doc-strong", "doc-weak"]);
    expect(results[0]?.rank).toBeGreaterThan(results[1]?.rank ?? 0);
    expect(results[0]?.url).toBe("/app/documents/doc-strong");
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
      limit: 10
    });

    expect(results.map((result) => result.title)).toEqual(["Alpha", "Beta"]);
  });
});
