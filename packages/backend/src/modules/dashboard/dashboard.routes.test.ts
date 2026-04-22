import { describe, expect, it, vi } from "vitest";

const requirePermission = vi.fn((permission: string) => `perm:${permission}`);
const getDashboardSummary = vi.fn();

vi.mock("../../middleware/requireAuth.js", () => ({ requireAuth: "auth-guard" }));
vi.mock("../../middleware/requirePermission.js", () => ({ requirePermission }));
vi.mock("./dashboard.service.js", () => ({ getDashboardSummary }));

const { registerDashboardRoutes } = await import("./dashboard.routes.js");

describe("registerDashboardRoutes", () => {
  it("registers summary route and forwards actor", async () => {
    const app = { get: vi.fn() };
    getDashboardSummary.mockResolvedValueOnce({ openCases: 5 });

    await registerDashboardRoutes(app as never);

    const call = app.get.mock.calls.find((entry) => entry[0] === "/api/dashboard/summary") as
      | [string, { preHandler: unknown[] }, (request: unknown) => Promise<unknown>]
      | undefined;

    expect(call?.[1].preHandler).toEqual(["auth-guard", "perm:dashboard:read"]);
    expect(await call![2]({ sessionUser: { id: "u1" } } as never)).toEqual({ openCases: 5 });
    expect(requirePermission).toHaveBeenCalledWith("dashboard:read");
  });
});
