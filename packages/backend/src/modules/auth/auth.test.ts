import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthMode, EditionKey } from "@elms/shared";
import { UserStatus } from "@prisma/client";
import { loadEnv } from "../../config/env.js";

const mockPrisma = {
  firm: {
    findFirst: vi.fn(),
    create: vi.fn()
  },
  role: {
    findFirst: vi.fn(),
    create: vi.fn()
  },
  user: {
    findFirst: vi.fn()
  }
};

const bcryptHash = vi.fn();
const bcryptCompare = vi.fn();
const ensureSystemSecurityModel = vi.fn();
const getUserWithRoleAndPermissions = vi.fn();
const toSessionUser = vi.fn();
const localSessionCreate = vi.fn();

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../../security/bootstrap.js", () => ({ ensureSystemSecurityModel }));
vi.mock("bcryptjs", () => ({ default: { hash: bcryptHash, compare: bcryptCompare } }));
vi.mock("./sessionUser.js", () => ({ getUserWithRoleAndPermissions, toSessionUser }));
vi.mock("./localSessionStore.js", () => ({ localSessionStore: { create: localSessionCreate, destroy: vi.fn() } }));

const { createLocalAuthService } = await import("./localAuthService.js");

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.role.findFirst.mockResolvedValue({ id: "role-admin" });
  bcryptHash.mockResolvedValue("hash");
  bcryptCompare.mockResolvedValue(true);
  localSessionCreate.mockReturnValue("session-1");
  toSessionUser.mockReturnValue({ id: "user-1", firmId: "firm-1" });
  getUserWithRoleAndPermissions.mockResolvedValue({ id: "user-1", firmId: "firm-1" });
});

describe("local auth login", () => {
  it("rejects suspended users with explicit account status error", async () => {
    const authService = createLocalAuthService({} as never);
    mockPrisma.user.findFirst.mockResolvedValueOnce({
      id: "user-2",
      passwordHash: "hash",
      status: UserStatus.SUSPENDED
    });

    await expect(
      authService.login({ email: "suspended@elms.local", password: "secret123" })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "ACCOUNT_SUSPENDED"
    });
  });

  it("rejects invalid credentials", async () => {
    const authService = createLocalAuthService({} as never);
    mockPrisma.user.findFirst.mockResolvedValueOnce(null);

    await expect(
      authService.login({ email: "unknown@elms.local", password: "secret123" })
    ).rejects.toMatchObject({
      statusCode: 401
    });
  });
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

  it("parses ELMS_ENABLE_SWAGGER boolean flag", async () => {
    vi.resetModules();
    const { loadEnv: freshLoadEnv } = await import("../../config/env.js");
    const env = freshLoadEnv({
      NODE_ENV: "test",
      AUTH_MODE: "local",
      STORAGE_DRIVER: "local",
      DATABASE_URL: "postgresql://example",
      ELMS_ENABLE_SWAGGER: "1"
    });

    expect(env.ELMS_ENABLE_SWAGGER).toBe(true);
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
      editionKey: EditionKey.ENTERPRISE
    });

    expect(mockPrisma.firm.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          editionKey: EditionKey.ENTERPRISE,
          trialStartedAt: undefined,
          trialEndsAt: undefined,
          graceEndsAt: undefined,
          deletionDueAt: undefined
        })
      })
    );
  });
});
