import { describe, expect, it, vi } from "vitest";

const cookiePlugin = vi.fn();
vi.mock("@fastify/cookie", () => ({ default: cookiePlugin }));

const { registerCookiePlugin } = await import("./cookie.js");

describe("registerCookiePlugin", () => {
  it("registers @fastify/cookie", async () => {
    const app = { register: vi.fn() };
    await registerCookiePlugin(app as never);
    expect(app.register).toHaveBeenCalledWith(cookiePlugin);
  });
});
