import { describe, expect, it } from "vitest";
import {
  getSelectableEditionKeys,
  getTrialDaysRemaining,
  groupPermissionsByResource
} from "./SettingsPage";

describe("SettingsPage helpers", () => {
  it("returns supported self-serve edition targets", () => {
    expect(getSelectableEditionKeys()).toEqual([
      "solo_offline",
      "solo_online",
      "local_firm_offline",
      "local_firm_online"
    ]);
  });

  it("computes remaining trial days by date boundaries", () => {
    const now = new Date("2026-04-21T12:00:00");
    const sameDay = getTrialDaysRemaining(true, "2026-04-21T18:00:00", now);
    const nextDay = getTrialDaysRemaining(true, "2026-04-22T12:00:00", now);
    const pastDay = getTrialDaysRemaining(true, "2026-04-19T12:00:00", now);

    expect(sameDay).toBe(0);
    expect(nextDay).toBe(1);
    expect(pastDay).toBe(0);
  });

  it("returns null for disabled or invalid trial metadata", () => {
    expect(getTrialDaysRemaining(false, "2026-04-22T01:00:00.000Z")).toBeNull();
    expect(getTrialDaysRemaining(true, null)).toBeNull();
    expect(getTrialDaysRemaining(true, "not-a-date")).toBeNull();
  });

  it("groups permission keys by resource", () => {
    expect(
      groupPermissionsByResource([
        "cases:read",
        "cases:update",
        "reports:read",
        "settings:update"
      ])
    ).toEqual({
      cases: ["cases:read", "cases:update"],
      reports: ["reports:read"],
      settings: ["settings:update"]
    });
  });
});
