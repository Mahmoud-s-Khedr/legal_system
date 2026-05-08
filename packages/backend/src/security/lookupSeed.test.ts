import { describe, it, expect, vi } from "vitest";
import { ensureSystemLookupOptions } from "./lookupSeed.js";

describe("ensureSystemLookupOptions", () => {
  it("seeds the canonical PartyRole system list", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const findMany = vi.fn().mockResolvedValue([]);
    const create = vi.fn().mockResolvedValue({});
    const update = vi.fn().mockResolvedValue({});
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });

    const prisma = {
      lookupOption: { findFirst, findMany, create, update, deleteMany }
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

  it("seeds canonical CourtType categories and deactivates legacy CourtType keys", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const findMany = vi.fn().mockResolvedValue([]);
    const create = vi.fn().mockResolvedValue({});
    const update = vi.fn().mockResolvedValue({});
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });

    const prisma = {
      lookupOption: { findFirst, findMany, create, update, updateMany, deleteMany }
    } as never;

    await ensureSystemLookupOptions(prisma);

    const courtTypeKeys = create.mock.calls
      .map((call) => call[0]?.data)
      .filter((data) => data?.entity === "CourtType")
      .map((data) => data.key)
      .sort();

    expect(courtTypeKeys).toEqual(
      [
        "CIVIL_COURT",
        "FAMILY_COURT",
        "MISDEMEANOR_COURT",
        "CRIMINAL_COURT",
        "ECONOMIC_COURT",
        "STATE_COUNCIL_ADMINISTRATIVE_COURT",
        "STATE_COUNCIL_DISCIPLINARY_COURT",
        "STATE_COUNCIL_SUPREME_ADMINISTRATIVE_COURT",
        "SUPREME_CONSTITUTIONAL_COURT",
        "COURT_OF_URGENT_MATTERS",
        "LABOR_COURT",
        "COURT_OF_CASSATION",
        "JUVENILE_CHILD_COURT",
        "TRAFFIC_COURT",
        "STATE_SECURITY_COURT"
      ].sort()
    );

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          entity: "CourtType",
          key: expect.objectContaining({
            notIn: expect.arrayContaining(["CIVIL_COURT", "STATE_SECURITY_COURT"])
          })
        })
      })
    );
  });

  it("deletes duplicate system canonical rows before seeding", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([
        { id: "l1", key: "PARTIAL" },
        { id: "l2", key: "PARTIAL" }
      ])
      .mockResolvedValueOnce([
        { id: "t1", key: "CIVIL_COURT" },
        { id: "t2", key: "CIVIL_COURT" }
      ]);
    const create = vi.fn().mockResolvedValue({});
    const update = vi.fn().mockResolvedValue({});
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });

    const prisma = {
      lookupOption: { findFirst, findMany, create, update, updateMany, deleteMany }
    } as never;

    await ensureSystemLookupOptions(prisma);

    const deletedIds = deleteMany.mock.calls.flatMap(
      (call) => call[0]?.where?.id?.in ?? []
    );
    expect(deletedIds).toEqual(expect.arrayContaining(["l2", "t2"]));
  });
});
