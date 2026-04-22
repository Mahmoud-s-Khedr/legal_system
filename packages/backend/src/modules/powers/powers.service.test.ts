import { beforeEach, describe, expect, it, vi } from "vitest";
import { PoaStatus, PoaType } from "@elms/shared";
import { makeSessionUser } from "../../test-utils/session-user.js";

const mockPrisma = {
  powerOfAttorney: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
};

const withTenant = vi.fn();
const writeAuditLog = vi.fn();
const writeReadAuditLog = vi.fn();

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../../db/tenant.js", () => ({ withTenant }));
vi.mock("../../services/audit.service.js", () => ({ writeAuditLog, writeReadAuditLog }));

const {
  assertPoaNotRevoked,
  listPowers,
  getPower,
  createPower,
  updatePower,
  revokePower,
  deletePower
} = await import("./powers.service.js");

const actor = makeSessionUser({ id: "u-1", firmId: "f-1" });
const audit = { ipAddress: "127.0.0.1", userAgent: "vitest" };
const now = new Date("2026-04-20T00:00:00.000Z");

const poaRow = {
  id: "poa-1",
  firmId: "f-1",
  clientId: "c-1",
  caseId: null,
  number: "10",
  type: "GENERAL",
  status: "ACTIVE",
  issuedAt: now,
  expiresAt: null,
  revokedAt: null,
  revocationReason: null,
  scopeTextAr: null,
  hasSelfContractClause: false,
  commercialRegisterId: null,
  agentCertExpiry: null,
  agentResidencyStatus: null,
  createdAt: now,
  updatedAt: now,
  client: { name: "Client" }
};

beforeEach(() => {
  vi.clearAllMocks();
  withTenant.mockImplementation(async (_prisma, _firmId, fn) => fn(mockPrisma));
});

describe("powers.service", () => {
  it("asserts poa existence and revoked guard", async () => {
    mockPrisma.powerOfAttorney.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ status: "REVOKED" }).mockResolvedValueOnce({ status: "ACTIVE" });

    await expect(assertPoaNotRevoked("missing")).rejects.toMatchObject({ statusCode: 404 });
    await expect(assertPoaNotRevoked("revoked")).rejects.toMatchObject({ statusCode: 422 });
    await expect(assertPoaNotRevoked("ok")).resolves.toBeUndefined();
  });

  it("lists and gets powers by firm", async () => {
    mockPrisma.powerOfAttorney.findMany.mockResolvedValue([poaRow]);
    mockPrisma.powerOfAttorney.count.mockResolvedValue(1);
    mockPrisma.powerOfAttorney.findFirst.mockResolvedValue(poaRow);

    const list = await listPowers(actor, { status: PoaStatus.ACTIVE }, { page: 1, limit: 20 });
    expect(list.total).toBe(1);

    const item = await getPower(actor, "poa-1", audit as never);
    expect(writeReadAuditLog).toHaveBeenCalledWith(mockPrisma, audit, "PowerOfAttorney", "poa-1");
    expect(item.clientName).toBe("Client");
  });

  it("creates power with validation and audit", async () => {
    await expect(
      createPower(actor, { clientId: "c-1", type: PoaType.SPECIAL }, audit as never)
    ).rejects.toMatchObject({ statusCode: 400 });

    mockPrisma.powerOfAttorney.create.mockResolvedValue(poaRow);
    const created = await createPower(
      actor,
      { clientId: "c-1", type: PoaType.GENERAL, scopeTextAr: "scope" },
      audit as never
    );

    expect(mockPrisma.powerOfAttorney.create).toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalledWith(
      mockPrisma,
      audit,
      expect.objectContaining({ action: "CREATE", entityType: "PowerOfAttorney" })
    );
    expect(created.id).toBe("poa-1");
  });

  it("updates and revokes powers with status guards", async () => {
    mockPrisma.powerOfAttorney.findFirst
      .mockResolvedValueOnce({ id: "poa-1", status: "ACTIVE" })
      .mockResolvedValueOnce({ id: "poa-1", status: "ACTIVE" })
      .mockResolvedValueOnce({ id: "poa-1", status: "REVOKED" });
    mockPrisma.powerOfAttorney.update.mockResolvedValue(poaRow);

    const updated = await updatePower(actor, "poa-1", { number: "11" }, audit as never);
    expect(updated.id).toBe("poa-1");

    const revoked = await revokePower(actor, "poa-1", { reason: "expired" }, audit as never);
    expect(revoked.id).toBe("poa-1");

    await expect(revokePower(actor, "poa-1", { reason: "again" }, audit as never)).rejects.toMatchObject({ statusCode: 422 });
  });

  it("deletes existing power and returns not-found on missing", async () => {
    mockPrisma.powerOfAttorney.findFirst.mockResolvedValueOnce({ id: "poa-1" }).mockResolvedValueOnce(null);
    mockPrisma.powerOfAttorney.delete.mockResolvedValue({ id: "poa-1" });

    await deletePower(actor, "poa-1", audit as never);
    expect(mockPrisma.powerOfAttorney.delete).toHaveBeenCalledWith({ where: { id: "poa-1", firmId: "f-1" } });

    await expect(deletePower(actor, "missing", audit as never)).rejects.toMatchObject({ statusCode: 404 });
  });
});
