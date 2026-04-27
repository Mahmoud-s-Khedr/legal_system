import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockCaseDb = {
  count: vi.fn(),
  findMany: vi.fn(),
  findFirstOrThrow: vi.fn(),
  create: vi.fn(),
  update: vi.fn()
};
const mockStatusHistory = { create: vi.fn() };
const mockParty = {
  create: vi.fn(),
  delete: vi.fn(),
  findMany: vi.fn(),
  findFirstOrThrow: vi.fn(),
  update: vi.fn(),
  count: vi.fn()
};
const mockAssignment = {
  create: vi.fn(),
  findFirst: vi.fn(),
  findFirstOrThrow: vi.fn(),
  update: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn()
};
const mockCourt = {
  findMany: vi.fn(),
  count: vi.fn(),
  aggregate: vi.fn(),
  create: vi.fn()
};
const mockAuditLog = { create: vi.fn() };
const mockClient = { findFirstOrThrow: vi.fn(), findMany: vi.fn() };

const mockPrisma = {
  case: mockCaseDb,
  caseStatusHistory: mockStatusHistory,
  caseParty: mockParty,
  caseAssignment: mockAssignment,
  caseCourt: mockCourt,
  auditLog: mockAuditLog,
  client: mockClient
};

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn((_prisma: unknown, _firmId: string, fn: (tx: typeof mockPrisma) => unknown) =>
    fn(mockPrisma)
  )
}));
vi.mock("../../services/audit.service.js", () => ({
  writeAuditLog: vi.fn()
}));

const {
  listCases,
  getCase,
  createCase,
  updateCase,
  deleteCase,
  changeCaseStatus,
  addCaseParty,
  addCaseAssignment,
  unassignCase,
  checkConflictOfInterest,
  listCaseParties,
  listCaseAssignments,
  listCaseCourts,
  addCaseCourt
} = await import("./cases.service.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

const actor = makeSessionUser({
  email: "test@elms.test",
  fullName: "Test Admin",
  permissions: ["cases:read", "cases:create", "cases:update", "cases:delete", "cases:status", "cases:assign"]
});

const audit = { actor };

const now = new Date("2026-03-21T00:00:00.000Z");

function makeCaseRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "case-1",
    title: "Test Case",
    caseNumber: "2026/001",
    judicialYear: 2026,
    type: "CIVIL",
    courtName: "Cairo Court",
    circuit: "1st",
    courtLevel: "FIRST",
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
    courts: [],
    assignments: [],
    parties: [],
    statusHistory: [
      { id: "sh-1", fromStatus: null, toStatus: "ACTIVE", changedAt: now, note: "Case created" }
    ],
    _count: { sessions: 0, tasks: 0 },
    ...overrides
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockClient.findFirstOrThrow.mockResolvedValue({ id: "client-1" });
  mockClient.findMany.mockResolvedValue([]);
  mockParty.findMany.mockResolvedValue([]);
  mockCaseDb.findFirstOrThrow.mockResolvedValue(makeCaseRecord());
});

describe("listCases", () => {
  it("returns paginated cases for the firm", async () => {
    const record = makeCaseRecord();
    mockCaseDb.count.mockResolvedValue(1);
    mockCaseDb.findMany.mockResolvedValue([record]);

    const result = await listCases(actor, { page: 1, limit: 20 });

    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("case-1");
  });

  it("passes firmId filter to the query", async () => {
    mockCaseDb.count.mockResolvedValue(0);
    mockCaseDb.findMany.mockResolvedValue([]);

    await listCases(actor, { page: 1, limit: 20 });

    expect(mockCaseDb.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ firmId: "firm-1", deletedAt: null })
      })
    );
  });

  it("applies pagination with correct skip/take", async () => {
    mockCaseDb.count.mockResolvedValue(50);
    mockCaseDb.findMany.mockResolvedValue([]);

    await listCases(actor, { page: 3, limit: 10 });

    expect(mockCaseDb.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });
});

describe("getCase", () => {
  it("returns the mapped case DTO", async () => {
    const record = makeCaseRecord();
    mockCaseDb.findFirstOrThrow.mockResolvedValue(record);

    const result = await getCase(actor, "case-1");

    expect(result.id).toBe("case-1");
    expect(result.title).toBe("Test Case");
    expect(result.status).toBe("ACTIVE");
    expect(result.hearingCount).toBe(0);
    expect(result.taskCount).toBe(0);
  });

  it("queries by id and firmId for tenant isolation", async () => {
    mockCaseDb.findFirstOrThrow.mockResolvedValue(makeCaseRecord());

    await getCase(actor, "case-1");

    expect(mockCaseDb.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "case-1", firmId: "firm-1", deletedAt: null })
      })
    );
  });
});

