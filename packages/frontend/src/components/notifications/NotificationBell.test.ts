import { describe, expect, it } from "vitest";
import { NotificationType, type NotificationDto } from "@elms/shared";
import { resolveNotificationPath } from "./NotificationBell";

function makeNotification(type: NotificationType, entityId = "abc"): NotificationDto {
  return {
    id: "n1",
    firmId: "f1",
    userId: "u1",
    type,
    title: "t",
    body: "b",
    isRead: false,
    createdAt: new Date().toISOString(),
    entityId
  } as NotificationDto;
}

describe("resolveNotificationPath", () => {
  it("routes document and research notifications to library document detail", () => {
    expect(resolveNotificationPath(makeNotification(NotificationType.DOCUMENT_INDEXED))).toBe(
      "/app/library/documents/abc"
    );
    expect(resolveNotificationPath(makeNotification(NotificationType.RESEARCH_COMPLETE))).toBe(
      "/app/library/documents/abc"
    );
  });
});
