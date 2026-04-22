import { describe, expect, it, vi } from "vitest";
import { registerInjectTenantHook } from "./injectTenant.js";

describe("registerInjectTenantHook", () => {
  it("removes x-firm-id header", async () => {
    const addHook = vi.fn();
    registerInjectTenantHook({ addHook } as never);

    const hook = addHook.mock.calls[0]?.[1] as ((request: unknown) => Promise<void>);
    const request = { headers: { "x-firm-id": "tenant-1", other: "x" } };

    await hook(request as never);

    expect(request.headers).toEqual({ other: "x" });
  });
});
