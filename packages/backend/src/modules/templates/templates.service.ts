import type { SessionUser } from "@elms/shared";
import { Language } from "@prisma/client";
import { writeAuditLog, type AuditContext } from "../../services/audit.service.js";
import { inTenantTransaction } from "../../repositories/unitOfWork.js";
import {
  createFirmTemplate,
  deleteFirmTemplateById,
  findTemplateWithCaseContext,
  findVisibleTemplateById,
  listVisibleTemplates,
  updateFirmTemplateById
} from "../../repositories/templates/templates.repository.js";

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
  /** Backward-compatible plain-text alias. */
  rendered: string;
  renderedHtml: string;
  renderedText: string;
  /** Substitution variables that were available in the case context */
  variables: Record<string, string>;
}

export type TemplateExportMode = "template" | "rendered";

export interface TemplateDocxExportResult {
  fileName: string;
  buffer: Buffer;
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
export function substitute(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return vars[key] ?? vars[key.toLowerCase()] ?? _match;
  });
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function ensureHtmlBody(content: string): string {
  if (looksLikeHtml(content)) {
    return content;
  }

  const lines = content.split(/\r?\n/);
  const blocks = lines.map((line) => (line.trim().length > 0 ? `<p>${escapeHtml(line)}</p>` : "<p><br/></p>"));
  return blocks.join("");
}

function decodeEntities(value: string): string {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

export function htmlToPlainText(content: string): string {
  const html = ensureHtmlBody(content)
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n")
    .replace(/<\s*\/div\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  return decodeEntities(html)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatDateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeFileName(value: string): string {
  const clean = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return clean.length > 0 ? clean : "template";
}

function resolveDocumentDirection(language: string): "rtl" | "ltr" {
  return language.toUpperCase() === "AR" ? "rtl" : "ltr";
}

async function htmlToDocxBuffer(content: string, language: string): Promise<Buffer> {
  const htmlBody = ensureHtmlBody(content);
  const dir = resolveDocumentDirection(language);

  const fullHtml = `<!DOCTYPE html>
<html lang="${language.toLowerCase()}" dir="${dir}">
  <head>
    <meta charset="UTF-8" />
    <style>
      body {
        direction: ${dir};
        font-family: ${dir === "rtl" ? "'Noto Naskh Arabic', 'Cairo', Arial, sans-serif" : "'Calibri', Arial, sans-serif"};
        line-height: 1.5;
        font-size: 12pt;
      }
      p { margin: 0 0 8pt 0; }
      h1, h2, h3, h4, h5, h6 { margin: 12pt 0 8pt; }
      [data-placeholder-key] {
        background: #ecfeff;
        border: 1px solid #a5f3fc;
        border-radius: 4px;
        padding: 1px 4px;
      }
    </style>
  </head>
  <body>${htmlBody}</body>
</html>`;

  const htmlToDocx = (await import("html-to-docx")).default as (
    htmlString: string,
    headerHtmlString?: string,
    documentOptions?: Record<string, unknown>
  ) => Promise<Buffer | ArrayBuffer | Uint8Array>;

  const result = await htmlToDocx(fullHtml, undefined, {
    pageSize: "A4"
  });

  if (Buffer.isBuffer(result)) {
    return result;
  }

  if (result instanceof Uint8Array) {
    return Buffer.from(result);
  }

  return Buffer.from(result);
}

async function getTemplateWithCaseContext(actor: SessionUser, templateId: string, caseId: string) {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const payload = await findTemplateWithCaseContext(tx, {
      firmId: actor.firmId,
      templateId,
      caseId
    });

    if (!payload) {
      return null;
    }

    const latestCourt = payload.caseRow.courts[0];
    const primaryLegalReference = payload.caseRow.legalReferences[0];
    const legalReferenceValue =
      primaryLegalReference?.article?.articleNumber &&
      primaryLegalReference.document?.title
        ? `${primaryLegalReference.document.title} § ${primaryLegalReference.article.articleNumber}`
        : primaryLegalReference?.document?.title ?? "";

    const variables: Record<string, string> = {
      caseName: payload.caseRow.title,
      caseNumber: payload.caseRow.caseNumber ?? "",
      legalReference: legalReferenceValue,
      internalReference: legalReferenceValue,
      clientName: payload.caseRow.client?.name ?? "",
      clientNameAr: payload.caseRow.client?.name ?? "",
      courtName: latestCourt?.courtName ?? "",
      courtLevel: latestCourt?.courtLevel ?? "",
      hearingDate: "",
      today: new Date().toLocaleDateString("ar-EG", { dateStyle: "long" }),
      todayEn: new Date().toLocaleDateString("en-GB", { dateStyle: "long" })
    };

    if (payload.nextHearing) {
      variables.hearingDate = payload.nextHearing.sessionDatetime.toLocaleDateString("ar-EG", {
        dateStyle: "long"
      });
    }

    return { template: payload.template, variables };
  });
}

export async function listTemplates(actor: SessionUser): Promise<TemplateDto[]> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const rows = await listVisibleTemplates(tx, actor.firmId);
    return rows.map(mapTemplate);
  });
}

