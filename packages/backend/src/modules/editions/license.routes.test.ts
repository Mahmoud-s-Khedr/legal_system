import { beforeEach, describe, expect, it, vi } from "vitest";

const activateLicense = vi.fn();
const requireAuth = vi.fn(async () => {});
const permissionHandler = vi.fn(async () => {});
const requirePermission = vi.fn(() => permissionHandler);

class MockLicenseServiceError extends Error {
  statusCode: number;
  code: string;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

vi.mock("../../middleware/requireAuth.js", () => ({
  requireAuth
}));

vi.mock("../../middleware/requirePermission.js", () => ({
  requirePermission
}));

vi.mock("./license.service.js", () => ({
  activateLicense,
  LicenseServiceError: MockLicenseServiceError
}));

const { registerLicenseRoutes } = await import("./license.routes.js");

describe("registerLicenseRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds settings:update permission preHandler for license activation", async () => {
    const post = vi.fn();
    const app = { post };

    await registerLicenseRoutes(app as never);

    expect(requirePermission).toHaveBeenCalledWith("settings:update");

    const call = post.mock.calls.find((entry) => entry[0] === "/api/licenses/activate");
    expect(call).toBeDefined();

    const options = call?.[1] as { preHandler: unknown[] };
    expect(options.preHandler).toHaveLength(2);
    expect(options.preHandler[0]).toBe(requireAuth);
    expect(options.preHandler[1]).toBe(permissionHandler);
  });

  it("passes firmId and activation key to service", async () => {
    const post = vi.fn();
    const app = { post };

    activateLicense.mockResolvedValue({ status: "activated" });

    await registerLicenseRoutes(app as never);

    const call = post.mock.calls.find((entry) => entry[0] === "/api/licenses/activate");
    const handler = call?.[2] as (request: unknown, reply: unknown) => Promise<unknown>;

    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };

    const result = await handler(
      {
        body: { activationKey: "ABCDEFGHIJ" },
        sessionUser: { firmId: "firm-1" }
      },
      reply
    );

    expect(activateLicense).toHaveBeenCalledWith("firm-1", "ABCDEFGHIJ");
    expect(result).toEqual({ status: "activated" });
  });
});
