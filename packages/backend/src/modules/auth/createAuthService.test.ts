import { describe, expect, it, vi } from "vitest";
import { AuthMode } from "@elms/shared";

const createLocalAuthService = vi.fn();
const createCloudAuthService = vi.fn();
vi.mock("./localAuthService.js", () => ({ createLocalAuthService }));
vi.mock("./cloudAuthService.js", () => ({ createCloudAuthService }));

const { createAuthService } = await import("./createAuthService.js");

describe("createAuthService", () => {
  it("returns cloud auth service in cloud mode", () => {
    const app = { log: { warn: vi.fn() } };
    const service = { login: vi.fn() };
    createCloudAuthService.mockReturnValueOnce(service);

    const result = createAuthService(app as never, { AUTH_MODE: AuthMode.CLOUD } as never);

    expect(createCloudAuthService).toHaveBeenCalledWith(app, expect.objectContaining({ AUTH_MODE: AuthMode.CLOUD }));
    expect(result).toBe(service);
  });

  it("returns local auth service in local mode", () => {
    const app = { log: { warn: vi.fn() } };
    const service = { login: vi.fn() };
    createLocalAuthService.mockReturnValueOnce(service);

    const result = createAuthService(app as never, { AUTH_MODE: AuthMode.LOCAL } as never);

    expect(createLocalAuthService).toHaveBeenCalled();
    expect(result).toBe(service);
  });
});
