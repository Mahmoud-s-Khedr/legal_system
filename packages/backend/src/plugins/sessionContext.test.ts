import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthMode } from "@elms/shared";

const getUserWithRoleAndPermissions = vi.fn();
const toSessionUser = vi.fn();
const localResolve = vi.fn();

vi.mock("../db/prisma.js", () => ({ prisma: { tag: "prisma" } }));
vi.mock("../modules/auth/localSessionStore.js", () => ({
  localSessionStore: { resolve: localResolve }
}));
vi.mock("../modules/auth/sessionUser.js", () => ({
  getUserWithRoleAndPermissions,
  toSessionUser
}));

const { registerSessionContext } = await import("./sessionContext.js");

describe("registerSessionContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toSessionUser.mockImplementation((user) => ({ id: user.id, firmId: user.firmId }));
  });

  it("resolves local session from header/cookie/bearer", async () => {
    const addHook = vi.fn();
    const decorateRequest = vi.fn();
    const app = { addHook, decorateRequest, jwt: { verify: vi.fn() } };

    localResolve.mockReturnValueOnce({ userId: "u1" });
    getUserWithRoleAndPermissions.mockResolvedValueOnce({ id: "u1", firmId: "f1" });

    registerSessionContext(app as never, { AUTH_MODE: AuthMode.LOCAL } as never);

    const hook = addHook.mock.calls[0]?.[1] as ((request: unknown) => Promise<void>);
    const request = {
      cookies: {},
      headers: { "x-elms-session": "sid-1" }
    };

    await hook(request as never);

    expect(decorateRequest).toHaveBeenCalledWith("sessionUser", null);
    expect(localResolve).toHaveBeenCalledWith("sid-1");
    expect(request).toHaveProperty("sessionUser", { id: "u1", firmId: "f1" });

    localResolve.mockReturnValueOnce({ userId: "u2" });
    getUserWithRoleAndPermissions.mockResolvedValueOnce({ id: "u2", firmId: "f2" });

    await hook(
      {
        cookies: {},
        headers: { authorization: "Bearer sid-2" }
      } as never
    );

    expect(localResolve).toHaveBeenCalledWith("sid-2");
  });

  it("returns null when local session cannot map to a user", async () => {
    const addHook = vi.fn();
    const app = { addHook, decorateRequest: vi.fn(), jwt: { verify: vi.fn() } };

    localResolve.mockReturnValueOnce({ userId: "missing" });
    getUserWithRoleAndPermissions.mockResolvedValueOnce(null);

    registerSessionContext(app as never, { AUTH_MODE: AuthMode.LOCAL } as never);
    const hook = addHook.mock.calls[0]?.[1] as ((request: unknown) => Promise<void>);

    const request = { cookies: { localSession: "sid" }, headers: {} };
    await hook(request as never);
    expect(request).toHaveProperty("sessionUser", null);
  });

  it("resolves cloud session from access cookie and jwt claims", async () => {
    const verify = vi.fn().mockResolvedValue({ sub: "u3" });
    const addHook = vi.fn();
    const app = { addHook, decorateRequest: vi.fn(), jwt: { verify } };

    getUserWithRoleAndPermissions.mockResolvedValueOnce({ id: "u3", firmId: "f3" });

    registerSessionContext(
      app as never,
      {
        AUTH_MODE: AuthMode.CLOUD,
        COOKIE_DOMAIN: "localhost"
      } as never
    );

    const hook = addHook.mock.calls[0]?.[1] as ((request: unknown) => Promise<void>);
    const request = { cookies: { elms_access_token: "jwt" }, headers: {} };

    await hook(request as never);

    expect(verify).toHaveBeenCalledWith(
      "jwt",
      expect.objectContaining({
        allowedAud: "elms-api",
        allowedIss: "localhost"
      })
    );
    expect(request).toHaveProperty("sessionUser", { id: "u3", firmId: "f3" });
  });

  it("handles missing/invalid cloud token as anonymous", async () => {
    const verify = vi.fn().mockRejectedValue(new Error("bad token"));
    const addHook = vi.fn();
    const app = { addHook, decorateRequest: vi.fn(), jwt: { verify } };

    registerSessionContext(app as never, { AUTH_MODE: AuthMode.CLOUD, COOKIE_DOMAIN: "x" } as never);

    const hook = addHook.mock.calls[0]?.[1] as ((request: unknown) => Promise<void>);

    const missing = { cookies: {}, headers: {} };
    await hook(missing as never);
    expect(missing).toHaveProperty("sessionUser", null);

    const invalid = { cookies: { elms_access_token: "bad" }, headers: {} };
    await hook(invalid as never);
    expect(invalid).toHaveProperty("sessionUser", null);
  });
});
