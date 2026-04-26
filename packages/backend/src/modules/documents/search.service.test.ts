import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const inTenantTransaction = vi.fn();
const searchFirmDocumentsRaw = vi.fn();

vi.mock("../../repositories/unitOfWork.js", () => ({
  inTenantTransaction
}));
vi.mock("../../repositories/documents/search.repository.js", () => ({
  searchFirmDocumentsRaw
}));

const { searchDocuments } = await import("./search.service.js");

const actor = makeSessionUser({
  firmId: "11111111-1111-1111-1111-111111111111",
  permissions: ["documents:read"]
});

describe("searchDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inTenantTransaction.mockImplementation(async (_firmId, fn) => fn({ tx: true }));
  });

  it("returns empty payload for whitespace query without touching DB", async () => {
    const result = await searchDocuments(actor, { q: "   " });

    expect(result).toEqual({ items: [], total: 0, query: "" });
    expect(inTenantTransaction).not.toHaveBeenCalled();
    expect(searchFirmDocumentsRaw).not.toHaveBeenCalled();
  });

  it("calls repository through tenant transaction with normalized query and filters", async () => {
    searchFirmDocumentsRaw.mockResolvedValueOnce([]);

    await searchDocuments(actor, {
      q: "  service agreement  ",
      caseId: "case-1",
      clientId: "client-1",
      type: "CONTRACT",
      page: 2,
      pageSize: 5
    });

    expect(inTenantTransaction).toHaveBeenCalledWith(actor.firmId, expect.any(Function));
    expect(searchFirmDocumentsRaw).toHaveBeenCalledWith(
      { tx: true },
      expect.objectContaining({
        firmId: actor.firmId,
        normalizedQuery: "service agreement",
        caseId: "case-1",
        clientId: "client-1",
        type: "CONTRACT",
        page: 2,
        pageSize: 5
      })
    );
  });

  it("maps repository rows and returns total from totalCount", async () => {
    searchFirmDocumentsRaw.mockResolvedValueOnce([
      {
        id: "doc-1",
        title: "Master Service Agreement",
        fileName: "msa.pdf",
        mimeType: "application/pdf",
        type: "CONTRACT",
        extractionStatus: "INDEXED",
        caseId: null,
        clientId: null,
        taskId: null,
        createdAt: new Date("2026-04-01T10:00:00.000Z"),
        rank: 4.2,
        headline: "<mark>service</mark> agreement",
        totalCount: BigInt(1)
      }
    ]);

    const result = await searchDocuments(actor, {
      q: "service agreement",
      page: 1,
      pageSize: 5
    });

    expect(result).toEqual({
      query: "service agreement",
      total: 1,
      items: [
        {
          id: "doc-1",
          title: "Master Service Agreement",
          fileName: "msa.pdf",
          mimeType: "application/pdf",
          type: "CONTRACT",
          extractionStatus: "INDEXED",
          caseId: null,
          clientId: null,
          taskId: null,
          headline: "<mark>service</mark> agreement",
          rank: 4.2,
          createdAt: "2026-04-01T10:00:00.000Z"
        }
      ]
    });
  });

  it("normalizes rank and createdAt when repository returns string values", async () => {
    searchFirmDocumentsRaw.mockResolvedValueOnce([
      {
        id: "doc-2",
        title: "Lease",
        fileName: "lease.pdf",
        mimeType: "application/pdf",
        type: "CONTRACT",
        extractionStatus: "INDEXED",
        caseId: "case-1",
        clientId: null,
        taskId: null,
        createdAt: "2026-04-10T00:00:00.000Z",
        rank: "2.75",
        headline: null,
        totalCount: 1
      }
    ]);

    const result = await searchDocuments(actor, { q: "lease" });

    expect(result.items[0]?.rank).toBe(2.75);
    expect(result.items[0]?.createdAt).toBe("2026-04-10T00:00:00.000Z");
    expect(result.items[0]?.headline).toBe("");
  });
});
