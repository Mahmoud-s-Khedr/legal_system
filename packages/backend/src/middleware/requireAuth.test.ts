import { describe, expect, it, vi } from "vitest";
import { requireAuth } from "./requireAuth.js";

describe("requireAuth", () => {
  it("returns 401 when session user is missing", async () => {
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockResolvedValue(undefined)
    };

    await requireAuth({ sessionUser: null } as never, reply as never);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ message: "Authentication required" });
  });

  it("does nothing when session user exists", async () => {
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockResolvedValue(undefined)
    };

    await requireAuth({ sessionUser: { id: "u1" } } as never, reply as never);

    expect(reply.status).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });
});
