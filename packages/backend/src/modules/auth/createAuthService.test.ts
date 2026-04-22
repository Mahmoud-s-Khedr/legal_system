import { describe, expect, it, vi } from "vitest";
import { AuthMode } from "@elms/shared";

const createLocalAuthService = vi.fn();
vi.mock("./localAuthService.js", () => ({ createLocalAuthService }));

const { createAuthService } = await import("./createAuthService.js");

describe("createAuthService", () => {
  it("returns local auth service and warns for non-local mode", () => {
    const app = { log: { warn: vi.fn() } };
    const service = { login: vi.fn() };
    createLocalAuthService.mockReturnValueOnce(service);

    const result = createAuthService(app as never, { AUTH_MODE: AuthMode.CLOUD } as never);

    expect(app.log.warn).toHaveBeenCalled();
    expect(result).toBe(service);
  });

  it("does not warn in local mode", () => {
    const app = { log: { warn: vi.fn() } };
    const service = { login: vi.fn() };
    createLocalAuthService.mockReturnValueOnce(service);

    const result = createAuthService(app as never, { AUTH_MODE: AuthMode.LOCAL } as never);

    expect(app.log.warn).not.toHaveBeenCalled();
    expect(result).toBe(service);
  });
});
