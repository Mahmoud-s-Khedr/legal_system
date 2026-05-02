import { describe, expect, it, vi } from "vitest";

const requirePermission = vi.fn((permission: string) => `perm:${permission}`);
const getDashboard = vi.fn();
const getDashboardAnalytics = vi.fn();

vi.mock("../../middleware/requireAuth.js", () => ({ requireAuth: "auth-guard" }));
vi.mock("../../middleware/requirePermission.js", () => ({ requirePermission }));
vi.mock("./dashboard.service.js", () => ({ getDashboard, getDashboardAnalytics }));

const { registerDashboardRoutes } = await import("./dashboard.routes.js");

describe("registerDashboardRoutes", () => {
  it("registers dashboard route and forwards actor/query", async () => {
    const app = { get: vi.fn() };
    getDashboard.mockResolvedValueOnce({ scope: "my" });

    await registerDashboardRoutes(app as never);

    const call = app.get.mock.calls.find((entry) => entry[0] === "/api/dashboard") as
      | [string, { preHandler: unknown[] }, (request: unknown) => Promise<unknown>]
      | undefined;

    expect(call?.[1].preHandler).toEqual(["auth-guard", "perm:dashboard:read"]);
    expect(await call![2]({ query: { scope: "team" }, sessionUser: { id: "u1" } } as never)).toEqual({ scope: "my" });
    expect(getDashboard).toHaveBeenCalledWith({ id: "u1" }, "team");
  });

  it("registers analytics route and uses defaults", async () => {
    const app = { get: vi.fn() };
    getDashboardAnalytics.mockResolvedValueOnce({ scope: "my", range: "30d" });

    await registerDashboardRoutes(app as never);

    const call = app.get.mock.calls.find((entry) => entry[0] === "/api/dashboard/analytics") as
      | [string, { preHandler: unknown[] }, (request: unknown) => Promise<unknown>]
      | undefined;

    expect(await call![2]({ query: {}, sessionUser: { id: "u1" } } as never)).toEqual({ scope: "my", range: "30d" });
    expect(getDashboardAnalytics).toHaveBeenCalledWith({ id: "u1" }, "my", "30d");
    expect(requirePermission).toHaveBeenCalledWith("dashboard:read");
  });
});
