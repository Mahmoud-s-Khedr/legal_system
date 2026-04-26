import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "../../config/constants.js";

const ensureSystemSecurityModel = vi.fn();
const toSessionUser = vi.fn();

const mockPrisma = {
  user: {
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn()
  },
  role: {
    findFirst: vi.fn(),
    create: vi.fn()
  },
  invitation: {
    findFirst: vi.fn()
  },
  $transaction: vi.fn()
};

class MockRedis {
  static store = new Map<string, string>();
  status = "wait";
  connect = vi.fn(async () => {
    this.status = "ready";
  });
  setex = vi.fn(async (key: string, _ttl: number, value: string) => {
    MockRedis.store.set(key, value);
  });
  get = vi.fn(async (key: string) => MockRedis.store.get(key) ?? null);
  del = vi.fn(async (key: string) => {
    MockRedis.store.delete(key);
  });
}

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../../security/bootstrap.js", () => ({ ensureSystemSecurityModel }));
vi.mock("./sessionUser.js", () => ({
  userWithRoleInclude: { role: true, firm: true },
  toSessionUser
}));
vi.mock("bcryptjs");
vi.mock("ioredis", () => ({ Redis: MockRedis }));

const { createCloudAuthService } = await import("./cloudAuthService.js");

function buildApp() {
  return {
    jwt: {
      sign: vi.fn().mockResolvedValue("access-token")
    }
  };
}

const env = {
  REDIS_URL: "redis://localhost:6379",
  ACCESS_TOKEN_TTL_MINUTES: 15,
  REFRESH_TOKEN_TTL_DAYS: 7,
  COOKIE_DOMAIN: "elms.local"
};

const dbUser = {
  id: "u-1",
  firmId: "f-1",
  roleId: "r-1",
  role: { key: "firm_admin", permissions: [{ permission: { key: "cases:read" } }] },
  firm: { editionKey: "ENTERPRISE", pendingEditionKey: null, lifecycleStatus: "ACTIVE", trialEndsAt: null, graceEndsAt: null },
  email: "user@test.com",
  fullName: "Test",
  preferredLanguage: "AR"
};

const sessionUser = {
  id: "u-1",
  firmId: "f-1",
  editionKey: "ENTERPRISE",
  pendingEditionKey: null,
  lifecycleStatus: "ACTIVE",
  trialEndsAt: null,
  graceEndsAt: null,
  roleId: "r-1",
  roleKey: "firm_admin",
  email: "user@test.com",
  fullName: "Test",
  permissions: ["cases:read"]
};

beforeEach(() => {
  vi.clearAllMocks();
  MockRedis.store.clear();
  toSessionUser.mockReturnValue(sessionUser);
  mockPrisma.role.findFirst.mockResolvedValue({ id: "r-1" });
  mockPrisma.user.findUniqueOrThrow.mockResolvedValue(dbUser);
  vi.mocked(bcrypt.hash).mockResolvedValue("hashed" as never);
  vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
});

describe("cloudAuthService", () => {
  it("registers a firm admin and returns tokenized session", async () => {
    const app = buildApp();
    const service = createCloudAuthService(app as never, env as never);

    mockPrisma.user.create.mockResolvedValue({ id: "u-1" });

    const result = await service.register!({
      email: "owner@firm.com",
      fullName: "Owner",
      password: "Strong123!",
      firmName: "Firm"
    });

    expect(ensureSystemSecurityModel).toHaveBeenCalled();
    expect(mockPrisma.user.create).toHaveBeenCalled();
    expect(app.jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: "u-1", firmId: "f-1" }),
      expect.objectContaining({ aud: "elms-api" })
    );
    expect(result.session.user?.id).toBe("u-1");
    expect(service.getResponseCookies!(result)).toEqual(
      expect.objectContaining({ [ACCESS_COOKIE]: expect.any(String), [REFRESH_COOKIE]: expect.any(String) })
    );
  });

  it("accepts invite and rejects invalid token", async () => {
    const app = buildApp();
    const service = createCloudAuthService(app as never, env as never);

    mockPrisma.invitation.findFirst.mockResolvedValueOnce(null);
    await expect(service.acceptInvite!({ token: "bad", password: "x", fullName: "User" })).rejects.toThrow(
      "Invitation is invalid or expired"
    );

    mockPrisma.invitation.findFirst.mockResolvedValueOnce({
      id: "inv-1",
      firmId: "f-1",
      roleId: "r-1",
      email: "new@firm.com"
    });
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        invitation: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        user: { create: vi.fn().mockResolvedValue({ id: "u-1" }) }
      })
    );

    const accepted = await service.acceptInvite!({ token: "ok", password: "x", fullName: "User" });
    expect(accepted.session.user?.id).toBe("u-1");
  });

  it("logs in, refreshes, and logs out", async () => {
    const app = buildApp();
    const service = createCloudAuthService(app as never, env as never);

    mockPrisma.user.findFirst.mockResolvedValue({ id: "u-1", passwordHash: "hash" });
    const loggedIn = await service.login({ email: "user@test.com", password: "pass" });
    expect(loggedIn.session.user?.id).toBe("u-1");

    await expect(service.refresh!({})).rejects.toThrow("Missing refresh token");
    await expect(service.refresh!({ [REFRESH_COOKIE]: "missing" })).rejects.toThrow("Refresh token expired");

    MockRedis.store.set("refresh:valid-token", "u-1");
    const refreshed = await service.refresh!({ [REFRESH_COOKIE]: "valid-token" });
    expect(refreshed.session.user?.id).toBe("u-1");

    MockRedis.store.set("refresh:logout-token", "u-1");
    await service.logout({ [REFRESH_COOKIE]: "logout-token" });
    expect(MockRedis.store.get("refresh:logout-token")).toBeUndefined();

    expect(service.clearResponseCookies()).toEqual([ACCESS_COOKIE, REFRESH_COOKIE]);
    expect(service.getResponseCookies!({ session: { user: null } } as never)).toEqual({});
  });

  it("rejects login when password mismatch or missing hash", async () => {
    const app = buildApp();
    const service = createCloudAuthService(app as never, env as never);

    mockPrisma.user.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "u-1", passwordHash: "hash" });

    await expect(service.login({ email: "x", password: "x" })).rejects.toThrow("Invalid email or password");

    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);
    await expect(service.login({ email: "x", password: "x" })).rejects.toThrow("Invalid email or password");
  });
});
