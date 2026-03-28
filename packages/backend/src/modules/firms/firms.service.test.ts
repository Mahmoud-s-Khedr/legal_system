import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditionKey, FirmLifecycleStatus } from "@elms/shared";
import { makeSessionUser } from "../../test-utils/session-user.js";

const mockFirm = {
  findUniqueOrThrow: vi.fn()
};

const mockPrisma = {
  firm: mockFirm
};

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn((_prisma: unknown, _firmId: string, fn: (tx: typeof mockPrisma) => unknown) =>
    fn(mockPrisma)
  )
}));

const { getCurrentFirm, getCurrentFirmSubscription } = await import("./firms.service.js");

const actor = makeSessionUser({ firmId: "firm-1", editionKey: EditionKey.SOLO_OFFLINE });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCurrentFirm", () => {
  it("derives trialEndsAt for trial-enabled firms when it is missing", async () => {
    const createdAt = new Date("2026-03-01T00:00:00.000Z");
    mockFirm.findUniqueOrThrow.mockResolvedValue({
      id: "firm-1",
      name: "Firm",
      slug: "firm",
      type: "SOLO",
      editionKey: EditionKey.SOLO_OFFLINE,
      pendingEditionKey: null,
      lifecycleStatus: FirmLifecycleStatus.ACTIVE,
      createdAt,
      trialStartedAt: null,
      trialEndsAt: null,
      graceEndsAt: null,
      deletionDueAt: null,
      defaultLanguage: "AR",
      settings: null
    });

    const result = await getCurrentFirm(actor);
    expect(result.firm.trialEndsAt).toBe("2026-03-31T00:00:00.000Z");
  });

  it("keeps trialEndsAt null for non-trial editions when unset", async () => {
    const createdAt = new Date("2026-03-01T00:00:00.000Z");
    mockFirm.findUniqueOrThrow.mockResolvedValue({
      id: "firm-1",
      name: "Firm",
      slug: "firm",
      type: "SOLO",
      editionKey: EditionKey.SOLO_ONLINE,
      pendingEditionKey: null,
      lifecycleStatus: FirmLifecycleStatus.ACTIVE,
      createdAt,
      trialStartedAt: null,
      trialEndsAt: null,
      graceEndsAt: null,
      deletionDueAt: null,
      defaultLanguage: "AR",
      settings: null
    });

    const result = await getCurrentFirm({ ...actor, editionKey: EditionKey.SOLO_ONLINE });
    expect(result.firm.trialEndsAt).toBeNull();
  });
});

describe("getCurrentFirmSubscription", () => {
  it("derives trialEndsAt for legacy trial firms with null dates", async () => {
    const createdAt = new Date("2026-01-10T00:00:00.000Z");
    mockFirm.findUniqueOrThrow.mockResolvedValue({
      createdAt,
      trialStartedAt: null,
      editionKey: EditionKey.SOLO_OFFLINE,
      pendingEditionKey: null,
      lifecycleStatus: FirmLifecycleStatus.ACTIVE,
      trialEndsAt: null,
      graceEndsAt: null,
      deletionDueAt: null
    });

    const result = await getCurrentFirmSubscription(actor);
    expect(result.trialEndsAt).toBe("2026-02-09T00:00:00.000Z");
  });
});
