import { describe, expect, it } from "vitest";
import { buildConnectionDiagnostics } from "./BackendConnectionPage";

describe("BackendConnectionPage diagnostics", () => {
  it("builds structured diagnostics for blocked LAN backend requests", () => {
    expect(
      buildConnectionDiagnostics("http://192.168.100.22:17854/api/health")
    ).toEqual(
      expect.objectContaining({
        requestUrl: "http://192.168.100.22:17854/api/health",
        requestOrigin: window.location.origin,
        targetOrigin: "http://192.168.100.22:17854",
        targetIsPrivateNetwork: true,
        webviewOrigin: window.location.origin
      })
    );
  });
});
