import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockClientDb = {
  count: vi.fn(),
  findMany: vi.fn(),
  findFirstOrThrow: vi.fn(),
  create: vi.fn(),
  update: vi.fn()
};
const mockAuditLog = { create: vi.fn() };
const mockClientContact = { deleteMany: vi.fn() };

const mockPrisma = {
  client: mockClientDb,
  auditLog: mockAuditLog,
  clientContact: mockClientContact,
  caseParty: { findMany: vi.fn() }
};

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn((_prisma: unknown, _firmId: string, fn: (tx: typeof mockPrisma) => unknown) =>
    fn(mockPrisma)
  )
}));
vi.mock("../../services/audit.service.js", () => ({ writeAuditLog: vi.fn() }));

const { listClients, createClient, getClient, updateClient, removeClient } = await import(
  "./clients.service.js"
);

// ── Helpers ───────────────────────────────────────────────────────────────────

const actor = makeSessionUser({
  email: "test@elms.test",
  fullName: "Test Admin",
  permissions: ["clients:read", "clients:create", "clients:update", "clients:delete"]
});

const audit = { actor };
const now = new Date("2026-03-21T00:00:00.000Z");

function makeClientRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "client-1",
    name: "Ahmed Hassan",
    type: "INDIVIDUAL" as const,
    phone: "+20111111111",
    email: "ahmed@example.com",
    governorate: "Cairo",
    preferredLanguage: "ar",
    nationalId: null,
    commercialRegister: null,
    taxNumber: null,
    createdAt: now,
    updatedAt: now,
    contacts: [],
    _count: { parties: 0, invoices: 0, documents: 0 },
    ...overrides
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.caseParty.findMany.mockResolvedValue([]);
});

describe("listClients", () => {
  it("returns paginated clients for the firm", async () => {
    mockClientDb.count.mockResolvedValue(2);
    mockClientDb.findMany.mockResolvedValue([makeClientRecord(), makeClientRecord({ id: "client-2", name: "Sara Ali" })]);

    const result = await listClients(actor, undefined, { page: 1, limit: 20 });

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe("client-1");
  });

  it("filters by firmId for tenant isolation", async () => {
    mockClientDb.count.mockResolvedValue(0);
    mockClientDb.findMany.mockResolvedValue([]);

    await listClients(actor, undefined, { page: 1, limit: 20 });

    expect(mockClientDb.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ firmId: "firm-1", deletedAt: null })
      })
    );
  });

  it("applies search filter when provided", async () => {
    mockClientDb.count.mockResolvedValue(0);
    mockClientDb.findMany.mockResolvedValue([]);

    await listClients(actor, "Ahmed", { page: 1, limit: 20 });

    expect(mockClientDb.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) })
      })
    );
  });
});

describe("createClient", () => {
  it("creates a client and writes audit log", async () => {
    const record = makeClientRecord();
    mockClientDb.create.mockResolvedValue(record);

    const { writeAuditLog } = await import("../../services/audit.service.js");

    const result = await createClient(
      actor,
      { name: "Ahmed Hassan", type: "INDIVIDUAL" as never },
      audit
    );

    expect(result.client.id).toBe("client-1");
    expect(result.client.name).toBe("Ahmed Hassan");
    expect(mockClientDb.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ firmId: "firm-1", name: "Ahmed Hassan" })
      })
    );
    expect(writeAuditLog).toHaveBeenCalled();
  });
});

describe("getClient", () => {
  it("returns the mapped client DTO", async () => {
    mockClientDb.findFirstOrThrow.mockResolvedValue(makeClientRecord());

    const result = await getClient(actor, "client-1");

    expect(result.id).toBe("client-1");
    expect(result.linkedCaseCount).toBe(0);
    expect(result.invoiceCount).toBe(0);
  });

  it("queries by id and firmId", async () => {
    mockClientDb.findFirstOrThrow.mockResolvedValue(makeClientRecord());

    await getClient(actor, "client-1");

    expect(mockClientDb.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "client-1", firmId: "firm-1", deletedAt: null })
      })
    );
  });
});

describe("updateClient", () => {
  it("updates client fields", async () => {
    const existing = makeClientRecord({ name: "Old Name" });
    const updated = makeClientRecord({ name: "New Name" });
    mockClientDb.findFirstOrThrow.mockResolvedValue(existing);
    mockClientDb.update.mockResolvedValue(updated);

    const result = await updateClient(
      actor,
      "client-1",
      { name: "New Name", type: "INDIVIDUAL" as never },
      audit
    );

    expect(result.name).toBe("New Name");
    expect(mockClientContact.deleteMany).toHaveBeenCalledWith({ where: { clientId: "client-1" } });
    expect(mockClientDb.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "client-1" } })
    );
  });
});

describe("removeClient", () => {
  it("soft-deletes the client by setting deletedAt", async () => {
    mockClientDb.findFirstOrThrow.mockResolvedValue(makeClientRecord());
    mockClientDb.update.mockResolvedValue({ ...makeClientRecord(), deletedAt: now });

    const result = await removeClient(actor, "client-1", audit);

    expect(result.success).toBe(true);
    expect(mockClientDb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "client-1" },
        data: expect.objectContaining({ deletedAt: expect.any(Date) })
      })
    );
  });
});
