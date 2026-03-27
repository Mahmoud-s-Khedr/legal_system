import { afterEach, describe, expect, it, vi } from "vitest";

describe("apiDownload", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    window.localStorage.clear();
  });

  it("includes desktop session header and credentials", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_DESKTOP_SHELL", "true");

    const blob = new Blob(["test"], { type: "application/pdf" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=report.pdf"
      }),
      blob: vi.fn().mockResolvedValue(blob)
    } satisfies Partial<Response>);
    vi.stubGlobal("fetch", fetchMock);

    const { apiDownload, persistDesktopLocalSessionToken } = await import("./api");
    persistDesktopLocalSessionToken("session-123");

    const result = await apiDownload("/api/reports/case-status/export?format=pdf");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sentHeaders = new Headers(init.headers);

    expect(init.credentials).toBe("include");
    expect(sentHeaders.get("x-elms-session")).toBe("session-123");
    expect(result.filename).toBe("report.pdf");
    expect(result.contentType).toBe("application/pdf");
    expect(result.blob).toBe(blob);
  });

  it("throws ApiError on non-ok response", async () => {
    vi.resetModules();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: new Headers({ "Content-Type": "application/json" }),
      json: vi.fn().mockResolvedValue({ message: "Authentication required" })
    } satisfies Partial<Response>);
    vi.stubGlobal("fetch", fetchMock);

    const { apiDownload, ApiError } = await import("./api");

    const promise = apiDownload("/api/reports/case-status/export?format=pdf");
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      status: 401,
      message: "Authentication required"
    });
  });
});
