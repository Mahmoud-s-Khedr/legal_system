import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditionKey, FirmLifecycleStatus } from "@elms/shared";

const mockFirm = {
  findMany: vi.fn(),
  update: vi.fn()
};

const mockPrisma = {
  firm: mockFirm
};

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));

const { runFirmLifecycleSweep } = await import("./lifecycle.service.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runFirmLifecycleSweep", () => {
  it("initializes missing trial dates and moves ACTIVE trial firms to GRACE at the same threshold", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const now = new Date("2026-01-31T00:00:00.000Z");

    mockFirm.findMany.mockResolvedValue([
      {
        id: "firm-1",
        editionKey: EditionKey.SOLO_OFFLINE,
        lifecycleStatus: FirmLifecycleStatus.ACTIVE,
        createdAt,
        trialStartedAt: null,
        trialEndsAt: null,
        graceEndsAt: null,
        suspendedAt: null,
        deletionDueAt: null,
        deletedAt: null
      }
    ]);
    mockFirm.update.mockResolvedValue({});

    const result = await runFirmLifecycleSweep(now);

    expect(result.movedToGrace).toBe(1);
    expect(mockFirm.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "firm-1" },
        data: expect.objectContaining({
          trialStartedAt: new Date("2026-01-01T00:00:00.000Z"),
          trialEndsAt: new Date("2026-01-31T00:00:00.000Z"),
          graceEndsAt: new Date("2026-02-14T00:00:00.000Z"),
          deletionDueAt: new Date("2026-02-15T00:00:00.000Z"),
          lifecycleStatus: FirmLifecycleStatus.GRACE
        })
      })
    );
  });

  it("does not move ACTIVE firms to GRACE before computed trial end", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const now = new Date("2026-01-30T23:59:59.000Z");

    mockFirm.findMany.mockResolvedValue([
      {
        id: "firm-1",
        editionKey: EditionKey.SOLO_OFFLINE,
        lifecycleStatus: FirmLifecycleStatus.ACTIVE,
        createdAt,
        trialStartedAt: null,
        trialEndsAt: null,
        graceEndsAt: null,
        suspendedAt: null,
        deletionDueAt: null,
        deletedAt: null
      }
    ]);
    mockFirm.update.mockResolvedValue({});

    const result = await runFirmLifecycleSweep(now);

    expect(result.movedToGrace).toBe(0);
    expect(mockFirm.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          lifecycleStatus: FirmLifecycleStatus.GRACE
        })
      })
    );
  });
});
