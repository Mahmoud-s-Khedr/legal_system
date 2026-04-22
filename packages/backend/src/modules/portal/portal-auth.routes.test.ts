import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const mockPrisma = {
  client: { findFirst: vi.fn(), updateMany: vi.fn() },
  clientPortalInvite: { findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn()
};

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("bcryptjs");

const { registerPortalAuthRoutes } = await import("./portal-auth.routes.js");

function createApp() {
  return {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    jwt: {
      sign: vi.fn(),
      verify: vi.fn()
    }
  };
}

function getHandler(calls: unknown[][], path: string) {
  const call = calls.find((entry) => entry[0] === path);
  return (call?.[2] ?? call?.[1]) as ((request: unknown, reply?: unknown) => Promise<unknown>) | undefined;
}

describe("portal-auth.routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed" as never);
  });

  it("handles login invalid credentials and happy path", async () => {
    const app = createApp();
    app.jwt.sign.mockResolvedValue("portal-token");
    await registerPortalAuthRoutes(app as never, { NODE_ENV: "test", COOKIE_DOMAIN: "elms.local" } as never);

    const handler = getHandler(app.post.mock.calls, "/api/portal/auth/login");
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setCookie: vi.fn().mockReturnThis()
    };

    mockPrisma.client.findFirst.mockResolvedValueOnce(null);
    await handler!({ body: { email: "a@b.com", firmId: "f-1", password: "x" } } as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(401);

    mockPrisma.client.findFirst.mockResolvedValueOnce({ id: "c-1", firmId: "f-1", portalPasswordHash: "hash", name: "Client" });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);
    await handler!({ body: { email: "a@b.com", firmId: "f-1", password: "bad" } } as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(401);

    mockPrisma.client.findFirst.mockResolvedValueOnce({ id: "c-1", firmId: "f-1", portalPasswordHash: "hash", name: "Client" });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
    await handler!({ body: { email: "a@b.com", firmId: "f-1", password: "good" } } as never, reply as never);

    expect(mockPrisma.client.updateMany).toHaveBeenCalled();
    expect(app.jwt.sign).toHaveBeenCalled();
    expect(reply.setCookie).toHaveBeenCalledWith(
      "elms_portal_token",
      "portal-token",
      expect.objectContaining({ httpOnly: true, maxAge: 604800 })
    );
    expect(reply.send).toHaveBeenCalledWith({ ok: true, clientId: "c-1", firmId: "f-1", name: "Client" });
  });

  it("accepts invite and handles invalid invite / transaction race", async () => {
    const app = createApp();
    await registerPortalAuthRoutes(app as never, { NODE_ENV: "test" } as never);

    const handler = getHandler(app.post.mock.calls, "/api/portal/invite/accept");
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };

    mockPrisma.clientPortalInvite.findFirst.mockResolvedValueOnce(null);
    await handler!({ body: { token: "bad", password: "pass" } } as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(400);

    mockPrisma.clientPortalInvite.findFirst.mockResolvedValueOnce({ id: "i-1", clientId: "c-1", firmId: "f-1", email: "x@y.com" });
    mockPrisma.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        client: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        clientPortalInvite: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) }
      })
    );
    const ok = await handler!({ body: { token: "good", password: "pass" } } as never, reply as never);
    expect(ok).toEqual({ ok: true });

    mockPrisma.clientPortalInvite.findFirst.mockResolvedValueOnce({ id: "i-1", clientId: "c-1", firmId: "f-1", email: "x@y.com" });
    mockPrisma.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        client: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        clientPortalInvite: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) }
      })
    );
    await expect(handler!({ body: { token: "race", password: "pass" } } as never, reply as never)).rejects.toThrow(
      "Invite link is invalid or expired"
    );
  });

  it("returns me payload and token errors", async () => {
    const app = createApp();
    await registerPortalAuthRoutes(app as never, { NODE_ENV: "test" } as never);
    const handler = getHandler(app.get.mock.calls, "/api/portal/auth/me");
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };

    await handler!({ cookies: {} } as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(401);

    app.jwt.verify.mockRejectedValueOnce(new Error("bad"));
    await handler!({ cookies: { elms_portal_token: "t" } } as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(401);

    app.jwt.verify.mockResolvedValueOnce({ aud: "wrong", firmId: "f-1", clientId: "c-1" });
    await handler!({ cookies: { elms_portal_token: "t" } } as never, reply as never);
    expect(reply.send).toHaveBeenCalledWith({ message: "Invalid token audience" });

    app.jwt.verify.mockResolvedValueOnce({ aud: "elms-portal", firmId: "f-1", clientId: "missing" });
    mockPrisma.client.findFirst.mockResolvedValueOnce(null);
    await handler!({ cookies: { elms_portal_token: "t" } } as never, reply as never);
    expect(reply.send).toHaveBeenCalledWith({ message: "Client not found" });

    app.jwt.verify.mockResolvedValueOnce({ aud: "elms-portal", firmId: "f-1", clientId: "c-1" });
    mockPrisma.client.findFirst.mockResolvedValueOnce({ id: "c-1", firmId: "f-1", name: "Client" });
    const me = await handler!({ cookies: { elms_portal_token: "t" } } as never, reply as never);
    expect(me).toEqual({ clientId: "c-1", firmId: "f-1", name: "Client" });
  });

  it("guards staff-only invite/revoke routes and supports logout", async () => {
    const app = createApp();
    await registerPortalAuthRoutes(app as never, { NODE_ENV: "test" } as never);

    const logout = getHandler(app.post.mock.calls, "/api/portal/auth/logout");
    const logoutReply = { clearCookie: vi.fn().mockReturnThis(), send: vi.fn() };
    await logout!({} as never, logoutReply as never);
    expect(logoutReply.clearCookie).toHaveBeenCalledWith("elms_portal_token", { path: "/" });

    const inviteCall = app.post.mock.calls.find((entry) => entry[0] === "/api/clients/:clientId/portal/invite") as
      | [string, { preHandler: Array<(request: unknown, reply: unknown) => Promise<unknown>> }, (request: unknown, reply: unknown) => Promise<unknown>]
      | undefined;
    const revokeCall = app.delete.mock.calls.find((entry) => entry[0] === "/api/clients/:clientId/portal/access") as
      | [string, { preHandler: Array<(request: unknown, reply: unknown) => Promise<unknown>> }, (request: unknown, reply: unknown) => Promise<unknown>]
      | undefined;

    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };

    await inviteCall![1].preHandler[0]!({ sessionUser: null } as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(401);

    await inviteCall![1].preHandler[0]!({ sessionUser: { permissions: [] } } as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(403);

    mockPrisma.client.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "c-1" });

    await inviteCall![2](
      { sessionUser: { firmId: "f-1" }, params: { clientId: "c-1" }, body: { email: "c@example.com" } } as never,
      reply as never
    );
    expect(reply.status).toHaveBeenCalledWith(404);

    const created = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
    await inviteCall![2](
      {
        sessionUser: { firmId: "f-1" },
        params: { clientId: "c-1" },
        body: { email: "c@example.com" }
      } as never,
      created as never
    );
    expect(mockPrisma.clientPortalInvite.create).toHaveBeenCalled();
    expect(created.status).toHaveBeenCalledWith(201);
    expect(created.send).toHaveBeenCalledWith(expect.objectContaining({ inviteToken: expect.any(String) }));

    await revokeCall![1].preHandler[0]!({ sessionUser: null } as never, reply as never);
    await revokeCall![1].preHandler[0]!({ sessionUser: { permissions: [] } } as never, reply as never);

    const revoked = await revokeCall![2](
      { sessionUser: { firmId: "f-1" }, params: { clientId: "c-1" } } as never,
      reply as never
    );
    expect(mockPrisma.client.updateMany).toHaveBeenCalled();
    expect(mockPrisma.clientPortalInvite.deleteMany).toHaveBeenCalled();
    expect(revoked).toEqual({ success: true });
  });
});
