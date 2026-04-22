import { describe, expect, it, vi } from "vitest";

const multipartPlugin = vi.fn();
vi.mock("@fastify/multipart", () => ({ default: multipartPlugin }));

const { registerMultipartPlugin } = await import("./multipart.js");

describe("registerMultipartPlugin", () => {
  it("registers multipart with max upload bytes", async () => {
    const app = { register: vi.fn() };
    await registerMultipartPlugin(app as never, { MAX_UPLOAD_BYTES: 1234 } as never);

    expect(app.register).toHaveBeenCalledWith(
      multipartPlugin,
      expect.objectContaining({ limits: { fileSize: 1234 } })
    );
  });
});
