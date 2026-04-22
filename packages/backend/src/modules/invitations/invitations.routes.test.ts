import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthMode } from "@elms/shared";

const requirePermission = vi.fn((permission: string) => `perm:${permission}`);
const requireEditionFeature = vi.fn((feature: string) => `feature:${feature}`);
const parsePaginationQuery = vi.fn();
const getAuditContext = vi.fn();

const createInvitation = vi.fn();
const listInvitations = vi.fn();
const revokeInvitation = vi.fn();

vi.mock("../../middleware/requireAuth.js", () => ({ requireAuth: "auth-guard" }));
vi.mock("../../middleware/requirePermission.js", () => ({ requirePermission }));
vi.mock("../../middleware/requireEditionFeature.js", () => ({ requireEditionFeature }));
vi.mock("../../utils/pagination.js", () => ({ parsePaginationQuery }));
vi.mock("../../utils/auditContext.js", () => ({ getAuditContext }));
vi.mock("./invitations.service.js", () => ({ createInvitation, listInvitations, revokeInvitation }));

const { registerInvitationRoutes } = await import("./invitations.routes.js");

function createApp() {
  return { get: vi.fn(), post: vi.fn() };
}

function findHandler(calls: unknown[][], path: string) {
  const call = calls.find((entry) => entry[0] === path);
  return call?.[2] as ((request: unknown, reply?: unknown) => Promise<unknown>) | undefined;
}

describe("registerInvitationRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parsePaginationQuery.mockReturnValue({ page: 1, limit: 25 });
    getAuditContext.mockReturnValue({ ipAddress: "127.0.0.1", userAgent: "vitest" });
  });

  it("returns 405 in local mode", async () => {
    const app = createApp();
    await registerInvitationRoutes(app as never, { AUTH_MODE: AuthMode.LOCAL } as never);

    const getHandler = findHandler(app.get.mock.calls, "/api/invitations");
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };

    const result = await getHandler!({ query: {}, sessionUser: { id: "u1" } } as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(405);
    expect(result).toBe(reply);
  });

  it("lists, creates, and revokes invitations in cloud mode", async () => {
    const app = createApp();
    await registerInvitationRoutes(app as never, { AUTH_MODE: AuthMode.CLOUD } as never);

    listInvitations.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 25 });
    createInvitation.mockResolvedValueOnce({ id: "inv-1" });
    revokeInvitation.mockResolvedValueOnce({ success: true });

    const listHandler = findHandler(app.get.mock.calls, "/api/invitations");
    const listed = await listHandler!({ query: { page: "1", limit: "25" }, sessionUser: { id: "u1" } } as never);
    expect(listed).toEqual({ items: [], total: 0, page: 1, pageSize: 25 });

    const createHandler = findHandler(app.post.mock.calls, "/api/invitations");
    const created = await createHandler!(
      {
        body: { email: "a@b.com", roleId: "0c44b264-f66f-42b5-b61f-94955af95a35" },
        sessionUser: { id: "u1" }
      } as never
    );
    expect(created).toEqual({ id: "inv-1" });

    const revokeHandler = findHandler(app.post.mock.calls, "/api/invitations/:id/revoke");
    const revoked = await revokeHandler!({ params: { id: "inv-1" }, sessionUser: { id: "u1" } } as never);
    expect(revoked).toEqual({ success: true });

    expect(requireEditionFeature).toHaveBeenCalledWith("multi_user");
  });
});
