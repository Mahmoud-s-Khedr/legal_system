import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const mockPrisma = {
  $queryRaw: vi.fn()
};

vi.mock("../../db/prisma.js", () => ({
  prisma: mockPrisma
}));

const { searchDocuments } = await import("./search.service.js");

const actor = makeSessionUser({
  firmId: "11111111-1111-1111-1111-111111111111",
  permissions: ["documents:read"]
});

describe("searchDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty payload for whitespace query without touching DB", async () => {
    const result = await searchDocuments(actor, { q: "   " });

    expect(result).toEqual({ items: [], total: 0, query: "" });
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("maps FTS rows and returns total with normalized query", async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "doc-1",
          title: "Master Service Agreement",
          fileName: "msa.pdf",
          mimeType: "application/pdf",
          type: "CONTRACT",
          extractionStatus: "INDEXED",
          caseId: null,
          clientId: null,
          createdAt: new Date("2026-04-01T10:00:00.000Z"),
          rank: 0.92,
          headline: "<mark>service</mark> agreement"
        }
      ])
      .mockResolvedValueOnce([{ total: BigInt(1) }]);

    const result = await searchDocuments(actor, { q: "  service agreement  ", page: 1, pageSize: 5 });

    expect(result.query).toBe("service agreement");
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "doc-1",
      title: "Master Service Agreement",
      headline: "<mark>service</mark> agreement",
      rank: 0.92
    });
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("uses deterministic ordering and passes tenant/pagination parameters", async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: BigInt(0) }]);

    await searchDocuments(actor, { q: "lease", page: 2, pageSize: 5 });

    const firstCall = mockPrisma.$queryRaw.mock.calls[0];
    const template = firstCall[0] as TemplateStringsArray;
    const values = firstCall.slice(1);

    const sqlText = template.join(" ");
    expect(sqlText).toContain('ORDER BY rank DESC, d."createdAt" DESC, d.id DESC');
    expect(values).toContain(actor.firmId);
    expect(values).toContain(5);
  });
});
