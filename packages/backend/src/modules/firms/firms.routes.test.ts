import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermission = vi.fn((permission: string) => `perm:${permission}`);
const getCurrentFirm = vi.fn();
const getCurrentFirmSubscription = vi.fn();
const requestEditionChange = vi.fn();

vi.mock("../../middleware/requireAuth.js", () => ({ requireAuth: "auth-guard" }));
vi.mock("../../middleware/requirePermission.js", () => ({ requirePermission }));
vi.mock("./firms.service.js", () => ({ getCurrentFirm, getCurrentFirmSubscription, requestEditionChange }));

const { registerFirmRoutes } = await import("./firms.routes.js");

function createApp() {
  return { get: vi.fn(), post: vi.fn() };
}

function findHandler(calls: unknown[][], path: string) {
  const call = calls.find((entry) => entry[0] === path);
  return call?.[2] as ((request: unknown) => Promise<unknown>) | undefined;
}

describe("registerFirmRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets current firm and subscription", async () => {
    const app = createApp();
    getCurrentFirm.mockResolvedValueOnce({ id: "firm-1" });
    getCurrentFirmSubscription.mockResolvedValueOnce({ editionKey: "SOLO_OFFLINE" });

    await registerFirmRoutes(app as never);

    const meHandler = findHandler(app.get.mock.calls, "/api/firms/me");
    const subHandler = findHandler(app.get.mock.calls, "/api/firms/me/subscription");

    expect(await meHandler!({ sessionUser: { id: "u1" } } as never)).toEqual({ id: "firm-1" });
    expect(await subHandler!({ sessionUser: { id: "u1" } } as never)).toEqual({ editionKey: "SOLO_OFFLINE" });

    expect(requirePermission).toHaveBeenCalledWith("firms:read");
  });

  it("validates edition change request payload", async () => {
    const app = createApp();
    requestEditionChange.mockResolvedValueOnce({ success: true });
    await registerFirmRoutes(app as never);

    const handler = findHandler(app.post.mock.calls, "/api/firms/me/edition-change-request");

    await expect(handler!({ sessionUser: { id: "u1" }, body: { editionKey: "BAD" } } as never)).rejects.toThrow();

    const result = await handler!(
      { sessionUser: { id: "u1" }, body: { editionKey: "enterprise" } } as never
    );
    expect(result).toEqual({ success: true });
  });
});
