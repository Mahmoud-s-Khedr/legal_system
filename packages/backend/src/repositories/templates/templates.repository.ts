import type { Language, Prisma } from "@prisma/client";
import type { RepositoryTx } from "../types.js";

type TemplateRecord = {
  id: string;
  firmId: string | null;
  name: string;
  language: string;
  body: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export async function listVisibleTemplates(tx: RepositoryTx, firmId: string): Promise<TemplateRecord[]> {
  return tx.documentTemplate.findMany({
    where: { OR: [{ firmId }, { isSystem: true }] },
    orderBy: [{ isSystem: "asc" }, { name: "asc" }]
  });
}

export async function findVisibleTemplateById(
  tx: RepositoryTx,
  firmId: string,
  templateId: string
): Promise<TemplateRecord | null> {
  return tx.documentTemplate.findFirst({
    where: { id: templateId, OR: [{ firmId }, { isSystem: true }] }
  });
}

export async function createFirmTemplate(
  tx: RepositoryTx,
  input: { firmId: string; name: string; language: Language; body: string }
): Promise<TemplateRecord> {
  return tx.documentTemplate.create({
    data: {
      firmId: input.firmId,
      name: input.name,
      language: input.language,
      body: input.body,
      isSystem: false
    }
  });
}

export async function updateFirmTemplateById(
  tx: RepositoryTx,
  input: { firmId: string; templateId: string; data: Prisma.DocumentTemplateUpdateManyMutationInput }
): Promise<number> {
  const updated = await tx.documentTemplate.updateMany({
    where: { id: input.templateId, firmId: input.firmId, isSystem: false },
    data: input.data
  });
  return updated.count;
}

export async function deleteFirmTemplateById(tx: RepositoryTx, firmId: string, templateId: string): Promise<number> {
  const deleted = await tx.documentTemplate.deleteMany({
    where: { id: templateId, firmId, isSystem: false }
  });
  return deleted.count;
}

export async function findTemplateWithCaseContext(
  tx: RepositoryTx,
  input: { firmId: string; templateId: string; caseId: string }
): Promise<
  | {
      template: TemplateRecord;
      caseRow: {
        title: string;
        caseNumber: string;
        internalReference: string | null;
        client: { name: string } | null;
        courts: Array<{ courtName: string; courtLevel: string }>;
      };
      nextHearing: { sessionDatetime: Date } | null;
    }
  | null
> {
  const template = await findVisibleTemplateById(tx, input.firmId, input.templateId);
  if (!template) {
    return null;
  }

  const caseRow = await tx.case.findFirst({
    where: { id: input.caseId, firmId: input.firmId },
    include: {
      client: true,
      courts: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });

  if (!caseRow) {
    return null;
  }

  const nextHearing = await tx.caseSession.findFirst({
    where: {
      caseId: input.caseId,
      case: { firmId: input.firmId, deletedAt: null },
      sessionDatetime: { gte: new Date() }
    },
    orderBy: { sessionDatetime: "asc" }
  });

  return {
    template,
    caseRow: {
      title: caseRow.title,
      caseNumber: caseRow.caseNumber,
      internalReference: caseRow.internalReference,
      client: caseRow.client,
      courts: caseRow.courts.map((court) => ({ courtName: court.courtName, courtLevel: court.courtLevel }))
    },
    nextHearing: nextHearing ? { sessionDatetime: nextHearing.sessionDatetime } : null
  };
}
