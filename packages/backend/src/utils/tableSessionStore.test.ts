import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTableSession, getTableSession } from "./tableSessionStore.js";

describe("tableSessionStore", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("creates and resolves scoped table sessions", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const created = createTableSession("import", "firm-1", [{ id: 1 }], {
      ttlMs: 1000,
      meta: { source: "csv" }
    });

    expect(created.id).toMatch(/^import_/);

    const resolved = getTableSession<{ id: number }>("import", "firm-1", created.id);
    expect(resolved?.rows).toEqual([{ id: 1 }]);
    expect(resolved?.meta).toEqual({ source: "csv" });

    expect(getTableSession("import", "firm-2", created.id)).toBeNull();
    expect(getTableSession("cases", "firm-1", created.id)).toBeNull();
  });

  it("prunes expired sessions", () => {
    const start = Date.now();
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(start);

    const created = createTableSession("import", "firm-1", [{ id: 1 }], { ttlMs: 5 });
    nowSpy.mockReturnValue(start + 10);

    expect(getTableSession("import", "firm-1", created.id)).toBeNull();
  });
});
