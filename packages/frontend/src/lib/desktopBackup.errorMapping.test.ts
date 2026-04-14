import { afterEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock
}));

async function importDesktopBackup(desktopShell: boolean) {
  vi.resetModules();
  vi.stubEnv("VITE_DESKTOP_SHELL", desktopShell ? "true" : "false");
  return import("./desktopBackup");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  invokeMock.mockReset();
});

describe("desktopBackup error mapping", () => {
  it("maps rejected Error values without the Error: prefix", async () => {
    const { getDesktopBackupPolicy } = await importDesktopBackup(true);
    invokeMock.mockRejectedValue(new Error("Desktop runtime is not ready for backup"));

    await expect(getDesktopBackupPolicy()).rejects.toThrow(
      "Desktop runtime is still starting. Try again in a moment."
    );
  });
});
