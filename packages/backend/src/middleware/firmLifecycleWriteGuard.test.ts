import { describe, expect, it, vi } from "vitest";
import { FirmLifecycleStatus } from "@elms/shared";
import { registerFirmLifecycleWriteGuard } from "./firmLifecycleWriteGuard.js";

describe("registerFirmLifecycleWriteGuard", () => {
  it("blocks writes for suspended/pending-deletion firms except allowlisted paths", async () => {
    const addHook = vi.fn();
    registerFirmLifecycleWriteGuard({ addHook } as never);

    const hook = addHook.mock.calls[0]?.[1] as ((request: unknown, reply: unknown) => Promise<void>);
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockResolvedValue(undefined) };

    await hook(
      {
        method: "POST",
        routeOptions: { url: "/api/cases" },
        sessionUser: { lifecycleStatus: FirmLifecycleStatus.SUSPENDED }
      } as never,
      reply as never
    );

    expect(reply.status).toHaveBeenCalledWith(423);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Firm subscription is not active for write operations" })
    );

    await hook(
      {
        method: "POST",
        routeOptions: { url: "/api/auth/logout" },
        sessionUser: { lifecycleStatus: FirmLifecycleStatus.SUSPENDED }
      } as never,
      reply as never
    );

    expect(reply.status).toHaveBeenCalledTimes(1);
  });

  it("allows reads, active firms, and unauthenticated requests", async () => {
    const addHook = vi.fn();
    registerFirmLifecycleWriteGuard({ addHook } as never);

    const hook = addHook.mock.calls[0]?.[1] as ((request: unknown, reply: unknown) => Promise<void>);
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };

    await hook({ method: "GET", routeOptions: { url: "/api/cases" }, sessionUser: null } as never, reply as never);
    await hook(
      {
        method: "PATCH",
        routeOptions: { url: "/api/cases/1" },
        sessionUser: { lifecycleStatus: FirmLifecycleStatus.ACTIVE }
      } as never,
      reply as never
    );

    expect(reply.status).not.toHaveBeenCalled();
  });
});
