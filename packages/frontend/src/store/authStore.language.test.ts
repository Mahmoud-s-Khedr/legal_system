import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
const persistDesktopLocalSessionTokenMock = vi.hoisted(() => vi.fn());
const clearDesktopLocalSessionTokenMock = vi.hoisted(() => vi.fn());
const applyUserPreferredLanguageMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../lib/api", () => ({
  apiFetch: apiFetchMock,
  persistDesktopLocalSessionToken: persistDesktopLocalSessionTokenMock,
  clearDesktopLocalSessionToken: clearDesktopLocalSessionTokenMock
}));

vi.mock("../i18n", () => ({
  applyUserPreferredLanguage: applyUserPreferredLanguageMock
}));

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  apiFetchMock.mockReset();
  persistDesktopLocalSessionTokenMock.mockReset();
  clearDesktopLocalSessionTokenMock.mockReset();
  applyUserPreferredLanguageMock.mockReset();
  applyUserPreferredLanguageMock.mockResolvedValue(undefined);
});

describe("authStore language preference integration", () => {
  it("applies preferred language after bootstrap", async () => {
    apiFetchMock.mockResolvedValueOnce({
      session: {
        mode: "LOCAL",
        user: {
          id: "u1",
          firmId: "f1",
          editionKey: "CORE",
          pendingEditionKey: null,
          lifecycleStatus: "ACTIVE",
          trialEndsAt: null,
          graceEndsAt: null,
          roleId: "r1",
          roleKey: "admin",
          email: "u@example.com",
          fullName: "User",
          preferredLanguage: "fr",
          permissions: []
        }
      }
    });

    const { useAuthBootstrap } = await import("./authStore");
    await useAuthBootstrap.getState().bootstrap();

    expect(applyUserPreferredLanguageMock).toHaveBeenCalledWith("fr");
  });

  it("applies preferred language after login", async () => {
    apiFetchMock.mockResolvedValueOnce({
      session: {
        mode: "LOCAL",
        user: {
          id: "u1",
          firmId: "f1",
          editionKey: "CORE",
          pendingEditionKey: null,
          lifecycleStatus: "ACTIVE",
          trialEndsAt: null,
          graceEndsAt: null,
          roleId: "r1",
          roleKey: "admin",
          email: "u@example.com",
          fullName: "User",
          preferredLanguage: "en",
          permissions: []
        }
      },
      localSessionToken: null
    });

    const { useAuthBootstrap } = await import("./authStore");
    await useAuthBootstrap.getState().login({ email: "u@example.com", password: "x" });

    expect(applyUserPreferredLanguageMock).toHaveBeenCalledWith("en");
  });
});
