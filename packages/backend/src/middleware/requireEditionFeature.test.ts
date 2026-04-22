import { describe, expect, it, vi } from "vitest";

const hasEditionFeature = vi.fn();
vi.mock("../modules/editions/editionPolicy.js", () => ({ hasEditionFeature }));

const { requireEditionFeature } = await import("./requireEditionFeature.js");

describe("requireEditionFeature", () => {
  it("returns 401 when no actor", async () => {
    const handler = requireEditionFeature("multi_user");
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockResolvedValue(undefined) };

    await handler({ sessionUser: null } as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(401);
  });

  it("returns 403 when feature is unavailable", async () => {
    const handler = requireEditionFeature("multi_user");
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockResolvedValue(undefined) };
    hasEditionFeature.mockReturnValueOnce(false);

    await handler({ sessionUser: { editionKey: "SOLO_OFFLINE" } } as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(403);
  });

  it("allows when feature is available", async () => {
    const handler = requireEditionFeature("multi_user");
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };
    hasEditionFeature.mockReturnValueOnce(true);

    await handler({ sessionUser: { editionKey: "ENTERPRISE" } } as never, reply as never);
    expect(reply.status).not.toHaveBeenCalled();
  });
});
