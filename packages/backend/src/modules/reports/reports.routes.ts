import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { parsePaginationQuery } from "../../utils/pagination.js";
import { applyArrayTableQuery, normalizeSort } from "../../utils/tableQuery.js";
import {
  caseStatusDistribution,
  hearingOutcomes,
  lawyerWorkload,
  revenueReport,
  outstandingBalances,
  caseProfitability
} from "./reports.service.js";
import {
  listCustomReports,
  createCustomReport,
  updateCustomReport,
  deleteCustomReport,
  runCustomReport,
  createCustomReportRunSession,
  listCustomReportRunRows
} from "./custom-reports.service.js";
import { generateReportExcel, generateReportPdf } from "./report.export.js";

const reportTableQuerySchema = z.object({
  format: z.enum(["excel", "pdf"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  q: z.string().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  page: z.string().optional(),
  limit: z.string().optional()
});

function toRowRecords(data: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.map((row) => (row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>) : { value: row }));
}

function toTableResponse(
  rows: Array<Record<string, unknown>>,
  query: { q?: string; sortBy?: string; sortDir?: "asc" | "desc"; page: number; limit: number },
  options: {
    searchable: readonly string[];
    sortable: readonly string[];
    defaultSortBy: string;
    defaultSortDir: "asc" | "desc";
  }
) {
  const sortBy = normalizeSort(
    query.sortBy,
    options.sortable as readonly string[],
    options.defaultSortBy
  ) as keyof Record<string, unknown>;
  const searchFields = (options.searchable.length > 0 ? options.searchable : options.sortable) as Array<keyof Record<string, unknown>>;
  const result = applyArrayTableQuery(rows, {
    q: query.q,
    searchFields,
    sortBy,
    sortDir: query.sortDir ?? options.defaultSortDir,
    page: query.page,
    limit: query.limit
  });
  return {
    items: result.items,
    total: result.total,
    page: query.page,
    pageSize: query.limit
  };
}

const REPORT_CONFIG = {
  "case-status": {
    searchable: ["status"],
    sortable: ["status", "count"],
    defaultSortBy: "count",
    defaultSortDir: "desc" as const
  },
  "hearing-outcomes": {
    searchable: ["outcome"],
    sortable: ["outcome", "count"],
    defaultSortBy: "count",
    defaultSortDir: "desc" as const
  },
  "lawyer-workload": {
    searchable: ["fullName"],
    sortable: ["fullName", "openCases", "openTasks", "upcomingHearings"],
    defaultSortBy: "openCases",
    defaultSortDir: "desc" as const
  },
  revenue: {
    searchable: ["month"],
    sortable: ["month", "invoiced", "paid"],
    defaultSortBy: "month",
    defaultSortDir: "asc" as const
  },
  "outstanding-balances": {
    searchable: ["invoiceNumber", "clientName"],
    sortable: ["invoiceNumber", "clientName", "totalAmount", "dueDate", "daysOverdue"],
    defaultSortBy: "daysOverdue",
    defaultSortDir: "desc" as const
  }
} as const;

export async function registerReportRoutes(app: FastifyInstance) {
  app.get(
    "/api/reports/case-status",
    { preHandler: [requireAuth, requirePermission("reports:read")] },
    async (request) => {
      const query = reportTableQuerySchema.parse(request.query as Record<string, string>);
      const { page, limit } = parsePaginationQuery(query);
      const rows = await caseStatusDistribution(request.sessionUser!, {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo
      });
      return toTableResponse(
        toRowRecords(rows),
        { q: query.q, sortBy: query.sortBy, sortDir: query.sortDir, page, limit },
        REPORT_CONFIG["case-status"]
      );
    }
  );

  app.get(
    "/api/reports/hearing-outcomes",
    { preHandler: [requireAuth, requirePermission("reports:read")] },
    async (request) => {
      const query = reportTableQuerySchema.parse(request.query as Record<string, string>);
      const { page, limit } = parsePaginationQuery(query);
      const rows = await hearingOutcomes(request.sessionUser!, {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo
      });
      return toTableResponse(
        toRowRecords(rows),
        { q: query.q, sortBy: query.sortBy, sortDir: query.sortDir, page, limit },
        REPORT_CONFIG["hearing-outcomes"]
      );
    }
  );

  app.get(
    "/api/reports/lawyer-workload",
    { preHandler: [requireAuth, requirePermission("reports:read")] },
    async (request) => {
      const query = reportTableQuerySchema.parse(request.query as Record<string, string>);
      const { page, limit } = parsePaginationQuery(query);
      const rows = await lawyerWorkload(request.sessionUser!);
      return toTableResponse(
        toRowRecords(rows),
        { q: query.q, sortBy: query.sortBy, sortDir: query.sortDir, page, limit },
        REPORT_CONFIG["lawyer-workload"]
      );
    }
  );

  app.get(
    "/api/reports/revenue",
    { preHandler: [requireAuth, requirePermission("reports:read")] },
    async (request) => {
      const query = reportTableQuerySchema.parse(request.query as Record<string, string>);
      const { page, limit } = parsePaginationQuery(query);
      const rows = await revenueReport(request.sessionUser!, {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo
      });
      return toTableResponse(
        toRowRecords(rows),
        { q: query.q, sortBy: query.sortBy, sortDir: query.sortDir, page, limit },
        REPORT_CONFIG.revenue
      );
    }
  );

  app.get(
    "/api/reports/outstanding-balances",
    { preHandler: [requireAuth, requirePermission("reports:read")] },
    async (request) => {
      const query = reportTableQuerySchema.parse(request.query as Record<string, string>);
      const { page, limit } = parsePaginationQuery(query);
      const rows = await outstandingBalances(request.sessionUser!);
      return toTableResponse(
        toRowRecords(rows),
        { q: query.q, sortBy: query.sortBy, sortDir: query.sortDir, page, limit },
        REPORT_CONFIG["outstanding-balances"]
      );
    }
  );

  app.get(
    "/api/reports/case-profitability/:caseId",
    { preHandler: [requireAuth, requirePermission("reports:read")] },
    async (request, reply) => {
      const { caseId } = request.params as { caseId: string };
      const result = await caseProfitability(request.sessionUser!, caseId);

      if (!result) {
        return reply.status(404).send({ error: "Case not found" });
      }

      return result;
    }
  );

  // ── Export endpoints ──────────────────────────────────────────────────────

  app.get(
    "/api/reports/:reportType/export",
    { preHandler: [requireAuth, requirePermission("reports:read")] },
    async (request, reply) => {
      const { reportType } = request.params as { reportType: string };
      const query = reportTableQuerySchema.parse(request.query as Record<string, string>);
      const format = query.format === "pdf" ? "pdf" : "excel";
      const filter = { dateFrom: query.dateFrom, dateTo: query.dateTo };
      const { page, limit } = parsePaginationQuery(query);
      const generatedAt = new Date().toISOString().slice(0, 10);

      let rows: unknown;
      let tableConfig: (typeof REPORT_CONFIG)[keyof typeof REPORT_CONFIG];
      switch (reportType) {
        case "case-status":
          rows = await caseStatusDistribution(request.sessionUser!, filter);
          tableConfig = REPORT_CONFIG["case-status"];
          break;
        case "hearing-outcomes":
          rows = await hearingOutcomes(request.sessionUser!, filter);
          tableConfig = REPORT_CONFIG["hearing-outcomes"];
          break;
        case "lawyer-workload":
          rows = await lawyerWorkload(request.sessionUser!);
          tableConfig = REPORT_CONFIG["lawyer-workload"];
          break;
        case "revenue":
          rows = await revenueReport(request.sessionUser!, filter);
          tableConfig = REPORT_CONFIG.revenue;
          break;
        case "outstanding-balances":
          rows = await outstandingBalances(request.sessionUser!);
          tableConfig = REPORT_CONFIG["outstanding-balances"];
          break;
        default:
          return reply.status(400).send({ error: "Unknown report type" });
      }

      const tableData = toTableResponse(
        toRowRecords(rows),
        { q: query.q, sortBy: query.sortBy, sortDir: query.sortDir, page, limit },
        tableConfig
      ).items;

      if (format === "excel") {
        const buf = await generateReportExcel(reportType, tableData, generatedAt);
        return reply
          .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
          .header("Content-Disposition", `attachment; filename="elms-report-${reportType}-${generatedAt}.xlsx"`)
          .send(buf);
      } else {
        const buf = await generateReportPdf(reportType, tableData, generatedAt);
        return reply
          .header("Content-Type", "application/pdf")
          .header("Content-Disposition", `attachment; filename="elms-report-${reportType}-${generatedAt}.pdf"`)
          .send(buf);
      }
    }
  );

  // ── Custom report builder ─────────────────────────────────────────────────

  app.get(
    "/api/reports/custom",
    { preHandler: [requireAuth, requirePermission("reports:read")] },
    async (request) => listCustomReports(request.sessionUser!)
  );

  app.post(
    "/api/reports/custom",
    { preHandler: [requireAuth, requirePermission("reports:read")] },
    async (request, reply) => {
      const body = request.body as { name: string; description?: string; reportType: string; config: unknown };
      const result = await createCustomReport(request.sessionUser!, body);
      return reply.status(201).send(result);
    }
  );

  app.put(
    "/api/reports/custom/:id",
    { preHandler: [requireAuth, requirePermission("reports:read")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { name?: string; description?: string; reportType?: string; config?: unknown };
      const result = await updateCustomReport(request.sessionUser!, id, body);
      if (!result) return reply.status(404).send({ error: "Custom report not found" });
      return result;
    }
  );

  app.delete(
    "/api/reports/custom/:id",
    { preHandler: [requireAuth, requirePermission("reports:read")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const ok = await deleteCustomReport(request.sessionUser!, id);
      if (!ok) return reply.status(404).send({ error: "Custom report not found" });
      return { success: true };
    }
  );

  app.post(
    "/api/reports/custom/:id/run",
    { preHandler: [requireAuth, requirePermission("reports:read")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await createCustomReportRunSession(request.sessionUser!, id);
      if (!result) return reply.status(404).send({ error: "Custom report not found" });
      return result;
    }
  );

  app.get(
    "/api/reports/custom/runs/:runId/rows",
    { preHandler: [requireAuth, requirePermission("reports:read")] },
    async (request, reply) => {
      const query = reportTableQuerySchema.parse(request.query as Record<string, string>);
      const { page, limit } = parsePaginationQuery(query);
      const result = listCustomReportRunRows(
        request.sessionUser!,
        (request.params as { runId: string }).runId,
        {
          q: query.q,
          sortBy: query.sortBy,
          sortDir: query.sortDir,
          page,
          limit
        }
      );
      if (!result) {
        return reply.status(404).send({ error: "Report run session not found or expired" });
      }
      return result;
    }
  );

  app.get(
    "/api/reports/custom/:id/export",
    { preHandler: [requireAuth, requirePermission("reports:read")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const q = request.query as Record<string, string>;
      const format = q.format === "pdf" ? "pdf" : "excel";
      const generatedAt = new Date().toISOString().slice(0, 10);

      const result = await runCustomReport(request.sessionUser!, id);
      if (!result) return reply.status(404).send({ error: "Custom report not found" });

      if (format === "excel") {
        const buf = await generateReportExcel(result.reportType, result.rows, generatedAt);
        return reply
          .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
          .header("Content-Disposition", `attachment; filename="elms-custom-${id}-${generatedAt}.xlsx"`)
          .send(buf);
      } else {
        const buf = await generateReportPdf(result.reportType, result.rows, generatedAt);
        return reply
          .header("Content-Type", "application/pdf")
          .header("Content-Disposition", `attachment; filename="elms-custom-${id}-${generatedAt}.pdf"`)
          .send(buf);
      }
    }
  );

  app.get(
    "/api/reports/case-profitability/:caseId/export",
    { preHandler: [requireAuth, requirePermission("reports:read")] },
    async (request, reply) => {
      const { caseId } = request.params as { caseId: string };
      const q = request.query as Record<string, string>;
      const format = q.format === "pdf" ? "pdf" : "excel";
      const generatedAt = new Date().toISOString().slice(0, 10);

      const data = await caseProfitability(request.sessionUser!, caseId);
      if (!data) return reply.status(404).send({ error: "Case not found" });

      if (format === "excel") {
        const buf = await generateReportExcel("case-profitability", data, generatedAt);
        return reply
          .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
          .header("Content-Disposition", `attachment; filename="elms-profitability-${caseId}-${generatedAt}.xlsx"`)
          .send(buf);
      } else {
        const buf = await generateReportPdf("case-profitability", data, generatedAt);
        return reply
          .header("Content-Type", "application/pdf")
          .header("Content-Disposition", `attachment; filename="elms-profitability-${caseId}-${generatedAt}.pdf"`)
          .send(buf);
      }
    }
  );
}
