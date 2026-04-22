import { describe, expect, it, vi } from "vitest";

const jwtPlugin = vi.fn();
vi.mock("@fastify/jwt", () => ({ default: jwtPlugin }));

const { registerJwtPlugin } = await import("./auth.js");

describe("registerJwtPlugin", () => {
  it("registers fastify jwt with RS256 keys", async () => {
    const app = { register: vi.fn() };

    await registerJwtPlugin(
      app as never,
      { JWT_PRIVATE_KEY: "private", JWT_PUBLIC_KEY: "public" } as never
    );

    expect(app.register).toHaveBeenCalledWith(
      jwtPlugin,
      expect.objectContaining({
        secret: { private: "private", public: "public" },
        sign: { algorithm: "RS256" }
      })
    );
  });
});
