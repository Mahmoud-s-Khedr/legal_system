import type { Prisma } from "@prisma/client";
import type { NotificationType as PrismaType } from "@prisma/client";

export async function sendInApp(
  tx: Prisma.TransactionClient,
  firmId: string,
  userId: string,
  type: PrismaType,
  title: string,
  body: string,
  target?: { entityType?: string | null; entityId?: string | null }
) {
  await tx.notification.create({
    data: {
      firmId,
      userId,
      type,
      title,
      body,
      entityType: target?.entityType ?? null,
      entityId: target?.entityId ?? null
    }
  });
}
