/**
 * Bulk import service for clients and cases.
 *
 * Supports CSV and XLSX input. Each import has two phases:
 *   1. preview — parse + validate rows, return per-row errors, no DB writes
 *   2. execute — run validated rows in a transaction, partial failure allowed
 */
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import type { SessionUser } from "@elms/shared";
import { writeAuditLog } from "../../services/audit.service.js";
import { applyArrayTableQuery, normalizeSort, type SortDir } from "../../utils/tableQuery.js";
import { createTableSession, getTableSession } from "../../utils/tableSessionStore.js";

// ─── Row types ────────────────────────────────────────────────────────────────

export interface ParsedRow {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
}

export interface ImportPreviewResult {
  previewId: string;
  total: number;
  valid: number;
  invalid: number;
  expiresAt: string;
}

export interface ImportExecuteResult {
  imported: number;
  failed: number;
  errors: Array<{ rowNumber: number; error: string }>;
}

export interface ImportPreviewRowQueryResult {
  items: ParsedRow[];
  total: number;
  page: number;
  pageSize: number;
  expiresAt: string;
}

// ─── Validation schemas ───────────────────────────────────────────────────────

const clientRowSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["INDIVIDUAL", "COMPANY", "GOVERNMENT"]).default("INDIVIDUAL"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  nationalId: z.string().optional(),
  commercialRegister: z.string().optional(),
  taxNumber: z.string().optional(),
  governorate: z.string().optional()
});

const caseRowSchema = z.object({
  title: z.string().min(1, "Title is required"),
  caseNumber: z.string().min(1, "Case number is required"),
  type: z.string().default("CIVIL"),
  status: z.enum(["ACTIVE", "SUSPENDED", "CLOSED", "WON", "LOST", "SETTLED", "ARCHIVED"]).default("ACTIVE"),
  judicialYear: z.string().optional()
});

// ─── CSV parser ───────────────────────────────────────────────────────────────

async function parseCSV(buffer: Buffer): Promise<Array<Record<string, string>>> {
  const rl = createInterface({ input: Readable.from(buffer), crlfDelay: Infinity });
  const lines: string[] = [];
  for await (const line of rl) {
    lines.push(line);
  }
  if (lines.length < 2) return [];

  // Simple CSV split — handles quoted fields
  function splitCSVLine(line: string): string[] {
    const result: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === "," && !inQuote) {
        result.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  }

  const headers = splitCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = splitCSVLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

// ─── XLSX parser ──────────────────────────────────────────────────────────────

async function parseXLSX(buffer: Buffer): Promise<Array<Record<string, string>>> {
  const workbook = new ExcelJS.Workbook();
  const excelBuffer = buffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(excelBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell) => {
    headers.push(String(cell.value ?? "").toLowerCase().replace(/\s+/g, "_"));
  });

  const rows: Array<Record<string, string>> = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = String(row.getCell(i + 1).value ?? "").trim();
    });
    rows.push(obj);
  });
  return rows;
}

// ─── Parse buffer by MIME type ────────────────────────────────────────────────

