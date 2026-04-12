import { describe, expect, it } from "vitest";
import { canSubmitRestoreAcknowledgement, validateBackupTimeLocal } from "./desktopBackup";

describe("desktopBackup helpers", () => {
  it("validates HH:mm backup time", () => {
    expect(validateBackupTimeLocal("02:00")).toBe(true);
    expect(validateBackupTimeLocal("23:59")).toBe(true);
    expect(validateBackupTimeLocal("24:00")).toBe(false);
    expect(validateBackupTimeLocal("ab:12")).toBe(false);
  });

  it("requires both restore acknowledgements", () => {
    expect(canSubmitRestoreAcknowledgement(false, false)).toBe(false);
    expect(canSubmitRestoreAcknowledgement(true, false)).toBe(false);
    expect(canSubmitRestoreAcknowledgement(false, true)).toBe(false);
    expect(canSubmitRestoreAcknowledgement(true, true)).toBe(true);
  });
});
