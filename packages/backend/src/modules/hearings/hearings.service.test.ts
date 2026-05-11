import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const mockTx = {
  case: {
    findFirst: vi.fn()
  }
};

const inTenantTransaction = vi.fn(
  (_firmId: string, run: (tx: typeof mockTx) => Promise<unknown>) => run(mockTx)
);
const findHearingConflicts = vi.fn();
const createHearingRecord = vi.fn();
const updateHearingRecordById = vi.fn();
const getFirmHearingRowByIdOrThrow = vi.fn();
const upsertHearingEvent = vi.fn();
const dispatchNotification = vi.fn();

vi.mock("../../repositories/unitOfWork.js", () => ({
  inTenantTransaction
}));

vi.mock("../../repositories/hearings/hearings.repository.js", () => ({
  createHearingRecord,
  findFirmUserNameById: vi.fn(),
  findFirmUserNamesByIds: vi.fn(),
  findFirmUsersByName: vi.fn(),
  findHearingConflicts,
  getFirmHearingByIdOrThrow: vi.fn(),
  getFirmHearingRowByIdOrThrow,
  listFirmHearings: vi.fn(),
  updateHearingOutcomeById: vi.fn(),
  updateHearingRecordById,
  upsertHearingEvent
}));

vi.mock("../../services/audit.service.js", () => ({
  writeAuditLog: vi.fn()
}));

vi.mock("../../db/prisma.js", () => ({
  prisma: {}
}));
vi.mock("../notifications/notification.service.js", () => ({ dispatchNotification }));

const { buildSessionDatetimeFilter, createHearing, updateHearing } = await import("./hearings.service.js");

const actor = makeSessionUser({
  email: "test@elms.test",
  fullName: "Test Admin",
  permissions: ["hearings:read", "hearings:create", "hearings:update"]
});

const audit = { actor };

function makeHearingRecord(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date("2026-03-21T10:00:00.000Z");
  return {
    id: "hearing-1",
    caseId: "case-1",
    assignedLawyerId: null,
    sessionDatetime: now,
    nextSessionAt: null,
    outcome: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    case: {
      id: "case-1",
      title: "Case A",
      firmId: "firm-1"
    },
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTx.case.findFirst.mockResolvedValue({ id: "case-1" });
  findHearingConflicts.mockResolvedValue([]);
  getFirmHearingRowByIdOrThrow.mockResolvedValue({
    id: "hearing-1",
    sessionDatetime: new Date("2026-03-20T10:00:00.000Z")
  });
  createHearingRecord.mockResolvedValue(makeHearingRecord());
  updateHearingRecordById.mockResolvedValue(makeHearingRecord());
  upsertHearingEvent.mockResolvedValue(undefined);
});

describe("buildSessionDatetimeFilter", () => {
  it("returns an empty filter when no visible range is provided", () => {
    expect(buildSessionDatetimeFilter({})).toEqual({});
  });

  it("builds a bounded date filter from from/to params", () => {
    const filter = buildSessionDatetimeFilter({
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-31T23:59:59.999Z"
    });

    expect(filter).toEqual({
      sessionDatetime: {
        gte: new Date("2026-03-01T00:00:00.000Z"),
        lte: new Date("2026-03-31T23:59:59.999Z")
      }
    });
  });

  it("merges overdue=true with from/to into one sessionDatetime filter", () => {
    const filter = buildSessionDatetimeFilter({
      overdue: "true",
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-31T23:59:59.999Z"
    });

    expect(filter.sessionDatetime?.gte).toEqual(new Date("2026-03-01T00:00:00.000Z"));
    expect(filter.sessionDatetime?.lte).toEqual(new Date("2026-03-31T23:59:59.999Z"));
    expect(filter.sessionDatetime?.lt).toBeInstanceOf(Date);
  });

  it("builds overdue-only filter when date range is absent", () => {
    const filter = buildSessionDatetimeFilter({ overdue: "true" });

    expect(filter.sessionDatetime?.lt).toBeInstanceOf(Date);
    expect(filter.sessionDatetime?.gte).toBeUndefined();
    expect(filter.sessionDatetime?.lte).toBeUndefined();
  });
});

describe("create/update hearing case guards", () => {
  it("rejects hearing creation when target case is deleted or outside tenant", async () => {
    mockTx.case.findFirst.mockResolvedValueOnce(null);

    await expect(
      createHearing(
        {} as never,
        actor,
        {
          caseId: "case-404",
          sessionDatetime: "2026-03-22T10:00:00.000Z",
          assignedLawyerId: null,
          nextSessionAt: null,
          outcome: null,
          notes: null
        },
        audit
      )
    ).rejects.toThrow("Case not found or archived/deleted");

    expect(createHearingRecord).not.toHaveBeenCalled();
  });

  it("rejects hearing update when target case is deleted or outside tenant", async () => {
    mockTx.case.findFirst.mockResolvedValueOnce(null);

    await expect(
      updateHearing(
        {} as never,
        actor,
        "hearing-1",
        {
          caseId: "case-404",
          sessionDatetime: "2026-03-22T10:00:00.000Z",
          assignedLawyerId: null,
          nextSessionAt: null,
          outcome: null,
          notes: null
        },
        audit
      )
    ).rejects.toThrow("Case not found or archived/deleted");

    expect(updateHearingRecordById).not.toHaveBeenCalled();
  });

  it("sends hearing-assigned notification on create when assignedLawyerId is set", async () => {
    createHearingRecord.mockResolvedValue(
      makeHearingRecord({ assignedLawyerId: "user-2", case: { id: "case-1", title: "Case A", firmId: "firm-1" } })
    );

    await createHearing(
      {} as never,
      actor,
      {
        caseId: "case-1",
        sessionDatetime: "2026-03-22T10:00:00.000Z",
        assignedLawyerId: "user-2",
        nextSessionAt: null,
        outcome: null,
        notes: null
      },
      audit
    );

    expect(dispatchNotification).toHaveBeenCalledWith(
      {} as never,
      "firm-1",
      "user-2",
      "HEARING_ASSIGNED",
      { caseTitle: "Case A" },
      { entityType: "CaseSession", entityId: "hearing-1" }
    );
  });

  it("sends hearing-assigned notification on reassignment only", async () => {
    getFirmHearingRowByIdOrThrow.mockResolvedValue({
      id: "hearing-1",
      sessionDatetime: new Date("2026-03-20T10:00:00.000Z"),
      assignedLawyerId: "user-old"
    });
    updateHearingRecordById.mockResolvedValue(
      makeHearingRecord({ assignedLawyerId: "user-new", case: { id: "case-1", title: "Case B", firmId: "firm-1" } })
    );

    await updateHearing(
      {} as never,
      actor,
      "hearing-1",
      {
        caseId: "case-1",
        sessionDatetime: "2026-03-22T10:00:00.000Z",
        assignedLawyerId: "user-new",
        nextSessionAt: null,
        outcome: null,
        notes: null
      },
      audit
    );

    expect(dispatchNotification).toHaveBeenCalledWith(
      {} as never,
      "firm-1",
      "user-new",
      "HEARING_ASSIGNED",
      { caseTitle: "Case B" },
      { entityType: "CaseSession", entityId: "hearing-1" }
    );
  });
});
