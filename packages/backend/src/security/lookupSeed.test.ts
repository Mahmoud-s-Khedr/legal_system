import { describe, it, expect, vi } from "vitest";
import { ensureSystemLookupOptions } from "./lookupSeed.js";

describe("ensureSystemLookupOptions", () => {
  it("seeds the canonical PartyRole system list", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue({});
    const update = vi.fn().mockResolvedValue({});

    const prisma = {
      lookupOption: { findFirst, create, update }
    } as never;

    await ensureSystemLookupOptions(prisma);

    const partyRoleKeys = create.mock.calls
      .map((call) => call[0]?.data)
      .filter((data) => data?.entity === "PartyRole")
      .map((data) => data.key)
      .sort();

    expect(partyRoleKeys).toEqual(
      [
        "PLAINTIFF",
        "DEFENDANT",
        "EXECUTING_PARTY",
        "EXECUTED_AGAINST",
        "GARNISHEE",
        "THIRD_PARTY_HOLDER",
        "PUBLIC_PROSECUTION",
        "COMPLAINANT",
        "VICTIM",
        "REPORTER",
        "ACCUSED",
        "CRIMINAL_DEFENDANT",
        "OBJECTOR",
        "CIVIL_RIGHTS_CLAIMANT",
        "CIVILLY_RESPONSIBLE_PARTY",
        "APPELLANT",
        "APPELLEE",
        "CASSATION_PETITIONER",
        "CASSATION_RESPONDENT",
        "INTERVENER",
        "BROUGHT_IN_PARTY",
        "IMPLEADED_PARTY",
        "GUARANTOR",
        "LEGAL_REPRESENTATIVE",
        "GUARDIAN",
        "TRUSTEE",
        "CURATOR",
        "EXPERT",
        "ARBITRATOR",
        "WITNESS"
      ].sort()
    );
    expect(update).not.toHaveBeenCalled();
  });
});