async function parseFile(buffer: Buffer, mimeType: string): Promise<Array<Record<string, string>>> {
  if (mimeType === "text/csv" || mimeType === "application/csv") {
    return parseCSV(buffer);
  }
  // XLSX (and fallback)
  return parseXLSX(buffer);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bufferFromStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

function previewOwnerKey(actor: SessionUser) {
  return `${actor.firmId}:${actor.id}`;
}

// ─── Client import ────────────────────────────────────────────────────────────

export async function previewClientImport(
  stream: NodeJS.ReadableStream,
  mimeType: string,
  actor: SessionUser
): Promise<ImportPreviewResult> {
  const buffer = await bufferFromStream(stream);
  const rawRows = await parseFile(buffer, mimeType);

  const rows: ParsedRow[] = rawRows.map((raw, idx) => {
    const result = clientRowSchema.safeParse(raw);
    return {
      rowNumber: idx + 2,
      data: raw,
      errors: result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    };
  });

  const valid = rows.filter((r) => r.errors.length === 0).length;
  const session = createTableSession("import_preview", previewOwnerKey(actor), rows, {
    meta: { entityType: "clients" }
  });
  return {
    previewId: session.id,
    total: rows.length,
    valid,
    invalid: rows.length - valid,
    expiresAt: session.expiresAt
  };
}

export async function executeClientImport(
  stream: NodeJS.ReadableStream,
  mimeType: string,
  actor: SessionUser,
  auditCtx: { ipAddress?: string; userAgent?: string }
): Promise<ImportExecuteResult> {
  const buffer = await bufferFromStream(stream);
  const rawRows = await parseFile(buffer, mimeType);

  let imported = 0;
  const errors: ImportExecuteResult["errors"] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const rowNumber = i + 2;
    const result = clientRowSchema.safeParse(rawRows[i]);
    if (!result.success) {
      errors.push({ rowNumber, error: result.error.issues.map((issue) => issue.message).join("; ") });
      continue;
    }

    try {
      const d = result.data;
      const client = await prisma.client.create({
        data: {
          firmId: actor.firmId,
          name: d.name,
          type: d.type,
          phone: d.phone || null,
          email: d.email || null,
          nationalId: d.nationalId || null,
          commercialRegister: d.commercialRegister || null,
          taxNumber: d.taxNumber || null,
          governorate: d.governorate || null
        }
      });
      await writeAuditLog(prisma, { actor, ipAddress: auditCtx.ipAddress, userAgent: auditCtx.userAgent }, {
        action: "clients.bulk_import",
        entityType: "Client",
        entityId: client.id
      });
      imported++;
    } catch (err) {
      errors.push({ rowNumber, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return { imported, failed: errors.length, errors };
}

// ─── Case import ──────────────────────────────────────────────────────────────

export async function previewCaseImport(
  stream: NodeJS.ReadableStream,
  mimeType: string,
  actor: SessionUser
): Promise<ImportPreviewResult> {
  const buffer = await bufferFromStream(stream);
  const rawRows = await parseFile(buffer, mimeType);

  const rows: ParsedRow[] = rawRows.map((raw, idx) => {
    const result = caseRowSchema.safeParse(raw);
    return {
      rowNumber: idx + 2,
      data: raw,
      errors: result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    };
  });

  const valid = rows.filter((r) => r.errors.length === 0).length;
  const session = createTableSession("import_preview", previewOwnerKey(actor), rows, {
    meta: { entityType: "cases" }
  });
  return {
    previewId: session.id,
    total: rows.length,
    valid,
    invalid: rows.length - valid,
    expiresAt: session.expiresAt
  };
}

export function listImportPreviewRows(
  actor: SessionUser,
  previewId: string,
  query: {
    q?: string;
    status?: "valid" | "invalid";
    sortBy?: string;
    sortDir?: SortDir;
    page: number;
    limit: number;
  }
): ImportPreviewRowQueryResult | null {
  const session = getTableSession<ParsedRow>("import_preview", previewOwnerKey(actor), previewId);
  if (!session) {
    return null;
  }

  const rows = session.rows;
  const normalized = rows.map((row) => ({
    rowNumber: row.rowNumber,
    status: row.errors.length > 0 ? "invalid" : "valid",
    errorsText: row.errors.join("; "),
    ...row.data,
    __row: row
  })) as Array<Record<string, unknown> & { __row: ParsedRow; status: "valid" | "invalid" }>;

  const filteredByStatus =
    query.status === undefined
      ? normalized
      : normalized.filter((row) => row.status === query.status);

  const sortableColumns = Object.keys(filteredByStatus[0] ?? {}).filter((key) => key !== "__row");
  const sortBy = normalizeSort(
    query.sortBy,
    sortableColumns.length > 0 ? (sortableColumns as readonly string[]) : (["rowNumber"] as const),
    "rowNumber"
  ) as keyof (typeof filteredByStatus)[number];
  const searchFields = (sortableColumns.length > 0 ? sortableColumns : ["rowNumber"]) as Array<keyof (typeof filteredByStatus)[number]>;
  const result = applyArrayTableQuery(filteredByStatus, {
    q: query.q,
    searchFields,
    sortBy,
    sortDir: query.sortDir ?? "asc",
    page: query.page,
    limit: query.limit
  });

  return {
    items: result.items.map((row) => row.__row),
    total: result.total,
    page: query.page,
    pageSize: query.limit,
    expiresAt: new Date(session.expiresAt).toISOString()
  };
}

export async function executeClientImportPreview(
  actor: SessionUser,
  previewId: string,
  auditCtx: { ipAddress?: string; userAgent?: string }
): Promise<ImportExecuteResult | null> {
  const session = getTableSession<ParsedRow>("import_preview", previewOwnerKey(actor), previewId);
  if (!session || session.meta?.entityType !== "clients") {
    return null;
  }

  let imported = 0;
  const errors: ImportExecuteResult["errors"] = [];

  for (const row of session.rows) {
    const result = clientRowSchema.safeParse(row.data);
    if (!result.success) {
      errors.push({ rowNumber: row.rowNumber, error: result.error.issues.map((issue) => issue.message).join("; ") });
      continue;
    }

    try {
      const d = result.data;
      const client = await prisma.client.create({
        data: {
          firmId: actor.firmId,
          name: d.name,
          type: d.type,
          phone: d.phone || null,
          email: d.email || null,
          nationalId: d.nationalId || null,
          commercialRegister: d.commercialRegister || null,
          taxNumber: d.taxNumber || null,
          governorate: d.governorate || null
        }
      });
      await writeAuditLog(prisma, { actor, ipAddress: auditCtx.ipAddress, userAgent: auditCtx.userAgent }, {
        action: "clients.bulk_import",
        entityType: "Client",
        entityId: client.id
      });
      imported++;
    } catch (err) {
      errors.push({ rowNumber: row.rowNumber, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return { imported, failed: errors.length, errors };
}

export async function executeCaseImportPreview(
  actor: SessionUser,
  previewId: string,
  auditCtx: { ipAddress?: string; userAgent?: string }
): Promise<ImportExecuteResult | null> {
  const session = getTableSession<ParsedRow>("import_preview", previewOwnerKey(actor), previewId);
  if (!session || session.meta?.entityType !== "cases") {
    return null;
  }

  let imported = 0;
  const errors: ImportExecuteResult["errors"] = [];

  for (const row of session.rows) {
    const result = caseRowSchema.safeParse(row.data);
    if (!result.success) {
      errors.push({ rowNumber: row.rowNumber, error: result.error.issues.map((issue) => issue.message).join("; ") });
      continue;
    }

    try {
      const d = result.data;
      const rawClientId = row.data.client_id ?? row.data.clientid ?? row.data.clientId ?? "";
      let clientId = rawClientId.length === 36 ? rawClientId : undefined;
      if (!clientId) {
        const rawClientName = row.data.client_name ?? row.data.clientname ?? "";
        if (rawClientName) {
          const matched = await prisma.client.findFirst({
            where: { firmId: actor.firmId, name: rawClientName, deletedAt: null }
          });
          clientId = matched?.id;
        }
      }
      if (!clientId) {
        errors.push({ rowNumber: row.rowNumber, error: "client_id or client_name required and must match an existing client" });
        continue;
      }

      const caseRecord = await prisma.case.create({
        data: {
          firmId: actor.firmId,
          clientId,
          title: d.title,
          caseNumber: d.caseNumber,
          type: d.type,
          status: d.status,
          judicialYear: d.judicialYear ? Number(d.judicialYear) : null
        }
      });

      await writeAuditLog(prisma, { actor, ipAddress: auditCtx.ipAddress, userAgent: auditCtx.userAgent }, {
        action: "cases.bulk_import",
        entityType: "Case",
        entityId: caseRecord.id
      });
      imported++;
    } catch (err) {
      errors.push({ rowNumber: row.rowNumber, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return { imported, failed: errors.length, errors };
}

export async function executeCaseImport(
  stream: NodeJS.ReadableStream,
  mimeType: string,
  actor: SessionUser,
  auditCtx: { ipAddress?: string; userAgent?: string }
): Promise<ImportExecuteResult> {
  const buffer = await bufferFromStream(stream);
  const rawRows = await parseFile(buffer, mimeType);

  let imported = 0;
  const errors: ImportExecuteResult["errors"] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const rowNumber = i + 2;
    const result = caseRowSchema.safeParse(rawRows[i]);
    if (!result.success) {
      errors.push({ rowNumber, error: result.error.issues.map((issue) => issue.message).join("; ") });
      continue;
    }

    try {
      const d = result.data;

      // Resolve clientId from the row (by name match) or use the first client as fallback
      const rawClientId = rawRows[i].client_id ?? rawRows[i].clientid ?? rawRows[i].clientId ?? "";
      let clientId = rawClientId.length === 36 ? rawClientId : undefined;
      if (!clientId) {
        // Try to match by client name
        const rawClientName = rawRows[i].client_name ?? rawRows[i].clientname ?? "";
        if (rawClientName) {
          const matched = await prisma.client.findFirst({
            where: { firmId: actor.firmId, name: rawClientName, deletedAt: null }
          });
          clientId = matched?.id;
        }
      }
      if (!clientId) {
        errors.push({ rowNumber, error: "client_id or client_name required and must match an existing client" });
        continue;
      }

      const caseRecord = await prisma.case.create({
        data: {
          firmId: actor.firmId,
          clientId,
          title: d.title,
          caseNumber: d.caseNumber,
          type: d.type,
          status: d.status,
          judicialYear: d.judicialYear ? Number(d.judicialYear) : null
        }
      });

      await writeAuditLog(prisma, { actor, ipAddress: auditCtx.ipAddress, userAgent: auditCtx.userAgent }, {
        action: "cases.bulk_import",
        entityType: "Case",
        entityId: caseRecord.id
      });
      imported++;
    } catch (err) {
      errors.push({ rowNumber, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return { imported, failed: errors.length, errors };
}
