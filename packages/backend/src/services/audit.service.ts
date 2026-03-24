import type { SessionUser } from "@elms/shared";
import type { Prisma, PrismaClient } from "@prisma/client";

export interface AuditContext {
  actor: SessionUser;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditEntryInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  oldData?: Prisma.InputJsonValue | null;
  newData?: Prisma.InputJsonValue | null;
}

export async function writeAuditLog(
  tx: Prisma.TransactionClient | PrismaClient,
  context: AuditContext,
  entry: AuditEntryInput
) {
  await tx.auditLog.create({
    data: {
      firmId: context.actor.firmId,
      userId: context.actor.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      oldData: entry.oldData ?? undefined,
      newData: entry.newData ?? undefined,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    }
  });
}

/**
 * Write an immutable READ audit log entry (Law No. 151/2020 compliance).
 * Call this whenever sensitive fields (national ID, financial data, Tawkeel)
 * are accessed and returned to the caller.
 */
export async function writeReadAuditLog(
  tx: Prisma.TransactionClient | PrismaClient,
  context: AuditContext,
  entityType: string,
  entityId: string
) {
  await tx.auditLog.create({
    data: {
      firmId: context.actor.firmId,
      userId: context.actor.id,
      action: "READ",
      entityType,
      entityId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    }
  });
}
