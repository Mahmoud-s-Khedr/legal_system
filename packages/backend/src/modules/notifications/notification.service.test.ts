import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditionKey, NotificationType } from "@elms/shared";
import { makeSessionUser } from "../../test-utils/session-user.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNotification = {
  findMany: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn()
};
const mockNotificationPreference = {
  findMany: vi.fn(),
  upsert: vi.fn()
};
const mockFirm = { findUniqueOrThrow: vi.fn() };
const mockUser = { findUnique: vi.fn() };

const mockPrisma = {
  notification: mockNotification,
  notificationPreference: mockNotificationPreference,
  firm: mockFirm,
  user: mockUser
};

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn((_prisma: unknown, _firmId: string, fn: (tx: typeof mockPrisma) => unknown) =>
    fn(mockPrisma)
  )
}));
vi.mock("../editions/editionPolicy.js", () => ({
  hasEditionFeature: vi.fn().mockReturnValue(false)
}));
vi.mock("./channels/inApp.js", () => ({ sendInApp: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./channels/email.js", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./channels/sms.js", () => ({ sendSms: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./channels/desktopOs.js", () => ({ sendDesktopOs: vi.fn().mockResolvedValue(undefined) }));

const {
  buildNotificationContent,
  dispatchNotification,
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead
} = await import("./notification.service.js");

const { hasEditionFeature } = await import("../editions/editionPolicy.js");
const { sendInApp } = await import("./channels/inApp.js");
const { sendEmail } = await import("./channels/email.js");
const { sendSms } = await import("./channels/sms.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

const actor = makeSessionUser({
  roleKey: "senior_lawyer",
  email: "lawyer@elms.test",
  fullName: "Lawyer",
  editionKey: EditionKey.SOLO_ONLINE
});

const mockEnv = { NODE_ENV: "test" } as never;
const now = new Date("2026-03-21T00:00:00.000Z");

function makeNotificationRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "notif-1",
    firmId: "firm-1",
    userId: "user-1",
    type: "HEARING_TOMORROW",
    title: "جلسة غداً",
    body: "لديك جلسة غداً في قضية: قضية 1",
    isRead: false,
    createdAt: now,
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(hasEditionFeature).mockReturnValue(false);
});

// ── buildNotificationContent ───────────────────────────────────────────────────

describe("buildNotificationContent", () => {
  it("builds correct content for HEARING_7_DAYS", () => {
    const result = buildNotificationContent(NotificationType.HEARING_7_DAYS, { caseTitle: "Case A" });
    expect(result.title).toBeTruthy();
    expect(result.body).toContain("Case A");
  });

  it("builds correct content for HEARING_TOMORROW", () => {
    const result = buildNotificationContent(NotificationType.HEARING_TOMORROW, { caseTitle: "Case B" });
    expect(result.title).toBeTruthy();
    expect(result.body).toContain("Case B");
  });

  it("builds correct content for TASK_OVERDUE", () => {
    const result = buildNotificationContent(NotificationType.TASK_OVERDUE, { taskTitle: "Review contract" });
    expect(result.body).toContain("Review contract");
  });

  it("builds correct content for INVOICE_OVERDUE", () => {
    const result = buildNotificationContent(NotificationType.INVOICE_OVERDUE, { invoiceNumber: "INV-2026-0001" });
    expect(result.body).toContain("INV-2026-0001");
  });

  it("builds correct content for DOCUMENT_INDEXED", () => {
    const result = buildNotificationContent(NotificationType.DOCUMENT_INDEXED, { documentTitle: "Contract.pdf" });
    expect(result.body).toContain("Contract.pdf");
  });

  it("returns generic content for RESEARCH_COMPLETE", () => {
    const result = buildNotificationContent(NotificationType.RESEARCH_COMPLETE, {});
    expect(result.title).toBeTruthy();
    expect(result.body).toBeTruthy();
  });
});

// ── dispatchNotification ───────────────────────────────────────────────────────

describe("dispatchNotification", () => {
  it("defaults to IN_APP channel when no preferences configured", async () => {
    mockNotificationPreference.findMany.mockResolvedValue([]); // no preferences
    mockFirm.findUniqueOrThrow.mockResolvedValue({ editionKey: EditionKey.SOLO_ONLINE });

    await dispatchNotification(mockEnv, "firm-1", "user-1", NotificationType.HEARING_TOMORROW, { caseTitle: "Case A" });

    expect(sendInApp).toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("sends EMAIL only when preference is set and edition supports it", async () => {
    mockNotificationPreference.findMany.mockResolvedValue([
      { channel: "EMAIL", type: "HEARING_TOMORROW", enabled: true }
    ]);
    mockFirm.findUniqueOrThrow.mockResolvedValue({ editionKey: EditionKey.SOLO_ONLINE });
    vi.mocked(hasEditionFeature).mockImplementation((_key, feature) => feature === "email_reminders");
    mockUser.findUnique.mockResolvedValue({ email: "lawyer@elms.test", phone: null });

    await dispatchNotification(mockEnv, "firm-1", "user-1", NotificationType.HEARING_TOMORROW, { caseTitle: "Case A" });

    expect(sendEmail).toHaveBeenCalledWith(mockEnv, "lawyer@elms.test", expect.any(String), expect.any(String));
    expect(sendInApp).not.toHaveBeenCalled();
  });

  it("does not send EMAIL on offline editions even if preference is set", async () => {
    mockNotificationPreference.findMany.mockResolvedValue([
      { channel: "EMAIL", type: "HEARING_TOMORROW", enabled: true }
    ]);
    mockFirm.findUniqueOrThrow.mockResolvedValue({ editionKey: EditionKey.SOLO_OFFLINE });
    vi.mocked(hasEditionFeature).mockReturnValue(false); // offline: no email

    await dispatchNotification(mockEnv, "firm-1", "user-1", NotificationType.HEARING_TOMORROW, { caseTitle: "X" });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not send SMS without user phone number", async () => {
    mockNotificationPreference.findMany.mockResolvedValue([
      { channel: "SMS", type: "HEARING_TODAY", enabled: true }
    ]);
    mockFirm.findUniqueOrThrow.mockResolvedValue({ editionKey: EditionKey.SOLO_ONLINE });
    vi.mocked(hasEditionFeature).mockImplementation((_key, feature) => feature === "sms_reminders");
    mockUser.findUnique.mockResolvedValue({ email: null, phone: null }); // no phone

    await dispatchNotification(mockEnv, "firm-1", "user-1", NotificationType.HEARING_TODAY, { caseTitle: "X" });

    expect(sendSms).not.toHaveBeenCalled();
  });
});

// ── listNotifications ──────────────────────────────────────────────────────────

describe("listNotifications", () => {
  it("returns notifications scoped to actor", async () => {
    mockNotification.count.mockResolvedValue(1);
    mockNotification.findMany.mockResolvedValue([makeNotificationRecord()]);

    const result = await listNotifications(actor, { page: 1, limit: 20 });

    expect(mockNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ firmId: "firm-1", userId: "user-1" })
      })
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].isRead).toBe(false);
  });
});

// ── getUnreadCount ─────────────────────────────────────────────────────────────

describe("getUnreadCount", () => {
  it("counts only unread notifications for the actor", async () => {
    mockNotification.count.mockResolvedValue(3);

    const count = await getUnreadCount(actor);

    expect(count).toBe(3);
    expect(mockNotification.count).toHaveBeenCalledWith({
      where: { firmId: "firm-1", userId: "user-1", isRead: false }
    });
  });
});

// ── markRead / markAllRead ─────────────────────────────────────────────────────

describe("markRead", () => {
  it("marks notification as read scoped to actor", async () => {
    mockNotification.updateMany = vi.fn().mockResolvedValue({ count: 1 });

    await markRead(actor, "notif-1");

    expect(mockNotification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "notif-1", firmId: "firm-1", userId: "user-1" }),
        data: expect.objectContaining({ isRead: true })
      })
    );
  });
});

describe("markAllRead", () => {
  it("marks all notifications as read for actor", async () => {
    mockNotification.updateMany = vi.fn().mockResolvedValue({ count: 5 });

    await markAllRead(actor);

    expect(mockNotification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ firmId: "firm-1", userId: "user-1" }),
        data: expect.objectContaining({ isRead: true })
      })
    );
  });
});
