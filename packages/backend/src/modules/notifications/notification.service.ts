import type {
  NotificationDto,
  NotificationListResponseDto,
  NotificationPreferenceDto,
  SessionUser,
  UpsertPreferenceDto
} from "@elms/shared";
import { NotificationChannel, NotificationType } from "@elms/shared";
import type {
  NotificationChannel as PrismaChannel,
  NotificationType as PrismaType
} from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { withTenant } from "../../db/tenant.js";
import type { AppEnv } from "../../config/env.js";
import { sendInApp } from "./channels/inApp.js";
import { sendEmail } from "./channels/email.js";
import { sendSms } from "./channels/sms.js";
import { sendDesktopOs } from "./channels/desktopOs.js";
import { hasEditionFeature } from "../editions/editionPolicy.js";
import { normalizeSort, toPrismaSortOrder, type SortDir } from "../../utils/tableQuery.js";

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapNotification(n: {
  id: string;
  firmId: string;
  userId: string;
  type: PrismaType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
}): NotificationDto {
  return {
    id: n.id,
    firmId: n.firmId,
    userId: n.userId,
    type: n.type as NotificationType,
    title: n.title,
    body: n.body,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString()
  };
}

function mapPreference(p: {
  id: string;
  userId: string;
  type: PrismaType;
  channel: PrismaChannel;
  enabled: boolean;
}): NotificationPreferenceDto {
  return {
    id: p.id,
    userId: p.userId,
    type: p.type as NotificationType,
    channel: p.channel as NotificationChannel,
    enabled: p.enabled
  };
}

// ── Notification title/body helpers ──────────────────────────────────────────

export function buildNotificationContent(
  type: NotificationType,
  payload: Record<string, string>
): { title: string; body: string } {
  switch (type) {
    case NotificationType.HEARING_7_DAYS:
      return { title: "جلسة خلال 7 أيام", body: `لديك جلسة في قضية: ${payload.caseTitle ?? ""}` };
    case NotificationType.HEARING_TOMORROW:
      return { title: "جلسة غداً", body: `لديك جلسة غداً في قضية: ${payload.caseTitle ?? ""}` };
    case NotificationType.HEARING_TODAY:
      return { title: "جلسة اليوم", body: `لديك جلسة اليوم في قضية: ${payload.caseTitle ?? ""}` };
    case NotificationType.TASK_OVERDUE:
      return { title: "مهمة متأخرة", body: `المهمة "${payload.taskTitle ?? ""}" متأخرة` };
    case NotificationType.INVOICE_OVERDUE:
      return { title: "فاتورة متأخرة", body: `الفاتورة ${payload.invoiceNumber ?? ""} متأخرة السداد` };
    case NotificationType.DOCUMENT_INDEXED:
      return { title: "مستند جاهز للبحث", body: `تم فهرسة: ${payload.documentTitle ?? ""}` };
    case NotificationType.RESEARCH_COMPLETE:
      return { title: "بحث مكتمل", body: "جلسة البحث القانوني اكتملت" };
    case NotificationType.TASK_DAILY_DIGEST:
      return {
        title: "ملخص المهام المتأخرة",
        body: `لديك ${payload.count ?? "عدة"} مهام متأخرة تستحق الاهتمام`
      };
    case NotificationType.CHEQUE_MATURITY_DUE:
      return {
        title: "شيك قريب من الاستحقاق",
        body: `الشيك رقم ${payload.chequeNumber ?? ""} يستحق خلال 3 أيام`
      };
    case NotificationType.PORTAL_APPOINTMENT_REQUEST:
      return {
        title: "طلب موعد جديد",
        body: `العميل ${payload.clientName ?? ""} يطلب موعداً`
      };
    default:
      return { title: "إشعار", body: "" };
  }
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

export async function dispatchNotification(
  env: AppEnv,
  firmId: string,
  userId: string,
  type: NotificationType,
  payload: Record<string, string> = {}
): Promise<void> {
  const content = buildNotificationContent(type, payload);

  // Fetch enabled preferences for this user and notification type
  const preferences = await prisma.notificationPreference.findMany({
    where: { userId, type: type as PrismaType, enabled: true }
  });

  // If no preferences configured yet, default to in-app only
  const channels: NotificationChannel[] =
    preferences.length > 0
      ? preferences.map((p) => p.channel as NotificationChannel)
      : [NotificationChannel.IN_APP];

  const firm = await prisma.firm.findUniqueOrThrow({
    where: { id: firmId },
    select: { editionKey: true }
  });
  const supportedChannels = channels.filter((channel) => {
    if (channel === NotificationChannel.EMAIL) {
      return hasEditionFeature(firm.editionKey, "email_reminders");
    }
    if (channel === NotificationChannel.SMS) {
      return hasEditionFeature(firm.editionKey, "sms_reminders");
    }
    return true;
  });

  // Fetch user email if needed
  let userEmail: string | null = null;
  let userPhone: string | null = null;
  if (
    supportedChannels.includes(NotificationChannel.EMAIL) ||
    supportedChannels.includes(NotificationChannel.SMS)
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, phone: true } });
    userEmail = user?.email ?? null;
    userPhone = (user as { phone?: string | null } | null)?.phone ?? null;
  }

  await withTenant(prisma, firmId, async (tx) => {
    if (supportedChannels.includes(NotificationChannel.IN_APP)) {
      await sendInApp(tx, firmId, userId, type as PrismaType, content.title, content.body);
    }
  });

  if (supportedChannels.includes(NotificationChannel.EMAIL) && userEmail) {
    await sendEmail(env, userEmail, content.title, `<p>${content.body}</p>`);
  }

  if (supportedChannels.includes(NotificationChannel.SMS) && userPhone) {
    await sendSms(env, userPhone, `${content.title}: ${content.body}`);
  }

  if (supportedChannels.includes(NotificationChannel.DESKTOP_OS)) {
    await sendDesktopOs(env, userId, content.title, content.body);
  }
}

