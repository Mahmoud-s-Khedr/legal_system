import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthMode, EditionKey } from "@elms/shared";
import { loadEnv } from "../../config/env.js";

const mockPrisma = {
  firm: {
    findFirst: vi.fn(),
    create: vi.fn()
  },
  role: {
    findFirst: vi.fn(),
    create: vi.fn()
  }
};

const bcryptHash = vi.fn();
const ensureSystemSecurityModel = vi.fn();
const getUserWithRoleAndPermissions = vi.fn();
const toSessionUser = vi.fn();
const localSessionCreate = vi.fn();

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../../security/bootstrap.js", () => ({ ensureSystemSecurityModel }));
vi.mock("bcryptjs", () => ({ default: { hash: bcryptHash } }));
vi.mock("./sessionUser.js", () => ({ getUserWithRoleAndPermissions, toSessionUser }));
vi.mock("./localSessionStore.js", () => ({ localSessionStore: { create: localSessionCreate, destroy: vi.fn() } }));

const { createLocalAuthService } = await import("./localAuthService.js");

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.role.findFirst.mockResolvedValue({ id: "role-admin" });
  bcryptHash.mockResolvedValue("hash");
  localSessionCreate.mockReturnValue("session-1");
  toSessionUser.mockReturnValue({ id: "user-1", firmId: "firm-1" });
  getUserWithRoleAndPermissions.mockResolvedValue({ id: "user-1", firmId: "firm-1" });
});

describe("loadEnv", () => {
  it("provides development jwt keys when env is missing", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      AUTH_MODE: "cloud",
      STORAGE_DRIVER: "local",
      DATABASE_URL: "postgresql://example"
    });

    expect(env.JWT_PRIVATE_KEY).toContain("BEGIN PRIVATE KEY");
    expect(env.JWT_PUBLIC_KEY).toContain("BEGIN PUBLIC KEY");
  });
});

describe("local auth setup", () => {
  it("returns 409 instead of 500 when setup races on firm slug unique constraint", async () => {
    const authService = createLocalAuthService({} as never);
    const setup = authService.setup;
    if (!setup) {
      throw new Error("Expected local auth setup implementation");
    }

    mockPrisma.firm.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "firm-1", slug: "elms-desktop-firm" });
    mockPrisma.firm.create.mockRejectedValue({
      code: "P2002",
      meta: { target: ["slug"] }
    });

    await expect(
      setup({
        firmName: "ELMS Desktop Firm",
        fullName: "Desktop Admin",
        email: "admin@elms.local",
        password: "secret123",
        editionKey: EditionKey.SOLO_OFFLINE
      })
    ).rejects.toMatchObject({ statusCode: 409, message: "Desktop setup already completed" });
  });

  it("creates local session when setup succeeds", async () => {
    const authService = createLocalAuthService({} as never);
    const setup = authService.setup;
    if (!setup) {
      throw new Error("Expected local auth setup implementation");
    }

    mockPrisma.firm.findFirst.mockResolvedValueOnce(null);
    mockPrisma.firm.create.mockResolvedValue({ users: [{ id: "user-1" }] });

    const result = await setup({
      firmName: "ELMS Desktop Firm",
      fullName: "Desktop Admin",
      email: "admin@elms.local",
      password: "secret123",
      editionKey: EditionKey.SOLO_OFFLINE
    });

    expect(result.session.mode).toBe(AuthMode.LOCAL);
    expect(localSessionCreate).toHaveBeenCalledWith("user-1");
    expect(mockPrisma.firm.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          editionKey: EditionKey.SOLO_OFFLINE,
          trialStartedAt: expect.any(Date),
          trialEndsAt: expect.any(Date),
          graceEndsAt: expect.any(Date),
          deletionDueAt: expect.any(Date)
        })
      })
    );
  });

  it("does not initialize trial dates for non-trial editions", async () => {
    const authService = createLocalAuthService({} as never);
    const setup = authService.setup;
    if (!setup) {
      throw new Error("Expected local auth setup implementation");
    }

    mockPrisma.firm.findFirst.mockResolvedValueOnce(null);
    mockPrisma.firm.create.mockResolvedValue({ users: [{ id: "user-1" }] });

    await setup({
      firmName: "ELMS Online Firm",
      fullName: "Desktop Admin",
      email: "admin@elms.local",
      password: "secret123",
      editionKey: EditionKey.SOLO_ONLINE
    });

    expect(mockPrisma.firm.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          editionKey: EditionKey.SOLO_ONLINE,
          trialStartedAt: undefined,
          trialEndsAt: undefined,
          graceEndsAt: undefined,
          deletionDueAt: undefined
        })
      })
    );
  });
});
