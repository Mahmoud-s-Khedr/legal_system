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

  it("falls back to default desktop backend when saved override is unreachable", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_DESKTOP_SHELL", "true");
    vi.stubEnv("VITE_DESKTOP_RUNTIME_VARIANT", "embedded");
    vi.stubEnv("VITE_API_BASE_URL", "");
    window.localStorage.setItem("elms.desktopBackendBaseUrl", "http://10.10.10.10:9000");

    const invokeMock = vi.fn(async (command: string, args?: Record<string, unknown>) => {
      if (command === "desktop_get_runtime_backend_url") {
        return { baseUrl: "http://127.0.0.1:17854" };
      }
      if (command === "desktop_get_backend_connection") {
        return { baseUrl: "http://10.10.10.10:9000" };
      }
      if (command === "desktop_set_backend_connection") {
        expect(args).toEqual({ baseUrl: null });
        return { ok: true, code: null };
      }
      return { phase: "ready" };
    });

    vi.doMock("@tauri-apps/api/core", () => ({
      invoke: invokeMock
    }));

    const addToast = vi.fn();
    vi.doMock("../store/toastStore", () => ({
      useToastStore: {
        getState: () => ({ addToast })
      }
    }));

    const blob = new Blob(["fallback"], { type: "application/pdf" });
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "http://10.10.10.10:9000/api/health") {
        throw new TypeError("NetworkError");
      }

      if (url === "http://127.0.0.1:17854/api/health") {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: vi.fn().mockResolvedValue({ ok: true })
        } satisfies Partial<Response>;
      }

      if (url === "http://127.0.0.1:17854/api/reports/case-status/export?format=pdf") {
        return {
          ok: true,
          status: 200,
          headers: new Headers({
            "Content-Type": "application/pdf",
            "Content-Disposition": "attachment; filename=fallback.pdf"
          }),
          blob: vi.fn().mockResolvedValue(blob)
        } satisfies Partial<Response>;
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { apiDownload } = await import("./api");
    const result = await apiDownload("/api/reports/case-status/export?format=pdf");

    expect(result.filename).toBe("fallback.pdf");
    expect(window.localStorage.getItem("elms.desktopBackendBaseUrl")).toBeNull();
    expect(addToast).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("desktop_set_backend_connection", { baseUrl: null });
  });

  it("maps network fetch failures to BACKEND_UNREACHABLE", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_DESKTOP_SHELL", "true");
    vi.stubEnv("VITE_DESKTOP_RUNTIME_VARIANT", "embedded");
    vi.stubEnv("VITE_API_BASE_URL", "");
    window.localStorage.setItem("elms.desktopBackendBaseUrl", "http://10.10.10.10:9000");

    const invokeMock = vi.fn(async (command: string) => {
      if (command === "desktop_get_runtime_backend_url") {
        return { baseUrl: "http://127.0.0.1:17854" };
      }
      if (command === "desktop_get_backend_connection") {
        return { baseUrl: "http://10.10.10.10:9000" };
      }
      if (command === "desktop_bootstrap_status") {
        return { phase: "ready" };
      }
      return { ok: true, code: null };
    });

    vi.doMock("@tauri-apps/api/core", () => ({
      invoke: invokeMock
    }));

    const fetchMock = vi.fn(async (url: string) => {
      if (url === "http://10.10.10.10:9000/api/health" || url === "http://127.0.0.1:17854/api/health") {
        throw new TypeError("NetworkError");
      }

      if (url === "http://10.10.10.10:9000/api/auth/login") {
        throw new TypeError("NetworkError");
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
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

    const snapshotRaw = window.localStorage.getItem("elms.desktopBackendConnectivity");
    expect(snapshotRaw).toBeTruthy();
    const snapshot = JSON.parse(snapshotRaw as string) as Record<string, unknown>;
    expect(snapshot.reason).toBe("NETWORK_FETCH_FAILED");
    expect(snapshot.requestUrl).toBe("http://10.10.10.10:9000/api/auth/login");
    expect(snapshot.selectedBaseUrl).toBe("http://10.10.10.10:9000");
    expect(snapshot.runtimeBaseUrl).toBe("http://127.0.0.1:17854");
    expect(snapshot.desktopRuntimeVariant).toBe("embedded");
    expect(snapshot.windowOrigin).toBeTruthy();
  });

  it("blocks auth calls when desktop bootstrap has failed", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_DESKTOP_SHELL", "true");
    vi.stubEnv("VITE_DESKTOP_RUNTIME_VARIANT", "embedded");
    vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:7854");

    const invokeMock = vi.fn(async (command: string) => {
      if (command === "desktop_get_runtime_backend_url") {
        return { baseUrl: "http://127.0.0.1:17854" };
      }
      if (command === "desktop_get_backend_connection") {
        return { baseUrl: null };
      }
      if (command === "desktop_bootstrap_status") {
        return {
          phase: "failed",
          message: "Backend health check failed",
          failureCode: "postgres_startup_failed"
        };
      }
      return { ok: true, code: null };
    });

    vi.doMock("@tauri-apps/api/core", () => ({
      invoke: invokeMock
    }));

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch } = await import("./api");

    await expect(
      apiFetch("/api/auth/me")
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 503
    });

    expect(fetchMock).not.toHaveBeenCalledWith(
      "http://127.0.0.1:17854/api/auth/me",
      expect.anything()
    );
  });

  it("does not duplicate /api when VITE_API_BASE_URL is /api", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_DESKTOP_SHELL", "false");
    vi.stubEnv("VITE_API_BASE_URL", "/api");

    const { resolveApiUrl } = await import("./api");
    expect(resolveApiUrl("/api/health")).toBe("/api/health");
  });

  it("does not duplicate /api when VITE_API_BASE_URL is an absolute /api origin", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_DESKTOP_SHELL", "false");
    vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:7854/api");

    const { resolveApiUrl } = await import("./api");
    expect(resolveApiUrl("/api/health")).toBe("http://127.0.0.1:7854/api/health");
  });
});
