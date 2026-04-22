import { describe, expect, it, vi } from "vitest";

const rateLimitPlugin = vi.fn();
vi.mock("@fastify/rate-limit", () => ({ default: rateLimitPlugin }));

const { registerRateLimitPlugin } = await import("./rateLimit.js");

describe("registerRateLimitPlugin", () => {
  it("uses permissive local mode limits", async () => {
    const app = { register: vi.fn() };
    await registerRateLimitPlugin(app as never, { AUTH_MODE: "local" } as never);

    const options = app.register.mock.calls[0]?.[1];
    expect(app.register).toHaveBeenCalledWith(rateLimitPlugin, expect.any(Object));
    expect(options.max).toBe(10_000);
    expect(options.allowList({ url: "/anything" })).toBe(true);
    expect(options.keyGenerator({ headers: { "x-elms-session": "s1" }, ip: "1.1.1.1" })).toBe("session:s1");
    expect(options.keyGenerator({ headers: { cookie: "a=b" }, ip: "1.1.1.1" })).toBe("cookie:a=b");
    expect(options.keyGenerator({ headers: {}, ip: "1.1.1.1" })).toBe("ip:1.1.1.1");
  });

  it("allows only health endpoint in non-local mode", async () => {
    const app = { register: vi.fn() };
    await registerRateLimitPlugin(app as never, { AUTH_MODE: "cloud" } as never);

    const options = app.register.mock.calls[0]?.[1];
    expect(options.max).toBe(500);
    expect(options.allowList({ url: "/api/health" })).toBe(true);
    expect(options.allowList({ url: "/api/cases" })).toBe(false);
  });
});
