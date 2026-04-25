import { prisma } from "../../db/prisma.js";

export async function findGoogleCalendarTokenByUserId(userId: string) {
  return prisma.googleCalendarToken.findUnique({ where: { userId } });
}

export async function updateGoogleCalendarTokenAccess(
  input: { userId: string; firmId: string; encryptedAccessToken: string; expiresAt: Date }
): Promise<void> {
  await prisma.googleCalendarToken.updateMany({
    where: { userId: input.userId, firmId: input.firmId },
    data: {
      encryptedAccessToken: input.encryptedAccessToken,
      expiresAt: input.expiresAt
    }
  });
}

export async function findFirmEditionByIdOrThrow(firmId: string) {
  const firm = await prisma.firm.findUniqueOrThrow({
    where: { id: firmId },
    select: { editionKey: true }
  });
  return firm.editionKey;
}

export async function upsertGoogleCalendarToken(
  input: {
    userId: string;
    firmId: string;
    encryptedAccessToken: string;
    encryptedRefreshToken: string;
    expiresAt: Date;
    scope: string;
  }
): Promise<void> {
  await prisma.googleCalendarToken.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      firmId: input.firmId,
      encryptedAccessToken: input.encryptedAccessToken,
      encryptedRefreshToken: input.encryptedRefreshToken,
      expiresAt: input.expiresAt,
      scope: input.scope
    },
    update: {
      encryptedAccessToken: input.encryptedAccessToken,
      encryptedRefreshToken: input.encryptedRefreshToken,
      expiresAt: input.expiresAt,
      scope: input.scope
    }
  });
}

export async function deleteGoogleCalendarTokenByUserAndFirm(userId: string, firmId: string): Promise<void> {
  await prisma.googleCalendarToken.deleteMany({ where: { userId, firmId } });
}

export async function findCaseSessionWithCaseById(hearingId: string) {
  return prisma.caseSession.findUnique({
    where: { id: hearingId },
    include: { case: { select: { title: true, caseNumber: true } } }
  });
}

export async function findCaseSessionById(hearingId: string) {
  return prisma.caseSession.findUnique({ where: { id: hearingId } });
}

export async function updateCaseSessionGoogleCalendarEventId(
  hearingId: string,
  googleCalendarEventId: string | null
): Promise<void> {
  await prisma.caseSession.update({
    where: { id: hearingId },
    data: { googleCalendarEventId }
  });
}
