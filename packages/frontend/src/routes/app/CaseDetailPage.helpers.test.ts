import { describe, expect, it } from "vitest";
import { EMPTY_COURT, caseTabs, pickActiveCourt } from "./CaseDetailPage";

describe("CaseDetailPage helpers", () => {
  it("exposes stable case tabs and empty court default", () => {
    expect(caseTabs).toContain("overview");
    expect(caseTabs).toContain("references");
    expect(EMPTY_COURT.courtName).toBe("");
    expect(EMPTY_COURT.courtLevel).toBe("");
  });

  it("picks active court first, then falls back to first court", () => {
    const active = pickActiveCourt([
      { id: "1", isActive: false },
      { id: "2", isActive: true }
    ] as never);
    const fallback = pickActiveCourt([{ id: "1", isActive: false }] as never);
    const none = pickActiveCourt([] as never);

    expect(active?.id).toBe("2");
    expect(fallback?.id).toBe("1");
    expect(none).toBeNull();
  });
});