// ── List / mark-read ──────────────────────────────────────────────────────────

export async function listNotifications(
  actor: SessionUser,
  query: {
    q?: string;
    type?: string;
    isRead?: string;
    sortBy?: string;
    sortDir?: SortDir;
    page?: number;
    limit?: number;
  } = { page: 1, limit: 50 }
): Promise<NotificationListResponseDto> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 50;
  const q = query.q?.trim();
  const sortBy = normalizeSort(query.sortBy, ["createdAt", "type", "title", "isRead"] as const, "createdAt");
  const sortDir = toPrismaSortOrder(query.sortDir ?? "desc");
  const where = {
    firmId: actor.firmId,
    userId: actor.id,
    ...(query.type ? { type: query.type as PrismaType } : {}),
    ...(query.isRead === "true" ? { isRead: true } : {}),
    ...(query.isRead === "false" ? { isRead: false } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { body: { contains: q, mode: "insensitive" as const } }
          ]
        }
      : {})
  };
  const orderBy =
    query.sortBy === undefined
      ? [{ isRead: "asc" as const }, { createdAt: "desc" as const }]
      : sortBy === "isRead"
        ? [{ isRead: sortDir }, { createdAt: "desc" as const }]
        : { [sortBy]: sortDir };
  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.notification.count({ where })
  ]);
  return { items: items.map(mapNotification), total, page, pageSize: limit };
}

export async function getUnreadCount(actor: SessionUser): Promise<number> {
  return prisma.notification.count({ where: { firmId: actor.firmId, userId: actor.id, isRead: false } });
}

export async function markRead(actor: SessionUser, notificationId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, firmId: actor.firmId, userId: actor.id },
    data: { isRead: true }
  });
}

export async function markAllRead(actor: SessionUser): Promise<void> {
  await prisma.notification.updateMany({
    where: { firmId: actor.firmId, userId: actor.id, isRead: false },
    data: { isRead: true }
  });
}

// ── Preferences ───────────────────────────────────────────────────────────────

export async function listPreferences(actor: SessionUser): Promise<NotificationPreferenceDto[]> {
  const prefs = await prisma.notificationPreference.findMany({
    where: { userId: actor.id }
  });
  return prefs.map(mapPreference);
}

export async function upsertPreference(
  actor: SessionUser,
  dto: UpsertPreferenceDto
): Promise<NotificationPreferenceDto> {
  if (
    dto.channel === NotificationChannel.EMAIL &&
    !hasEditionFeature(actor.editionKey, "email_reminders")
  ) {
    const error = new Error("Email reminders are not available for current edition") as Error & {
      statusCode: number;
    };
    error.statusCode = 403;
    throw error;
  }

  if (
    dto.channel === NotificationChannel.SMS &&
    !hasEditionFeature(actor.editionKey, "sms_reminders")
  ) {
    const error = new Error("SMS reminders are not available for current edition") as Error & {
      statusCode: number;
    };
    error.statusCode = 403;
    throw error;
  }

  // WHATSAPP channel is planned for Phase 13 — gate it now so enabling it early
  // on unsupported editions returns a clear 403.
  if (
    (dto.channel as string) === "WHATSAPP" &&
    !hasEditionFeature(actor.editionKey, "whatsapp_notifications")
  ) {
    const error = new Error(
      "WhatsApp notifications are not available for current edition"
    ) as Error & { statusCode: number };
    error.statusCode = 403;
    throw error;
  }

  const pref = await prisma.notificationPreference.upsert({
    where: {
      userId_type_channel: {
        userId: actor.id,
        type: dto.type as PrismaType,
        channel: dto.channel as PrismaChannel
      }
    },
    update: { enabled: dto.enabled },
    create: {
      userId: actor.id,
      type: dto.type as PrismaType,
      channel: dto.channel as PrismaChannel,
      enabled: dto.enabled
    }
  });
  return mapPreference(pref);
}