export async function getTemplate(actor: SessionUser, templateId: string): Promise<TemplateDto | null> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const row = await findVisibleTemplateById(tx, actor.firmId, templateId);
    return row ? mapTemplate(row) : null;
  });
}

export async function createTemplate(
  actor: SessionUser,
  dto: CreateTemplateDto,
  audit: AuditContext
): Promise<TemplateDto> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const row = await createFirmTemplate(tx, {
      firmId: actor.firmId,
      name: dto.name,
      language: (dto.language as Language | undefined) ?? Language.AR,
      body: dto.body
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
  return inTenantTransaction(actor.firmId, async (tx) => {
    const existing = await findVisibleTemplateById(tx, actor.firmId, templateId);

    if (!existing || existing.isSystem) {
      return null;
    }

    const updateResult = await updateFirmTemplateById(tx, {
      firmId: actor.firmId,
      templateId,
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.language !== undefined && { language: dto.language as Language }),
        ...(dto.body !== undefined && { body: dto.body })
      }
    });

    if (updateResult === 0) {
      return null;
    }

    const updated = await findVisibleTemplateById(tx, actor.firmId, templateId);

    if (!updated || updated.isSystem) {
      return null;
    }

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
  return inTenantTransaction(actor.firmId, async (tx) => {
    const deleteResult = await deleteFirmTemplateById(tx, actor.firmId, templateId);

    if (deleteResult === 0) {
      return false;
    }

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
  const payload = await getTemplateWithCaseContext(actor, templateId, caseId);
  if (!payload) {
    return null;
  }

  const renderedHtml = substitute(payload.template.body, payload.variables);
  const renderedText = htmlToPlainText(renderedHtml);

  return {
    rendered: renderedText,
    renderedHtml,
    renderedText,
    variables: payload.variables
  };
}

export async function exportTemplateDocx(
  actor: SessionUser,
  templateId: string,
  mode: TemplateExportMode,
  caseId?: string
): Promise<TemplateDocxExportResult | null> {
  const template = await getTemplate(actor, templateId);
  if (!template) {
    return null;
  }

  const generatedAt = formatDateStamp();
  const safeTemplateName = sanitizeFileName(template.name);

  if (mode === "template") {
    const buffer = await htmlToDocxBuffer(template.body, template.language);
    return {
      fileName: `elms-template-${safeTemplateName}-${generatedAt}.docx`,
      buffer
    };
  }

  if (!caseId) {
    return null;
  }

  const renderResult = await renderTemplate(actor, templateId, caseId);
  if (!renderResult) {
    return null;
  }

  const safeCaseId = sanitizeFileName(caseId);
  const buffer = await htmlToDocxBuffer(renderResult.renderedHtml, template.language);

  return {
    fileName: `elms-document-${safeTemplateName}-${safeCaseId}-${generatedAt}.docx`,
    buffer
  };
}
