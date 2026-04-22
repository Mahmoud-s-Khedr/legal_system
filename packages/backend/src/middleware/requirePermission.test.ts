import { describe, expect, it, vi } from "vitest";
import { requirePermission } from "./requirePermission.js";

describe("requirePermission", () => {
  it("returns 401 for unauthenticated requests", async () => {
    const handler = requirePermission("users:read");
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockResolvedValue(undefined) };

    await handler({ sessionUser: null } as never, reply as never);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ message: "Authentication required" });
  });

  it("returns 403 for missing permission", async () => {
    const handler = requirePermission("users:delete");
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockResolvedValue(undefined) };

    await handler({ sessionUser: { permissions: ["users:read"] } } as never, reply as never);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({ message: "Forbidden" });
  });

  it("allows when permission exists", async () => {
    const handler = requirePermission("users:read");
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };

    await handler({ sessionUser: { permissions: ["users:read"] } } as never, reply as never);

    expect(reply.status).not.toHaveBeenCalled();
  });
});
