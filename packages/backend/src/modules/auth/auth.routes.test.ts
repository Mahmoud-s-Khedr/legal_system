import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthMode, EditionKey } from "@elms/shared";

const authService: {
  login: ReturnType<typeof vi.fn>;
  register: ReturnType<typeof vi.fn> | undefined;
  setup: ReturnType<typeof vi.fn> | undefined;
  acceptInvite: ReturnType<typeof vi.fn> | undefined;
  refresh: ReturnType<typeof vi.fn> | undefined;
  logout: ReturnType<typeof vi.fn>;
  getResponseCookies: ReturnType<typeof vi.fn>;
  clearResponseCookies: ReturnType<typeof vi.fn>;
} = {
  login: vi.fn(),
  register: vi.fn(),
  setup: vi.fn(),
  acceptInvite: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  getResponseCookies: vi.fn(),
  clearResponseCookies: vi.fn()
};

const createAuthService = vi.fn(() => authService);
const firmFindFirst = vi.fn();

vi.mock("./createAuthService.js", () => ({ createAuthService }));
vi.mock("../../db/prisma.js", () => ({ prisma: { firm: { findFirst: firmFindFirst } } }));

const { registerAuthRoutes } = await import("./auth.routes.js");

function createApp() {
  return {
    get: vi.fn(),
    post: vi.fn()
  };
}

function findHandler(calls: unknown[][], path: string) {
  const call = calls.find((entry) => entry[0] === path);
  return (call?.[2] ?? call?.[1]) as ((request: unknown, reply?: unknown) => Promise<unknown>) | undefined;
}

