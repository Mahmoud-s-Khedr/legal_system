import { describe, expect, it, vi } from "vitest";
import { FirmLifecycleStatus, EditionKey } from "@elms/shared";

const isTrialEnabled = vi.fn();
vi.mock("../modules/editions/editionPolicy.js", () => ({ isTrialEnabled }));

const { registerLicenseAccessGuard } = await import("./licenseAccessGuard.js");

describe("registerLicenseAccessGuard", () => {
  it("blocks non-licensed non-trial users on non-settings routes", async () => {
    const addHook = vi.fn();
    registerLicenseAccessGuard({ addHook } as never);

    const hook = addHook.mock.calls[0]?.[1] as ((request: unknown, reply: unknown) => Promise<void>);
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockResolvedValue(undefined) };
    isTrialEnabled.mockReturnValueOnce(false);

    await hook(
      {
        sessionUser: {
          lifecycleStatus: FirmLifecycleStatus.ACTIVE,
          editionKey: EditionKey.ENTERPRISE
        },
        routeOptions: { url: "/api/cases" }
      } as never,
      reply as never
    );

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ code: "LICENSE_REQUIRED" }));
  });

  it("allows settings paths, licensed users, trial-enabled editions, and anonymous requests", async () => {
    const addHook = vi.fn();
    registerLicenseAccessGuard({ addHook } as never);
    const hook = addHook.mock.calls[0]?.[1] as ((request: unknown, reply: unknown) => Promise<void>);
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };

    await hook({ sessionUser: null, routeOptions: { url: "/api/cases" } } as never, reply as never);
    await hook(
      {
        sessionUser: { lifecycleStatus: FirmLifecycleStatus.ACTIVE, editionKey: EditionKey.ENTERPRISE },
        routeOptions: { url: "/api/auth/me" }
      } as never,
      reply as never
    );

    await hook(
      {
        sessionUser: { lifecycleStatus: FirmLifecycleStatus.LICENSED, editionKey: EditionKey.ENTERPRISE },
        routeOptions: { url: "/api/cases" }
      } as never,
      reply as never
    );

    isTrialEnabled.mockReturnValueOnce(true);
    await hook(
      {
        sessionUser: { lifecycleStatus: FirmLifecycleStatus.ACTIVE, editionKey: EditionKey.SOLO_OFFLINE },
        routeOptions: { url: "/api/cases" }
      } as never,
      reply as never
    );

    expect(reply.status).not.toHaveBeenCalled();
  });
});
