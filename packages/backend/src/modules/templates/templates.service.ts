import type { SessionUser } from "@elms/shared";
import { Language } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { withTenant } from "../../db/tenant.js";
import { writeAuditLog, type AuditContext } from "../../services/audit.service.js";

export interface TemplateDto {
  id: string;
  firmId: string | null;
  name: string;
  language: string;
  body: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateDto {
  name: string;
  language?: string;
  body: string;
}

export interface UpdateTemplateDto {
  name?: string;
  language?: string;
  body?: string;
}

export interface RenderResultDto {
  rendered: string;
  /** Substitution variables that were available in the case context */
  variables: Record<string, string>;
}

function mapTemplate(t: {
  id: string;
  firmId: string | null;
  name: string;
  language: string;
  body: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}): TemplateDto {
  return {
    id: t.id,
    firmId: t.firmId,
    name: t.name,
    language: t.language,
    body: t.body,
    isSystem: t.isSystem,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString()
  };
}

/** Replace `{{key}}` tokens with values from the substitution map (case-insensitive key match). */
function substitute(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return vars[key] ?? vars[key.toLowerCase()] ?? _match;
  });
}

export async function listTemplates(actor: SessionUser): Promise<TemplateDto[]> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const rows = await tx.documentTemplate.findMany({
      where: { OR: [{ firmId: actor.firmId }, { isSystem: true }] },
      orderBy: [{ isSystem: "asc" }, { name: "asc" }]
    });
    return rows.map(mapTemplate);
  });
}

export async function getTemplate(actor: SessionUser, templateId: string): Promise<TemplateDto | null> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const row = await tx.documentTemplate.findFirst({
      where: { id: templateId, OR: [{ firmId: actor.firmId }, { isSystem: true }] }
    });
    return row ? mapTemplate(row) : null;
  });
}

export async function createTemplate(
  actor: SessionUser,
  dto: CreateTemplateDto,
  audit: AuditContext
): Promise<TemplateDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const row = await tx.documentTemplate.create({
      data: {
        firmId: actor.firmId,
        name: dto.name,
        language: (dto.language as Language | undefined) ?? Language.AR,
        body: dto.body,
        isSystem: false
      }
    });

    await writeAuditLog(tx, audit, {
      action: "CREATE",
      entityType: "DocumentTemplate",
      entityId: row.id
    });

    return mapTemplate(row);
  });
}

export async function updateTemplate(
  actor: SessionUser,
  templateId: string,
  dto: UpdateTemplateDto,
  audit: AuditContext
): Promise<TemplateDto | null> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.documentTemplate.findFirst({
      where: { id: templateId, firmId: actor.firmId, isSystem: false }
    });

    if (!existing) {
      return null;
    }

    const updated = await tx.documentTemplate.update({
      where: { id: templateId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.language !== undefined && { language: dto.language as Language }),
        ...(dto.body !== undefined && { body: dto.body })
      }
    });

    await writeAuditLog(tx, audit, {
      action: "UPDATE",
      entityType: "DocumentTemplate",
      entityId: templateId
    });

    return mapTemplate(updated);
  });
}

export async function deleteTemplate(
  actor: SessionUser,
  templateId: string,
  audit: AuditContext
): Promise<boolean> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.documentTemplate.findFirst({
      where: { id: templateId, firmId: actor.firmId, isSystem: false }
    });

    if (!existing) {
      return false;
    }

    await tx.documentTemplate.delete({ where: { id: templateId } });

    await writeAuditLog(tx, audit, {
      action: "DELETE",
      entityType: "DocumentTemplate",
      entityId: templateId
    });

    return true;
  });
}

export async function renderTemplate(
  actor: SessionUser,
  templateId: string,
  caseId: string
): Promise<RenderResultDto | null> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const template = await tx.documentTemplate.findFirst({
      where: { id: templateId, OR: [{ firmId: actor.firmId }, { isSystem: true }] }
    });

    if (!template) {
      return null;
    }

    const caseRow = await tx.case.findFirst({
      where: { id: caseId, firmId: actor.firmId },
      include: {
        client: true,
        courts: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    });

    if (!caseRow) {
      return null;
    }

    const latestCourt = caseRow.courts[0];

    const variables: Record<string, string> = {
      caseName: caseRow.title,
      caseNumber: caseRow.caseNumber ?? "",
      internalReference: caseRow.internalReference ?? "",
      clientName: caseRow.client?.name ?? "",
      clientNameAr: caseRow.client?.name ?? "",
      courtName: latestCourt?.courtName ?? "",
      courtLevel: latestCourt?.courtLevel ?? "",
      hearingDate: "",
      today: new Date().toLocaleDateString("ar-EG", { dateStyle: "long" }),
      todayEn: new Date().toLocaleDateString("en-GB", { dateStyle: "long" })
    };

    // Attach next hearing date if available
    const nextHearing = await tx.caseSession.findFirst({
      where: { caseId, case: { firmId: actor.firmId, deletedAt: null }, sessionDatetime: { gte: new Date() } },
      orderBy: { sessionDatetime: "asc" }
    });

    if (nextHearing) {
      variables.hearingDate = nextHearing.sessionDatetime.toLocaleDateString("ar-EG", {
        dateStyle: "long"
      });
    }

    const rendered = substitute(template.body, variables);

    return { rendered, variables };
  });
}