describe("registerAuthRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authService.register = vi.fn();
    authService.setup = vi.fn();
    authService.acceptInvite = vi.fn();
    authService.refresh = vi.fn();
    authService.getResponseCookies.mockReturnValue({ elms_local_session: "session-1", elms_access_token: "token-1" });
    authService.clearResponseCookies.mockReturnValue(["localSession", "accessToken"]);
    authService.login.mockResolvedValue({
      session: {
        mode: AuthMode.LOCAL,
        user: { id: "u1", firmId: "f1" }
      }
    });
    authService.setup.mockResolvedValue({
      session: {
        mode: AuthMode.LOCAL,
        user: { id: "u2", firmId: "f2" }
      }
    });
    authService.register.mockResolvedValue({
      session: {
        mode: AuthMode.CLOUD,
        user: { id: "u3", firmId: "f3" }
      }
    });
    authService.acceptInvite.mockResolvedValue({
      session: {
        mode: AuthMode.CLOUD,
        user: { id: "u4", firmId: "f4" }
      }
    });
    authService.refresh.mockResolvedValue({
      session: {
        mode: AuthMode.CLOUD,
        user: { id: "u5", firmId: "f5" }
      }
    });
  });

  it("logs in, sets cookies, and returns local session token", async () => {
    const app = createApp();
    await registerAuthRoutes(app as never, { NODE_ENV: "production", AUTH_MODE: AuthMode.LOCAL } as never);

    const handler = findHandler(app.post.mock.calls, "/api/auth/login");
    const reply = { setCookie: vi.fn() };
    const request = {
      body: { email: "a@b.com", password: "p" },
      cookies: {},
      sessionUser: null
    };

    const result = await handler!(request as never, reply as never);

    expect(createAuthService).toHaveBeenCalled();
    expect(authService.login).toHaveBeenCalledWith({ email: "a@b.com", password: "p" });
    expect(reply.setCookie).toHaveBeenCalledTimes(2);
    expect(request.sessionUser).toEqual({ id: "u1", firmId: "f1" });
    expect(result).toEqual(
      expect.objectContaining({
        localSessionToken: "session-1"
      })
    );
  });

  it("returns setup needsSetup from prisma", async () => {
    const app = createApp();
    await registerAuthRoutes(app as never, { NODE_ENV: "test", AUTH_MODE: AuthMode.LOCAL } as never);

    const handler = findHandler(app.get.mock.calls, "/api/auth/setup");
    firmFindFirst.mockResolvedValueOnce(null);
    expect(await handler!({} as never)).toEqual({ needsSetup: true });

    firmFindFirst.mockResolvedValueOnce({ id: "firm-1" });
    expect(await handler!({} as never)).toEqual({ needsSetup: false });
  });

  it("runs register flow when supported", async () => {
    const app = createApp();
    await registerAuthRoutes(app as never, { NODE_ENV: "test", AUTH_MODE: AuthMode.CLOUD } as never);

    const handler = findHandler(app.post.mock.calls, "/api/auth/register");
    const reply = { setCookie: vi.fn() };
    const request = {
      body: {
        email: "owner@firm.com",
        password: "StrongPass123!",
        firmName: "Firm",
        fullName: "Owner"
      },
      sessionUser: null
    };

    const result = await handler!(request as never, reply as never);
    expect(authService.register).toHaveBeenCalledWith(request.body);
    expect(reply.setCookie).toHaveBeenCalled();
    expect(request.sessionUser).toEqual({ id: "u3", firmId: "f3" });
    expect(result).toEqual(expect.objectContaining({ localSessionToken: "session-1" }));
  });

  it("returns 410 for register when service does not support it", async () => {
    const app = createApp();
    authService.register = undefined as never;
    await registerAuthRoutes(app as never, { NODE_ENV: "test", AUTH_MODE: AuthMode.LOCAL } as never);

    const handler = findHandler(app.post.mock.calls, "/api/auth/register");
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };

    await handler!({ body: { email: "x@y.com", password: "StrongPass123!", firmName: "Firm", fullName: "Owner" } } as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(410);
  });

  it("returns 410 for refresh when service does not support it", async () => {
    const app = createApp();
    authService.refresh = undefined as never;
    await registerAuthRoutes(app as never, { NODE_ENV: "test", AUTH_MODE: AuthMode.LOCAL } as never);

    const handler = findHandler(app.post.mock.calls, "/api/auth/refresh");
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };

    const result = await handler!({} as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(410);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: "LOCAL_ONLY_DEPLOYMENT" })
    );
    expect(result).toBe(reply);
  });

  it("runs refresh flow when supported", async () => {
    const app = createApp();
    await registerAuthRoutes(app as never, { NODE_ENV: "test", AUTH_MODE: AuthMode.CLOUD } as never);

    const handler = findHandler(app.post.mock.calls, "/api/auth/refresh");
    const reply = { setCookie: vi.fn() };
    const request = { cookies: { refresh: "x" }, sessionUser: null };

    const result = await handler!(request as never, reply as never);
    expect(authService.refresh).toHaveBeenCalledWith({ refresh: "x" });
    expect(request.sessionUser).toEqual({ id: "u5", firmId: "f5" });
    expect(result).toEqual(expect.objectContaining({ localSessionToken: "session-1" }));
  });

  it("runs setup flow and returns token", async () => {
    const app = createApp();
    await registerAuthRoutes(app as never, { NODE_ENV: "test", AUTH_MODE: AuthMode.LOCAL } as never);

    const handler = findHandler(app.post.mock.calls, "/api/auth/setup");
    const reply = { setCookie: vi.fn() };
    const request = {
      body: {
        email: "setup@elms.local",
        password: "StrongPass123!",
        firmName: "Firm",
        fullName: "Owner",
        editionKey: EditionKey.SOLO_OFFLINE
      },
      sessionUser: null
    };

    const result = await handler!(request as never, reply as never);
    expect(authService.setup).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ localSessionToken: "session-1" }));
  });

  it("returns 410 for setup when auth service does not support it", async () => {
    const app = createApp();
    authService.setup = undefined as never;
    await registerAuthRoutes(app as never, { NODE_ENV: "test", AUTH_MODE: AuthMode.LOCAL } as never);

    const handler = findHandler(app.post.mock.calls, "/api/auth/setup");
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };

    await handler!(
      {
        body: {
          email: "setup@elms.local",
          password: "StrongPass123!",
          firmName: "Firm",
          fullName: "Owner",
          editionKey: EditionKey.SOLO_OFFLINE
        }
      } as never,
      reply as never
    );

    expect(reply.status).toHaveBeenCalledWith(410);
  });

  it("returns no desktop setup requirement in cloud mode", async () => {
    const app = createApp();
    await registerAuthRoutes(app as never, { NODE_ENV: "test", AUTH_MODE: AuthMode.CLOUD } as never);

    const handler = findHandler(app.get.mock.calls, "/api/auth/setup");
    expect(await handler!({} as never)).toEqual({ needsSetup: false });
    expect(firmFindFirst).not.toHaveBeenCalled();
  });

  it("runs accept-invite flow when supported", async () => {
    const app = createApp();
    await registerAuthRoutes(app as never, { NODE_ENV: "test", AUTH_MODE: AuthMode.CLOUD } as never);

    const handler = findHandler(app.post.mock.calls, "/api/auth/accept-invite");
    const reply = { setCookie: vi.fn() };
    const request = {
      body: {
        token: "invite-token",
        fullName: "Invitee",
        password: "StrongPass123!"
      },
      sessionUser: null
    };

    const result = await handler!(request as never, reply as never);
    expect(authService.acceptInvite).toHaveBeenCalledWith(request.body);
    expect(request.sessionUser).toEqual({ id: "u4", firmId: "f4" });
    expect(result).toEqual(expect.objectContaining({ localSessionToken: "session-1" }));
  });

  it("logs out and clears response cookies", async () => {
    const app = createApp();
    await registerAuthRoutes(app as never, { NODE_ENV: "test", AUTH_MODE: AuthMode.LOCAL } as never);

    const handler = findHandler(app.post.mock.calls, "/api/auth/logout");
    const reply = { clearCookie: vi.fn() };
    const request = { cookies: { localSession: "x" }, sessionUser: { id: "u1" } };

    const result = await handler!(request as never, reply as never);

    expect(authService.logout).toHaveBeenCalledWith({ localSession: "x" });
    expect(reply.clearCookie).toHaveBeenCalledWith("localSession", { path: "/" });
    expect(reply.clearCookie).toHaveBeenCalledWith("accessToken", { path: "/" });
    expect(request.sessionUser).toBeNull();
    expect(result).toEqual({ success: true });
  });

  it("returns auth/me payload", async () => {
    const app = createApp();
    await registerAuthRoutes(app as never, { NODE_ENV: "test", AUTH_MODE: AuthMode.CLOUD } as never);

    const handler = findHandler(app.get.mock.calls, "/api/auth/me");
    const response = await handler!({ sessionUser: { id: "u1" } } as never);
    expect(response).toEqual({
      session: {
        mode: AuthMode.CLOUD,
        user: { id: "u1" }
      }
    });
  });
});
