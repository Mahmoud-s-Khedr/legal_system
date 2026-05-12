import { describe, expect, it } from "vitest";
import {
  EMPTY_COURT,
  buildCaseHearingsUrl,
  caseTabs,
  pickActiveCourt,
  validateAssignmentForm,
  validatePartyForm
} from "./CaseDetailPage";

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

  it("builds hearings API URL with encoded caseId and explicit page/limit", () => {
    expect(buildCaseHearingsUrl("case id/with space", 3, 20)).toBe(
      "/api/hearings?caseId=case%20id%2Fwith%20space&page=3&limit=20"
    );
  });

  it("validates party form required fields", () => {
    const t = (key: string) => key;
    expect(
      validatePartyForm({ name: "", partyType: "OPPONENT", clientId: undefined }, t)
    ).toMatchObject({ name: "errors.validation.issue.required" });
    expect(
      validatePartyForm({ name: "Client", partyType: "CLIENT", clientId: "" }, t)
    ).toMatchObject({ clientId: "errors.validation.issue.required" });
  });

  it("validates assignment required user", () => {
    const t = (key: string) => key;
    expect(validateAssignmentForm({ userId: "" }, t)).toMatchObject({
      userId: "errors.validation.issue.required"
    });
    expect(validateAssignmentForm({ userId: "user-1" }, t)).toEqual({});
  });
});
