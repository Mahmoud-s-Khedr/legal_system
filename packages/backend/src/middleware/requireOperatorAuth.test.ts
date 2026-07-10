import { describe, expect, it, vi } from "vitest";
import { requireOperatorAuth } from "./requireOperatorAuth.js";

function createReply() {
  return {
    clearCookie: vi.fn(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockResolvedValue(undefined)
  };
}

describe("requireOperatorAuth", () => {
  it("rejects with 401 when no operator session is present", async () => {
    const reply = createReply();
    await requireOperatorAuth({ operatorUser: null } as never, reply as never);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ message: "Operator authentication required" });
    expect(reply.clearCookie).toHaveBeenCalledWith("elms_operator_access_token", { path: "/" });
  });

  it("rejects a tenant session masquerading as an operator (no operatorUser attached)", async () => {
    // A tenant JWT never resolves request.operatorUser (separate cookie + audience),
    // so this must behave identically to the anonymous case.
    const reply = createReply();
    await requireOperatorAuth(
      { operatorUser: null, sessionUser: { id: "tenant-user-1", firmId: "firm-1" } } as never,
      reply as never
    );

    expect(reply.status).toHaveBeenCalledWith(401);
  });

  it("passes through when an operator session is present", async () => {
    const reply = createReply();
    await requireOperatorAuth(
      { operatorUser: { id: "op-1", email: "a@b.com", displayName: "Op", status: "ACTIVE" } } as never,
      reply as never
    );

    expect(reply.status).not.toHaveBeenCalled();
  });
});
