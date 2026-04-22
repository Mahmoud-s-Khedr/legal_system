import { beforeEach, describe, expect, it, vi } from "vitest";

const buildFuzzySearchCandidates = vi.fn();
vi.mock("../../utils/fuzzySearch.js", () => ({ buildFuzzySearchCandidates }));

const {
  findHearingConflicts,
  upsertHearingEvent,
  listFirmHearings,
  findFirmUsersByName,
  findFirmUserNamesByIds,
  findFirmUserNameById,
  getFirmHearingByIdOrThrow,
  getFirmHearingRowByIdOrThrow,
  createHearingRecord,
  updateHearingRecordById,
  updateHearingOutcomeById
} = await import("./hearings.repository.js");

function createTx() {
  return {
    caseSession: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirstOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    event: { upsert: vi.fn() },
    user: { findMany: vi.fn(), findFirst: vi.fn() }
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  buildFuzzySearchCandidates.mockReturnValue(["ali", "aly"]);
});

describe("hearings.repository", () => {
  it("finds hearing conflicts in +/-1 hour window", async () => {
    const tx = createTx();
    tx.caseSession.findMany.mockResolvedValue([{ id: "h-1" }]);

    const result = await findHearingConflicts(
      tx as never,
      "firm-1",
      "u-1",
      new Date("2026-04-22T10:00:00.000Z"),
      "exclude-id"
    );

    expect(result).toEqual([{ id: "h-1" }]);
    expect(tx.caseSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { not: "exclude-id" } }) })
    );
  });

  it("upserts hearing event and lists paginated hearings", async () => {
    const tx = createTx();
    tx.caseSession.count.mockResolvedValue(2);
    tx.caseSession.findMany.mockResolvedValue([{ id: "h-1", case: { id: "c-1" } }]);

    await upsertHearingEvent(tx as never, {
      id: "h-1",
      caseId: "c-1",
      sessionDatetime: new Date("2026-04-22T10:00:00.000Z"),
      case: { title: "Case", firmId: "firm-1" }
    });

    const listed = await listFirmHearings(
      tx as never,
      { assignedLawyerId: "u-1" },
      { sessionDatetime: "asc" },
      { page: 1, limit: 20 }
    );

    expect(tx.event.upsert).toHaveBeenCalled();
    expect(listed.total).toBe(2);
    expect(listed.items).toHaveLength(1);
  });

  it("handles user lookup branches", async () => {
    const tx = createTx();
    tx.user.findMany.mockResolvedValue([{ id: "u-1", fullName: "Ali" }]);
    tx.user.findFirst.mockResolvedValue({ fullName: "Ali" });

    const byName = await findFirmUsersByName(tx as never, "firm-1", "Ali");
    expect(byName).toEqual([{ id: "u-1", fullName: "Ali" }]);

    buildFuzzySearchCandidates.mockReturnValueOnce([]);
    const empty = await findFirmUsersByName(tx as never, "firm-1", "");
    expect(empty).toEqual([]);

    const names = await findFirmUserNamesByIds(tx as never, "firm-1", ["u-1"]);
    expect(names).toEqual([{ id: "u-1", fullName: "Ali" }]);

    const none = await findFirmUserNamesByIds(tx as never, "firm-1", []);
    expect(none).toEqual([]);

    const single = await findFirmUserNameById(tx as never, "firm-1", "u-1");
    expect(single).toEqual({ fullName: "Ali" });
  });

  it("gets/creates/updates hearing records", async () => {
    const tx = createTx();
    const record = { id: "h-1", case: { id: "c-1" } };

    tx.caseSession.findFirstOrThrow.mockResolvedValue(record);
    tx.caseSession.create.mockResolvedValue(record);
    tx.caseSession.update.mockResolvedValue(record);

    expect(await getFirmHearingByIdOrThrow(tx as never, "firm-1", "h-1")).toEqual(record);
    expect(await getFirmHearingRowByIdOrThrow(tx as never, "firm-1", "h-1")).toEqual(record);

    expect(
      await createHearingRecord(tx as never, {
        caseId: "c-1",
        assignedLawyerId: null,
        sessionDatetime: new Date(),
        nextSessionAt: null,
        outcome: null,
        notes: null
      })
    ).toEqual(record);

    expect(
      await updateHearingRecordById(tx as never, "h-1", {
        caseId: "c-1",
        assignedLawyerId: null,
        sessionDatetime: new Date(),
        nextSessionAt: null,
        outcome: null,
        notes: null
      })
    ).toEqual(record);

    expect(await updateHearingOutcomeById(tx as never, "h-1", null)).toEqual(record);
  });
});
