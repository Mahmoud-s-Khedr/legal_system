import { afterEach, describe, expect, it, vi } from "vitest";

describe("apiDownload", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    window.localStorage.clear();
  });

  it("sends credentials and returns the parsed download result", async () => {
    vi.resetModules();

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

    const { apiDownload } = await import("./api");

    const result = await apiDownload("/api/reports/case-status/export?format=pdf");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(init.credentials).toBe("include");
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

  it("uses error payload when message key is absent", async () => {
    vi.resetModules();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: new Headers({ "Content-Type": "application/json" }),
      json: vi.fn().mockResolvedValue({ error: "Template not found or is a system template" })
    } satisfies Partial<Response>);
    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch } = await import("./api");

    await expect(apiFetch("/api/templates/missing", { method: "DELETE" })).rejects.toMatchObject({
      status: 404,
      message: "Template not found or is a system template"
    });
  });

  it("localizes validation issues with interpolation params", async () => {
    vi.resetModules();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      headers: new Headers({ "Content-Type": "application/json" }),
      json: vi.fn().mockResolvedValue({
        code: "VALIDATION_ERROR",
        message: "Please review the highlighted fields and try again.",
        issues: [
          {
            path: "title",
            code: "too_small",
            message: "Must be at least 2 characters.",
            messageKey: "VALIDATION_TOO_SMALL",
            params: { minimum: 2 }
          }
        ]
      })
    } satisfies Partial<Response>);
    vi.stubGlobal("fetch", fetchMock);

    const i18nModule = await import("../i18n");
    await i18nModule.default.changeLanguage("en");
    const { apiFetch, ApiError } = await import("./api");

    await expect(apiFetch("/api/cases", { method: "POST", body: "{}" })).rejects.toBeInstanceOf(ApiError);

    try {
      await apiFetch("/api/cases", { method: "POST", body: "{}" });
    } catch (error) {
      const apiError = error as InstanceType<typeof ApiError>;
      expect(apiError.status).toBe(400);
      expect(apiError.details).toMatchObject({
        code: "VALIDATION_ERROR",
        issues: [
          {
            path: "title",
            messageKey: "VALIDATION_TOO_SMALL",
            params: { minimum: 2 }
          }
        ]
      });
      const details = apiError.details as { issues?: Array<{ message?: string }> };
      expect(details.issues?.[0]?.message).toContain("2");
    }
  });

  it("maps network fetch failures to BACKEND_UNREACHABLE", async () => {
    vi.resetModules();

    const fetchMock = vi.fn(async () => {
      throw new TypeError("NetworkError");
    });
    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch } = await import("./api");

    await expect(
      apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "x@test.com", password: "pw" })
      })
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 503
    });
  });

  it("does not duplicate /api when VITE_API_BASE_URL is /api", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_API_BASE_URL", "/api");

    const { resolveApiUrl } = await import("./api");
    expect(resolveApiUrl("/api/health")).toBe("/api/health");
  });

  it("does not duplicate /api when VITE_API_BASE_URL is an absolute /api origin", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:7854/api");

    const { resolveApiUrl } = await import("./api");
    expect(resolveApiUrl("/api/health")).toBe("http://127.0.0.1:7854/api/health");
  });
});
