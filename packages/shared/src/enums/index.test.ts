import { describe, expect, it } from "vitest";
import { AuthMode, EditionKey, Language, NotificationChannel } from "../index";

describe("shared enum exports", () => {
  it("exposes stable language values", () => {
    expect(Language.AR).toBe("AR");
    expect(Language.EN).toBe("EN");
    expect(Language.FR).toBe("FR");
    expect(Object.values(Language)).toEqual(["AR", "EN", "FR"]);
  });

  it("preserves public enum values through the shared barrel", () => {
    expect(AuthMode.LOCAL).toBe("local");
    expect(EditionKey.LOCAL_FIRM_OFFLINE).toBe("local_firm_offline");
    expect(NotificationChannel.DESKTOP_OS).toBe("DESKTOP_OS");
  });
});
