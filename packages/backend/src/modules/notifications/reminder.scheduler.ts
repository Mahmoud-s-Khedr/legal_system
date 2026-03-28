/**
 * Reminder scheduler for local deployments.
 *
 * Call startReminderScheduler(env) once at server startup.
 */

import { NotificationType } from "@elms/shared";
import type { AppEnv } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { dispatchNotification } from "./notification.service.js";

// ── Shared scan logic ─────────────────────────────────────────────────────────

async function scanHearingReminders(env: AppEnv) {
  const now = new Date();

  for (const { days, type } of [
    { days: 7, type: NotificationType.HEARING_7_DAYS },
    { days: 1, type: NotificationType.HEARING_TOMORROW },
    { days: 0, type: NotificationType.HEARING_TODAY }
  ]) {
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() + days);
    windowStart.setHours(0, 0, 0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setHours(23, 59, 59, 999);

    const sessions = await prisma.caseSession.findMany({
      where: {
        sessionDatetime: { gte: windowStart, lte: windowEnd },
        case: { deletedAt: null }
      },
      include: {
        case: {
          select: {
            title: true,
            firmId: true,
            assignments: { where: { unassignedAt: null }, select: { userId: true } }
          }
        }
      }
    });

    for (const session of sessions) {
      const { firmId, assignments, title } = session.case;
      for (const { userId } of assignments) {
        await dispatchNotification(env, firmId, userId, type, { caseTitle: title });
      }
    }
  }
}

async function scanOverdueTasks(env: AppEnv) {
  const now = new Date();
  const overdueTasks = await prisma.task.findMany({
    where: {
      dueAt: { lt: now },
      status: { notIn: ["DONE", "CANCELLED"] },
      assignedToId: { not: null }
    },
    include: { case: { select: { firmId: true } } }
  });

  for (const task of overdueTasks) {
    const firmId = task.firmId ?? task.case?.firmId;
    if (!firmId || !task.assignedToId) continue;
    await dispatchNotification(env, firmId, task.assignedToId, NotificationType.TASK_OVERDUE, {
      taskTitle: task.title
    });
  }
}

/**
 * Daily overdue-task digest (Phase 6E).
 * For each user who has ≥1 overdue tasks, dispatch a single TASK_DAILY_DIGEST
 * notification instead of per-task TASK_OVERDUE spam.
 */
async function scanDailyTaskDigest(env: AppEnv) {
  const now = new Date();
  const overdueTasks = await prisma.task.findMany({
    where: {
      dueAt: { lt: now },
      status: { notIn: ["DONE", "CANCELLED"] },
      deletedAt: null,
      assignedToId: { not: null }
    },
    select: { firmId: true, assignedToId: true }
  });

  // Group by firmId + userId
  const byUser = new Map<string, { firmId: string; count: number }>();
  for (const task of overdueTasks) {
    if (!task.assignedToId) continue;
    const key = `${task.firmId}:${task.assignedToId}`;
    const existing = byUser.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byUser.set(key, { firmId: task.firmId, count: 1 });
    }
  }

  for (const [key, { firmId, count }] of byUser) {
    const userId = key.split(":")[1];
    await dispatchNotification(env, firmId, userId, NotificationType.TASK_DAILY_DIGEST, {
      count: String(count)
    });
  }
}

async function scanOverdueInvoices(env: AppEnv) {
  const now = new Date();
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      dueDate: { lt: now },
      status: { in: ["ISSUED", "PARTIALLY_PAID"] }
    },
    include: {
      firm: {
        select: {
          users: {
            where: { status: "ACTIVE", role: { key: "firm_admin" } },
            select: { id: true }
          }
        }
      }
    }
  });

  for (const invoice of overdueInvoices) {
    for (const admin of invoice.firm.users) {
      await dispatchNotification(env, invoice.firmId, admin.id, NotificationType.INVOICE_OVERDUE, {
        invoiceNumber: invoice.invoiceNumber
      });
    }
  }
}

// ── Desktop scheduler (node-cron) ─────────────────────────────────────────────

async function startDesktopScheduler(env: AppEnv) {
  const { default: cron } = await import("node-cron");

  // Run every day at 08:00
  cron.schedule("0 8 * * *", async () => {
    try {
      await scanHearingReminders(env);
      await scanOverdueTasks(env);
      await scanOverdueInvoices(env);
      await scanDailyTaskDigest(env);
    } catch (err) {
      console.error("[reminder-scheduler] error:", err);
    }
  });

  console.info("[reminder-scheduler] desktop cron scheduler started");
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function startReminderScheduler(env: AppEnv): Promise<void> {
  try {
    if (env.AUTH_MODE !== "local") {
      console.warn("[reminder-scheduler] cloud scheduler is deprecated; forcing local scheduler");
    }
    await startDesktopScheduler(env);
  } catch (err) {
    console.error("[reminder-scheduler] failed to start — notifications will not fire:", err);
  }
}