describe("createCase", () => {
  it("creates a case with ACTIVE status and writes audit log", async () => {
    const record = makeCaseRecord();
    mockCaseDb.create.mockResolvedValue(record);

    const { writeAuditLog } = await import("../../services/audit.service.js");

    const result = await createCase(
      actor,
      { clientId: "client-1", title: "Test Case", caseNumber: "2026/001", type: "CIVIL" },
      audit
    );

    expect(result.id).toBe("case-1");
    expect(result.status).toBe("ACTIVE");
    expect(mockCaseDb.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firmId: "firm-1",
          title: "Test Case",
          status: "ACTIVE"
        })
      })
    );
    expect(writeAuditLog).toHaveBeenCalled();
  });
});

describe("updateCase", () => {
  it("updates case fields and returns the updated DTO", async () => {
    const existing = makeCaseRecord({ title: "Old Title" });
    const updated = makeCaseRecord({ title: "New Title" });
    mockCaseDb.findFirstOrThrow.mockResolvedValue(existing);
    mockCaseDb.update.mockResolvedValue(updated);

    const result = await updateCase(actor, "case-1", { title: "New Title", caseNumber: "2026/001", type: "CIVIL" }, audit);

    expect(result.title).toBe("New Title");
    expect(mockCaseDb.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "case-1" } })
    );
  });
});

describe("deleteCase", () => {
  it("soft-deletes the case by setting deletedAt", async () => {
    const existing = makeCaseRecord();
    mockCaseDb.findFirstOrThrow.mockResolvedValue(existing);
    mockCaseDb.update.mockResolvedValue({ ...existing, deletedAt: now });

    const result = await deleteCase(actor, "case-1", audit);

    expect(result.success).toBe(true);
    expect(mockCaseDb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "case-1" },
        data: expect.objectContaining({ deletedAt: expect.any(Date) })
      })
    );
  });
});

describe("changeCaseStatus", () => {
  it("updates case status and returns the updated DTO", async () => {
    const existing = makeCaseRecord({ status: "ACTIVE" });
    const updatedRecord = makeCaseRecord({ status: "CLOSED" });
    mockCaseDb.findFirstOrThrow
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(updatedRecord);
    mockCaseDb.update.mockResolvedValue(updatedRecord);
    mockStatusHistory.create.mockResolvedValue({});

    const result = await changeCaseStatus(
      actor,
      "case-1",
      { status: "CLOSED" as never, note: "Resolved" },
      audit
    );

    expect(result.status).toBe("CLOSED");
  });
});

describe("addCaseParty", () => {
  it("adds a party and returns the updated case", async () => {
    mockParty.create.mockResolvedValue({});

    const updatedRecord = makeCaseRecord({
      parties: [{ id: "party-1", clientId: null, name: "Jane Smith", role: "OPPONENT", partyType: "OPPONENT" }]
    });
    mockCaseDb.findFirstOrThrow.mockResolvedValue(updatedRecord);

    const result = await addCaseParty(
      actor,
      "case-1",
      { name: "Jane Smith", role: "OPPONENT" as never, partyType: "OPPONENT" as never },
      audit
    );

    expect(mockParty.create).toHaveBeenCalled();
    expect(result.case.parties).toHaveLength(1);
  });

  it("checks conflicts for opponent parties", async () => {
    mockParty.create.mockResolvedValue({});
    mockParty.findMany.mockResolvedValue([
      {
        name: "Conflict Name",
        case: { id: "case-2", title: "Other Case" }
      }
    ]);
    mockClient.findMany.mockResolvedValue([
      {
        name: "Client Match",
        parties: [{ case: { id: "case-3", title: "Third Case" } }]
      }
    ]);

    const result = await addCaseParty(
      actor,
      "case-1",
      { name: "Conflict Name", role: "OPPONENT" as never, partyType: "OPPONENT" as never },
      audit
    );

    expect(result.conflictWarnings).toHaveLength(2);
    expect(result.conflictWarnings[0]?.conflictingCaseId).toBe("case-2");
  });
});

