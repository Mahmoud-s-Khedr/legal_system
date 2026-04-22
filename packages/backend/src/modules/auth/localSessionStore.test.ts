import { beforeEach, describe, expect, it, vi } from "vitest";

const randomUUID = vi.fn();
const existsSync = vi.fn();
const readFileSync = vi.fn();
const mkdirSync = vi.fn();
const writeFileSync = vi.fn();
const loadEnv = vi.fn();

vi.mock("node:crypto", () => ({ randomUUID }));
vi.mock("node:fs", () => ({
  default: {
    existsSync,
    readFileSync,
    mkdirSync,
    writeFileSync
  }
}));
vi.mock("../../config/env.js", () => ({ loadEnv }));

describe("localSessionStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    randomUUID.mockReturnValue("session-1");
  });

  it("hydrates from disk, creates/resolves/destroys sessions, and persists", async () => {
    loadEnv.mockReturnValue({
      LOCAL_SESSION_STORE_PATH: "/tmp/store.json",
      LOCAL_SESSION_TTL_HOURS: 1
    });
    existsSync.mockReturnValue(true);
    readFileSync.mockReturnValue(JSON.stringify({ old: { userId: "u0", createdAt: Date.now() } }));

    const { localSessionStore } = await import("./localSessionStore.js");

    const id = localSessionStore.create("u1");
    expect(id).toBe("session-1");

    const resolved = localSessionStore.resolve("session-1");
    expect(resolved).toEqual(expect.objectContaining({ userId: "u1" }));

    localSessionStore.destroy("session-1");
    expect(mkdirSync).toHaveBeenCalled();
    expect(writeFileSync).toHaveBeenCalled();

    expect(localSessionStore.resolve()).toBeNull();
  });

  it("treats malformed store as empty and expires stale sessions", async () => {
    vi.resetModules();

    loadEnv.mockReturnValue({
      LOCAL_SESSION_STORE_PATH: "/tmp/store.json",
      LOCAL_SESSION_TTL_HOURS: 1
    });
    existsSync.mockReturnValue(true);
    readFileSync.mockReturnValue("{not-json");

    const nowSpy = vi.spyOn(Date, "now");
    const start = 1_000_000;
    nowSpy.mockReturnValue(start);

    const { localSessionStore } = await import("./localSessionStore.js");
    randomUUID.mockReturnValue("session-exp");
    const id = localSessionStore.create("u-exp");

    nowSpy.mockReturnValue(start + 4_000_000);
    expect(localSessionStore.resolve(id)).toBeNull();
  });

  it("skips hydrate when store file is absent", async () => {
    vi.resetModules();

    loadEnv.mockReturnValue({
      LOCAL_SESSION_STORE_PATH: "/tmp/store.json",
      LOCAL_SESSION_TTL_HOURS: 1
    });
    existsSync.mockReturnValue(false);

    const { localSessionStore } = await import("./localSessionStore.js");
    expect(localSessionStore.resolve("missing")).toBeNull();
    expect(readFileSync).not.toHaveBeenCalled();
  });
});
