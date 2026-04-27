import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const mockTx = {
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  user: { findMany: vi.fn() },
  caseAssignment: { count: vi.fn() },
  task: { count: vi.fn() },
  caseSession: { count: vi.fn() },
  invoice: { findMany: vi.fn() },
  expense: { findMany: vi.fn() },
  case: { findFirst: vi.fn() }
};

const mockPrisma = {
  $transaction: vi.fn(),
  ...mockTx
};

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn((_prisma: unknown, _firmId: string, fn: (tx: typeof mockTx) => unknown) => fn(mockTx))
}));

const { caseStatusDistribution, hearingOutcomes, revenueReport } = await import("./reports.service.js");

const actor = makeSessionUser({ permissions: ["reports:read"] });

function extractTaggedSql(callArg: unknown): string {
  if (Array.isArray(callArg)) {
    return callArg.join("?");
  }
  if (
    typeof callArg === "object" &&
    callArg !== null &&
    "raw" in callArg &&
    Array.isArray((callArg as { raw?: unknown }).raw)
  ) {
    return ((callArg as { raw: string[] }).raw).join("?");
  }
  return String(callArg ?? "");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("caseStatusDistribution", () => {
  it("uses camelCase column names and maps bigint counts", async () => {
    mockTx.$queryRaw.mockResolvedValue([{ status: "ACTIVE", count: BigInt(3) }]);

    const result = await caseStatusDistribution(actor, { dateFrom: "2026-01-01", dateTo: "2026-12-31" });

    const queryArg = mockTx.$queryRaw.mock.calls[0]?.[0];
    const sql = extractTaggedSql(queryArg);

    expect(sql).toContain('"firmId"');
    expect(sql).toContain('"createdAt"');
    expect(sql).not.toContain("firm_id");
    expect(result).toEqual([{ status: "ACTIVE", count: 3 }]);
  });
});

describe("hearingOutcomes", () => {
  it("queries CaseSession with sessionDatetime and firm-scoped Case join", async () => {
    mockTx.$queryRaw.mockResolvedValue([{ outcome: "DECIDED", count: BigInt(2) }]);

    const result = await hearingOutcomes(actor, { dateFrom: "2026-01-01", dateTo: "2026-12-31" });

    const queryArg = mockTx.$queryRaw.mock.calls[0]?.[0];
    const sql = extractTaggedSql(queryArg);

    expect(sql).toContain('FROM "CaseSession"');
    expect(sql).toContain('"sessionDatetime"');
    expect(sql).toContain('c."firmId"');
    expect(sql).not.toContain('FROM "Hearing"');
    expect(result).toEqual([{ outcome: "DECIDED", count: 2 }]);
  });
});

describe("revenueReport", () => {
  it("uses invoice/payment camelCase identifiers in raw SQL", async () => {
    mockTx.$queryRaw.mockResolvedValue([{ month: "2026-03", invoiced: "1000", paid: "500" }]);

    const result = await revenueReport(actor, { dateFrom: "2026-01-01", dateTo: "2026-12-31" });

    const queryArg = mockTx.$queryRaw.mock.calls[0]?.[0];
    const sql = extractTaggedSql(queryArg);

    expect(sql).toContain('"totalAmount"');
    expect(sql).toContain('p."invoiceId"');
    expect(sql).toContain('"firmId"');
    expect(sql).toContain('"issuedAt"');
    expect(sql).not.toContain("total_amount");
    expect(result).toEqual([{ month: "2026-03", invoiced: "1000", paid: "500" }]);
  });
});
