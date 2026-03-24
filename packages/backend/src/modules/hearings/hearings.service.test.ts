import { describe, expect, it, vi } from "vitest";

vi.mock("../../db/prisma.js", () => ({
  prisma: {}
}));

const { buildSessionDatetimeFilter } = await import("./hearings.service.js");

describe("buildSessionDatetimeFilter", () => {
  it("returns an empty filter when no visible range is provided", () => {
    expect(buildSessionDatetimeFilter({})).toEqual({});
  });

  it("builds a bounded date filter from from/to params", () => {
    const filter = buildSessionDatetimeFilter({
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-31T23:59:59.999Z"
    });

    expect(filter).toEqual({
      sessionDatetime: {
        gte: new Date("2026-03-01T00:00:00.000Z"),
        lte: new Date("2026-03-31T23:59:59.999Z")
      }
    });
  });
});
