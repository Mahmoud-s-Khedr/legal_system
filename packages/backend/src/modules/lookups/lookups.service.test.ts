import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const inTenantTransaction = vi.fn();
const writeAuditLog = vi.fn();

const createFirmLookupOption = vi.fn();
const deleteLookupOptionById = vi.fn();
const findFirmLookupOptionByKey = vi.fn();
const getFirmLookupOptionByIdOrThrow = vi.fn();
const listActiveLookupOptionsByEntity = vi.fn();
const updateLookupOptionById = vi.fn();

vi.mock("../../repositories/unitOfWork.js", () => ({ inTenantTransaction }));
vi.mock("../../services/audit.service.js", () => ({ writeAuditLog }));
vi.mock("../../repositories/lookups/lookups.repository.js", () => ({
  createFirmLookupOption,
  deleteLookupOptionById,
  findFirmLookupOptionByKey,
  getFirmLookupOptionByIdOrThrow,
  listActiveLookupOptionsByEntity,
  updateLookupOptionById
}));

const {
  listLookupOptions,
  createLookupOption,
  updateLookupOption,
  deleteLookupOption
} = await import("./lookups.service.js");

const actor = makeSessionUser({ firmId: "f-1" });
const audit = { ipAddress: "127.0.0.1", userAgent: "vitest" };

const option = {
  id: "o-1",
  firmId: "f-1",
  entity: "CaseType",
  key: "CIVIL",
  labelAr: "مدني",
  labelEn: "Civil",
  labelFr: "Civil",
  isSystem: false,
  isActive: true,
  sortOrder: 1,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z")
};

beforeEach(() => {
  vi.clearAllMocks();
  inTenantTransaction.mockImplementation(async (_firmId, fn) => fn({ tx: true }));
});

describe("lookups.service", () => {
  it("lists lookup options", async () => {
    listActiveLookupOptionsByEntity.mockResolvedValue([option]);

    const result = await listLookupOptions(actor, "CaseType");

    expect(result.total).toBe(1);
    expect(result.items[0]?.key).toBe("CIVIL");
  });

  it("creates lookup option and rejects duplicate keys", async () => {
    findFirmLookupOptionByKey.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "dup" });
    createFirmLookupOption.mockResolvedValue(option);

    const created = await createLookupOption(
      actor,
      "CaseType",
      { key: "CIVIL", labelAr: "مدني", labelEn: "Civil", labelFr: "Civil" },
      audit as never
    );

    expect(createFirmLookupOption).toHaveBeenCalledWith(
      { tx: true },
      "f-1",
      "CaseType",
      expect.objectContaining({ key: "CIVIL" })
    );
    expect(created.id).toBe("o-1");

    await expect(
      createLookupOption(
        actor,
        "CaseType",
        { key: "CIVIL", labelAr: "مدني", labelEn: "Civil", labelFr: "Civil" },
        audit as never
      )
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("updates lookup option and blocks system options", async () => {
    getFirmLookupOptionByIdOrThrow.mockResolvedValueOnce({ ...option, isSystem: false }).mockResolvedValueOnce({ ...option, isSystem: true });
    updateLookupOptionById.mockResolvedValue({ ...option, labelEn: "Updated" });

    const updated = await updateLookupOption(
      actor,
      "CaseType",
      "o-1",
      { labelEn: "Updated" },
      audit as never
    );

    expect(updateLookupOptionById).toHaveBeenCalledWith({ tx: true }, "o-1", { labelEn: "Updated" });
    expect(updated.labelEn).toBe("Updated");

    await expect(
      updateLookupOption(actor, "CaseType", "o-1", { labelEn: "x" }, audit as never)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("deletes lookup option and blocks system options", async () => {
    getFirmLookupOptionByIdOrThrow.mockResolvedValueOnce({ ...option, isSystem: false }).mockResolvedValueOnce({ ...option, isSystem: true });

    const result = await deleteLookupOption(actor, "CaseType", "o-1", audit as never);

    expect(deleteLookupOptionById).toHaveBeenCalledWith({ tx: true }, "o-1");
    expect(result).toEqual({ success: true });

    await expect(deleteLookupOption(actor, "CaseType", "o-1", audit as never)).rejects.toMatchObject({ statusCode: 403 });
  });
});
