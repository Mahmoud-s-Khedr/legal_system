import { describe, expect, it } from "vitest";
import { parseReportListResponse } from "./reports";

describe("parseReportListResponse", () => {
  it("accepts valid rows", () => {
    const parsed = parseReportListResponse("case-status", {
      items: [{ status: "OPEN", count: 2 }],
      total: 1,
      page: 1,
      pageSize: 20
    });

    expect(parsed.items[0]?.status).toBe("OPEN");
  });

  it("throws on invalid row schema", () => {
    expect(() =>
      parseReportListResponse("revenue", {
        items: [{ month: "2026-01", invoiced: 100, paid: "42" }],
        total: 1,
        page: 1,
        pageSize: 20
      })
    ).toThrow("Invalid report row schema.");
  });
});
