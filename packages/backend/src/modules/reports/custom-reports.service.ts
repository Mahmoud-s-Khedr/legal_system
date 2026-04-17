/**
 * Custom report builder service.
 * Lets firm admins save named report configurations and run them on demand.
 * Execution delegates to the existing report functions in reports.service.ts.
 */
import type { SessionUser } from "@elms/shared";
import {
  caseStatusDistribution,
  hearingOutcomes,
  lawyerWorkload,
  revenueReport,
  outstandingBalances
} from "./reports.service.js";
import { applyArrayTableQuery, normalizeSort, type SortDir } from "../../utils/tableQuery.js";
import { createTableSession, getTableSession } from "../../utils/tableSessionStore.js";
import {
  createCustomReportForFirm,
  deleteCustomReportById,
  findCustomReportByIdForFirm,
  listCustomReportsByFirm,
  updateCustomReportById
} from "../../repositories/reports/custom-reports.repository.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomReportConfig {
  dateFrom?: string;
  dateTo?: string;
  groupBy?: string;
  columns?: string[];
}

export interface CustomReportDto {
  id: string;
  name: string;
  description: string | null;
  reportType: string;
  config: CustomReportConfig;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomReportRunResult {
  reportType: string;
  rows: unknown[];
  ranAt: string;
}

export interface CustomReportRunSession {
  runId: string;
  reportType: string;
  ranAt: string;
  total: number;
  expiresAt: string;
}

// ─── Supported report types ───────────────────────────────────────────────────

export const SUPPORTED_REPORT_TYPES = [
  "case-status",
  "hearing-outcomes",
  "lawyer-workload",
  "revenue",
  "outstanding-balances"
] as const;

// ─── Allowed groupBy values ────────────────────────────────────────────────────

const ALLOWED_GROUP_BY = ["month", "week", "year", "status", "lawyer", "client"] as const;

// ─── Config validation ────────────────────────────────────────────────────────

/**
 * Validates a custom report config object.
 * Ensures date fields are valid ISO 8601 date strings and groupBy is from the
 * allowlist — prevents injection of arbitrary values into SQL queries.
 */
function validateConfig(config: unknown): CustomReportConfig {
  if (config === null || config === undefined) return {};
  if (typeof config !== "object" || Array.isArray(config)) {
    throw Object.assign(new Error("Invalid report config: must be an object"), { statusCode: 422 });
  }

  const c = config as Record<string, unknown>;
  const validated: CustomReportConfig = {};

  if (c.dateFrom !== undefined) {
    if (typeof c.dateFrom !== "string" || isNaN(Date.parse(c.dateFrom))) {
      throw Object.assign(new Error("Invalid report config: dateFrom must be a valid ISO 8601 date string"), { statusCode: 422 });
    }
    validated.dateFrom = c.dateFrom;
  }

  if (c.dateTo !== undefined) {
    if (typeof c.dateTo !== "string" || isNaN(Date.parse(c.dateTo))) {
      throw Object.assign(new Error("Invalid report config: dateTo must be a valid ISO 8601 date string"), { statusCode: 422 });
    }
    validated.dateTo = c.dateTo;
  }

  if (c.groupBy !== undefined) {
    if (!ALLOWED_GROUP_BY.includes(c.groupBy as (typeof ALLOWED_GROUP_BY)[number])) {
      throw Object.assign(
        new Error(`Invalid report config: groupBy must be one of: ${ALLOWED_GROUP_BY.join(", ")}`),
        { statusCode: 422 }
      );
    }
    validated.groupBy = c.groupBy as string;
  }

  return validated;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function listCustomReports(actor: SessionUser): Promise<CustomReportDto[]> {
  const reports = await listCustomReportsByFirm(actor.firmId);
  return reports.map(toDto);
}

export async function createCustomReport(
  actor: SessionUser,
  data: { name: string; description?: string; reportType: string; config: unknown }
): Promise<CustomReportDto> {
  if (!SUPPORTED_REPORT_TYPES.includes(data.reportType as (typeof SUPPORTED_REPORT_TYPES)[number])) {
    throw Object.assign(new Error(`Unsupported report type: ${data.reportType}`), { statusCode: 422 });
  }
  const validatedConfig = validateConfig(data.config ?? {});
  const report = await createCustomReportForFirm({
    firmId: actor.firmId,
    name: data.name,
    description: data.description ?? null,
    reportType: data.reportType,
    config: validatedConfig as object,
    createdById: actor.id
  });
  return toDto(report);
}

export async function updateCustomReport(
  actor: SessionUser,
  id: string,
  data: { name?: string; description?: string; reportType?: string; config?: unknown }
): Promise<CustomReportDto | null> {
  const existing = await findCustomReportByIdForFirm(id, actor.firmId);
  if (!existing) return null;

  if (data.reportType && !SUPPORTED_REPORT_TYPES.includes(data.reportType as (typeof SUPPORTED_REPORT_TYPES)[number])) {
    throw Object.assign(new Error(`Unsupported report type: ${data.reportType}`), { statusCode: 422 });
  }

  const validatedConfig = data.config !== undefined
    ? validateConfig(data.config)
    : (existing.config as CustomReportConfig);

  const updated = await updateCustomReportById(id, {
    name: data.name ?? existing.name,
    description: data.description !== undefined ? (data.description ?? null) : existing.description,
    reportType: data.reportType ?? existing.reportType,
    config: validatedConfig as object
  });
  return toDto(updated);
}

export async function deleteCustomReport(actor: SessionUser, id: string): Promise<boolean> {
  const existing = await findCustomReportByIdForFirm(id, actor.firmId);
  if (!existing) return false;
  await deleteCustomReportById(id);
  return true;
}

// ─── Runner ───────────────────────────────────────────────────────────────────

export async function runCustomReport(
  actor: SessionUser,
  id: string
): Promise<CustomReportRunResult | null> {
  const report = await findCustomReportByIdForFirm(id, actor.firmId);
  if (!report) return null;

  const config = report.config as CustomReportConfig;
  const filter = { dateFrom: config.dateFrom, dateTo: config.dateTo };

  let rows: unknown[];
  switch (report.reportType) {
    case "case-status":
      rows = await caseStatusDistribution(actor, filter);
      break;
    case "hearing-outcomes":
      rows = await hearingOutcomes(actor, filter);
      break;
    case "lawyer-workload":
      rows = await lawyerWorkload(actor);
      break;
    case "revenue":
      rows = await revenueReport(actor, filter);
      break;
    case "outstanding-balances":
      rows = await outstandingBalances(actor);
      break;
    default:
      rows = [];
  }

  return { reportType: report.reportType, rows, ranAt: new Date().toISOString() };
}

function ownerKey(actor: SessionUser) {
  return `${actor.firmId}:${actor.id}`;
}

function toRowRecords(rows: unknown[]): Array<Record<string, unknown>> {
  return rows.map((row) => {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      return row as Record<string, unknown>;
    }
    return { value: row };
  });
}

export async function createCustomReportRunSession(
  actor: SessionUser,
  id: string
): Promise<CustomReportRunSession | null> {
  const result = await runCustomReport(actor, id);
  if (!result) {
    return null;
  }

  const rows = toRowRecords(result.rows);
  const session = createTableSession("custom_report_run", ownerKey(actor), rows, {
    meta: { reportType: result.reportType, ranAt: result.ranAt }
  });

  return {
    runId: session.id,
    reportType: result.reportType,
    ranAt: result.ranAt,
    total: rows.length,
    expiresAt: session.expiresAt
  };
}

export function listCustomReportRunRows(
  actor: SessionUser,
  runId: string,
  query: {
    q?: string;
    sortBy?: string;
    sortDir?: SortDir;
    page: number;
    limit: number;
  }
) {
  const session = getTableSession<Record<string, unknown>>("custom_report_run", ownerKey(actor), runId);
  if (!session) {
    return null;
  }

  const rows = session.rows;
  const sortableColumns = Object.keys(rows[0] ?? {}).filter((column) => column.length > 0);
  const defaultSort = (sortableColumns[0] ?? "value") as keyof Record<string, unknown>;
  const sortBy = normalizeSort(
    query.sortBy,
    sortableColumns.length > 0 ? (sortableColumns as readonly string[]) : (["value"] as const),
    String(defaultSort)
  ) as keyof Record<string, unknown>;
  const sortDir = query.sortDir ?? "asc";
  const searchFields = (sortableColumns.length > 0
    ? sortableColumns
    : ["value"]) as Array<keyof Record<string, unknown>>;

  const result = applyArrayTableQuery(rows, {
    q: query.q,
    searchFields,
    sortBy,
    sortDir,
    page: query.page,
    limit: query.limit
  });

  return {
    items: result.items,
    total: result.total,
    page: query.page,
    pageSize: query.limit,
    expiresAt: new Date(session.expiresAt).toISOString()
  };
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function toDto(r: {
  id: string;
  name: string;
  description: string | null;
  reportType: string;
  config: unknown;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CustomReportDto {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    reportType: r.reportType,
    config: r.config as CustomReportConfig,
    createdById: r.createdById,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  };
}
