import { beforeEach, describe, expect, it, vi } from "vitest";

const parsePaginationQuery = vi.fn();
const listNotifications = vi.fn();
const listPreferences = vi.fn();
const markAllRead = vi.fn();
const markRead = vi.fn();
const upsertPreference = vi.fn();
const getUnreadCount = vi.fn();

vi.mock("../../middleware/requireAuth.js", () => ({ requireAuth: "auth-guard" }));
vi.mock("../../utils/pagination.js", () => ({ parsePaginationQuery }));
vi.mock("./notification.service.js", () => ({
  listNotifications,
  listPreferences,
  markAllRead,
  markRead,
  upsertPreference,
  getUnreadCount
}));

const { registerNotificationRoutes } = await import("./notifications.routes.js");

function createApp() {
  return { get: vi.fn(), patch: vi.fn(), put: vi.fn() };
}

function findHandler(calls: unknown[][], path: string) {
  const call = calls.find((entry) => entry[0] === path);
  return call?.[2] as ((request: unknown) => Promise<unknown>) | undefined;
}

describe("registerNotificationRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parsePaginationQuery.mockReturnValue({ page: 1, limit: 20 });
  });

  it("lists notifications and unread count", async () => {
    const app = createApp();
    listNotifications.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 20 });
    getUnreadCount.mockResolvedValueOnce(3);

    await registerNotificationRoutes(app as never);

    const listHandler = findHandler(app.get.mock.calls, "/api/notifications");
    const listResult = await listHandler!(
      { query: { isRead: "false", page: "1", limit: "20" }, sessionUser: { id: "u1" } } as never
    );
    expect(listResult).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });

    const countHandler = findHandler(app.get.mock.calls, "/api/notifications/unread-count");
    expect(await countHandler!({ sessionUser: { id: "u1" } } as never)).toEqual({ count: 3 });
  });

  it("marks notifications read and read-all", async () => {
    const app = createApp();
    await registerNotificationRoutes(app as never);

    const readHandler = findHandler(app.patch.mock.calls, "/api/notifications/:id/read");
    await expect(readHandler!({ params: { id: "n1" }, sessionUser: { id: "u1" } } as never)).resolves.toEqual({ success: true });
    expect(markRead).toHaveBeenCalledWith({ id: "u1" }, "n1");

    const readAllHandler = findHandler(app.patch.mock.calls, "/api/notifications/read-all");
    await expect(readAllHandler!({ sessionUser: { id: "u1" } } as never)).resolves.toEqual({ success: true });
    expect(markAllRead).toHaveBeenCalledWith({ id: "u1" });
  });

  it("handles preferences list and upsert with payload validation", async () => {
    const app = createApp();
    listPreferences.mockResolvedValueOnce([{ id: "p1" }]);
    upsertPreference.mockResolvedValueOnce({ id: "p1", enabled: true });

    await registerNotificationRoutes(app as never);

    const listPrefs = findHandler(app.get.mock.calls, "/api/notifications/preferences");
    expect(await listPrefs!({ sessionUser: { id: "u1" } } as never)).toEqual([{ id: "p1" }]);

    const upsert = findHandler(app.put.mock.calls, "/api/notifications/preferences");
    await expect(
      upsert!({ body: { type: "BAD", channel: "EMAIL", enabled: true }, sessionUser: { id: "u1" } } as never)
    ).rejects.toThrow();

    const result = await upsert!(
      {
        body: { type: "HEARING_TODAY", channel: "IN_APP", enabled: true },
        sessionUser: { id: "u1" }
      } as never
    );

    expect(result).toEqual({ id: "p1", enabled: true });
  });
});