describe("addCaseAssignment", () => {
  it("prevents duplicate active assignments for the same user", async () => {
    mockAssignment.findFirst.mockResolvedValue({ id: "existing-assignment" });

    await expect(
      addCaseAssignment(actor, "case-1", { userId: "user-2", roleOnCase: "LEAD" as never }, audit)
    ).rejects.toThrow();
  });

  it("creates an assignment when no active one exists", async () => {
    const caseRecord = makeCaseRecord();
    mockAssignment.findFirst.mockResolvedValue(null);
    mockAssignment.create.mockResolvedValue({});
    mockCaseDb.findFirstOrThrow.mockResolvedValue(caseRecord);

    const result = await addCaseAssignment(
      actor,
      "case-1",
      { userId: "user-2", roleOnCase: "LEAD" as never },
      audit
    );

    expect(mockAssignment.create).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});

describe("unassignCase", () => {
  it("sets unassignedAt on the assignment", async () => {
    const assignment = { id: "assignment-1", caseId: "case-1", userId: "user-2", unassignedAt: null };
    mockAssignment.findFirstOrThrow.mockResolvedValue({ id: assignment.id });
    mockAssignment.update.mockResolvedValue({ ...assignment, unassignedAt: now });
    const caseRecord = makeCaseRecord();
    mockCaseDb.findFirstOrThrow.mockResolvedValue(caseRecord);

    const result = await unassignCase(actor, "case-1", "assignment-1", audit);

    expect(mockAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ unassignedAt: expect.any(Date) })
      })
    );
    expect(mockAssignment.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "assignment-1",
          caseId: "case-1",
          assignedCase: {
            firmId: "firm-1",
            deletedAt: null
          }
        }
      })
    );
    expect(result).toBeDefined();
  });

  it("rejects when assignment does not belong to the provided case", async () => {
    mockAssignment.findFirstOrThrow.mockRejectedValueOnce(new Error("not found"));

    await expect(unassignCase(actor, "case-1", "assignment-999", audit)).rejects.toThrow(
      "not found"
    );

    expect(mockAssignment.update).not.toHaveBeenCalled();
  });
});

describe("checkConflictOfInterest", () => {
  it("returns warnings from direct party and client link matches", async () => {
    mockParty.findMany.mockResolvedValue([
      {
        name: "Alpha Corp",
        case: { id: "case-9", title: "Contract Dispute" }
      }
    ]);
    mockClient.findMany.mockResolvedValue([
      {
        name: "Alpha Corp",
        parties: [{ case: { id: "case-10", title: "Collections" } }]
      }
    ]);

    const warnings = await checkConflictOfInterest("firm-1", "alpha", "123");

    expect(warnings).toEqual([
      {
        name: "Alpha Corp",
        conflictingCaseId: "case-9",
        conflictingCaseTitle: "Contract Dispute"
      },
      {
        name: "Alpha Corp",
        conflictingCaseId: "case-10",
        conflictingCaseTitle: "Collections"
      }
    ]);
  });
});

describe("listCaseParties", () => {
  it("returns paginated party rows", async () => {
    mockParty.findMany.mockResolvedValue([
      {
        id: "party-1",
        clientId: null,
        name: "Opponent A",
        role: "OPPONENT",
        partyType: "OPPONENT"
      }
    ]);
    mockParty.count.mockResolvedValue(1);

    const result = await listCaseParties(actor, "case-1", { page: 1, limit: 10 });

    expect(result.total).toBe(1);
    expect(result.items[0]?.name).toBe("Opponent A");
    expect(mockParty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 10
      })
    );
  });
});

describe("listCaseAssignments", () => {
  it("returns active assignments by default", async () => {
    mockAssignment.findMany.mockResolvedValue([
      {
        id: "a-1",
        userId: "u-1",
        roleOnCase: "LEAD",
        assignedAt: now,
        unassignedAt: null,
        user: { fullName: "Lead Lawyer" }
      }
    ]);
    mockAssignment.count.mockResolvedValue(1);

    const result = await listCaseAssignments(actor, "case-1", {
      page: 1,
      limit: 10
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.userName).toBe("Lead Lawyer");
    expect(mockAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ unassignedAt: null })
      })
    );
  });
});

describe("court progression", () => {
  it("lists courts with normalized DTO fields", async () => {
    mockCourt.findMany.mockResolvedValue([
      {
        id: "court-1",
        caseId: "case-1",
        courtName: "Court A",
        courtLevel: "FIRST",
        circuit: null,
        caseNumber: "123",
        stageOrder: 0,
        startedAt: now,
        endedAt: null,
        isActive: true,
        notes: null,
        createdAt: now,
        updatedAt: now
      }
    ]);
    mockCourt.count.mockResolvedValue(1);

    const result = await listCaseCourts(actor, "case-1", { page: 1, limit: 5 });

    expect(result.total).toBe(1);
    expect(result.items[0]?.courtName).toBe("Court A");
  });

  it("auto-increments stage order when adding a court", async () => {
    mockCourt.aggregate.mockResolvedValue({ _max: { stageOrder: 2 } });
    mockCourt.create.mockResolvedValue({
      id: "court-2",
      caseId: "case-1",
      courtName: "Appeal Court",
      courtLevel: "APPEAL",
      circuit: null,
      caseNumber: null,
      stageOrder: 3,
      startedAt: now,
      endedAt: null,
      isActive: true,
      notes: null,
      createdAt: now,
      updatedAt: now
    });

    const result = await addCaseCourt(
      actor,
      "case-1",
      { courtName: "Appeal Court", courtLevel: "APPEAL" } as never,
      audit
    );

    expect(result.stageOrder).toBe(3);
    expect(mockCourt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stageOrder: 3 })
      })
    );
  });
});
