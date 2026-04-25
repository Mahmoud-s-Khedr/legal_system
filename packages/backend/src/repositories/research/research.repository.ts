import type { ResearchRole } from "@prisma/client";
import type { RepositoryTx } from "../types.js";

export async function createResearchSession(
  tx: RepositoryTx,
  input: {
    firmId: string;
    userId: string;
    caseId: string | null;
    title: string | null;
  }
) {
  return tx.researchSession.create({
    data: {
      firmId: input.firmId,
      userId: input.userId,
      caseId: input.caseId,
      title: input.title
    }
  });
}

export async function listResearchSessions(tx: RepositoryTx, firmId: string, userId: string) {
  return tx.researchSession.findMany({
    where: { firmId, userId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, caseId: true, createdAt: true, updatedAt: true }
  });
}

export async function getResearchSession(tx: RepositoryTx, firmId: string, sessionId: string) {
  return tx.researchSession.findFirst({
    where: { id: sessionId, firmId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { sources: { include: { document: true, article: true } } }
      }
    }
  });
}

export async function deleteResearchSession(
  tx: RepositoryTx,
  input: { firmId: string; userId: string; sessionId: string }
): Promise<number> {
  const deleted = await tx.researchSession.deleteMany({
    where: {
      id: input.sessionId,
      firmId: input.firmId,
      userId: input.userId
    }
  });
  return deleted.count;
}

export async function getFirmEditionKey(tx: RepositoryTx, firmId: string) {
  const firm = await tx.firm.findUniqueOrThrow({
    where: { id: firmId },
    select: { editionKey: true }
  });
  return firm.editionKey;
}

export async function countFirmUserResearchMessagesSince(
  tx: RepositoryTx,
  input: { firmId: string; startOfMonth: Date; role: ResearchRole }
): Promise<number> {
  return tx.researchMessage.count({
    where: {
      role: input.role,
      session: {
        firmId: input.firmId,
        createdAt: { gte: input.startOfMonth }
      }
    }
  });
}

export async function findResearchSessionForFirm(tx: RepositoryTx, firmId: string, sessionId: string) {
  return tx.researchSession.findFirst({
    where: { id: sessionId, firmId }
  });
}

export async function createResearchMessage(
  tx: RepositoryTx,
  input: { sessionId: string; role: ResearchRole; content: string }
) {
  return tx.researchMessage.create({
    data: {
      sessionId: input.sessionId,
      role: input.role,
      content: input.content
    }
  });
}

export async function listResearchMessages(tx: RepositoryTx, sessionId: string, take = 20) {
  return tx.researchMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take
  });
}

export async function createResearchSessionSources(
  tx: RepositoryTx,
  input: {
    sessionId: string;
    messageId: string;
    excerpts: Array<{ documentId: string; articleId: string | null }>;
  }
): Promise<void> {
  if (input.excerpts.length === 0) {
    return;
  }

  await tx.researchSessionSource.createMany({
    data: input.excerpts.map((excerpt) => ({
      sessionId: input.sessionId,
      messageId: input.messageId,
      documentId: excerpt.documentId,
      articleId: excerpt.articleId
    }))
  });
}

export async function touchResearchSession(tx: RepositoryTx, sessionId: string): Promise<void> {
  await tx.researchSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() }
  });
}
