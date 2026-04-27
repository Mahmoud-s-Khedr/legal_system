import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { getAuditContext } from "../../utils/auditContext.js";
import { parsePaginationQuery } from "../../utils/pagination.js";
import {
  billingSummarySchema,
  clientCreditBalanceSchema,
  expenseDtoSchema,
  invoiceDtoSchema,
  listResponseSchema,
  successSchema
} from "../../schemas/index.js";
import {
  addPayment,
  applyInvoiceCredit,
  createExpense,
  createInvoice,
  deleteExpense,
  deleteInvoice,
  getClientCreditBalanceForClient,
  getCaseBillingSummary,
  getExpense,
  getInvoice,
  issueInvoice,
  listExpenses,
  listInvoices,
  updateExpense,
  updateInvoice,
  voidInvoice
} from "./billing.service.js";
import { generateInvoicePdf } from "./invoice.pdf.js";

const invoiceItemInputSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive().optional(),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid decimal")
});

const createInvoiceSchema = z.object({
  caseId: z.string().uuid().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  feeType: z.string().optional(),
  taxAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  discountAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  issuedAt: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  items: z.array(invoiceItemInputSchema).min(1)
});

const updateInvoiceSchema = z.object({
  feeType: z.string().optional(),
  taxAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  discountAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  issuedAt: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  items: z.array(invoiceItemInputSchema).optional()
});

const createPaymentSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid decimal"),
  method: z.string().min(1),
  referenceNumber: z.string().nullable().optional(),
  paidAt: z.string().datetime().nullable().optional()
});

const applyInvoiceCreditSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid decimal")
});

const createExpenseSchema = z.object({
  caseId: z.string().uuid().nullable().optional(),
  category: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid decimal"),
  description: z.string().nullable().optional(),
  receiptDocumentId: z.string().uuid().nullable().optional()
});

const updateExpenseSchema = createExpenseSchema.partial();

const invoiceListQuerySchema = z.object({
  q: z.string().optional(),
  caseId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  status: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  page: z.string().optional(),
  limit: z.string().optional()
});

const idParamsSchema = z.object({ id: z.string().min(1) });
const clientIdParamsSchema = z.object({ clientId: z.string().uuid() });

const expenseListQuerySchema = z.object({
  q: z.string().optional(),
  caseId: z.string().uuid().optional(),
  category: z.string().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  page: z.string().optional(),
  limit: z.string().optional()
});

export async function registerBillingRoutes(app: FastifyInstance) {
  // ── Invoices ────────────────────────────────────────────────────────────────

  app.get(
    "/api/invoices",
    {
      schema: { response: { 200: listResponseSchema(invoiceDtoSchema) } },
      preHandler: [requireAuth, requirePermission("invoices:read")]
    },
    async (request) => {
      const filters = invoiceListQuerySchema.parse(request.query as Record<string, string>);
      const { page, limit } = parsePaginationQuery(filters);
      return listInvoices(request.sessionUser!, filters, { page, limit });
    }
  );

  app.post(
    "/api/invoices",
    {
      schema: { response: { 200: invoiceDtoSchema } },
      preHandler: [requireAuth, requirePermission("invoices:create")]
    },
    async (request) => {
      const payload = createInvoiceSchema.parse(request.body);
      return createInvoice(request.sessionUser!, payload, getAuditContext(request));
    }
  );

  app.get(
    "/api/invoices/:id",
    {
      schema: { response: { 200: invoiceDtoSchema } },
      preHandler: [requireAuth, requirePermission("invoices:read")]
    },
    async (request) => getInvoice(request.sessionUser!, idParamsSchema.parse(request.params).id)
  );

  app.put(
    "/api/invoices/:id",
    {
      schema: { response: { 200: invoiceDtoSchema } },
      preHandler: [requireAuth, requirePermission("invoices:update")]
    },
    async (request) => {
      const payload = updateInvoiceSchema.parse(request.body);
      return updateInvoice(
        request.sessionUser!,
        idParamsSchema.parse(request.params).id,
        payload,
        getAuditContext(request)
      );
    }
  );

  app.post(
    "/api/invoices/:id/apply-credit",
    {
      schema: { response: { 200: invoiceDtoSchema } },
      preHandler: [requireAuth, requirePermission("invoices:update")],
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } }
    },
    async (request) => {
      const payload = applyInvoiceCreditSchema.parse(request.body);
      return applyInvoiceCredit(
        request.sessionUser!,
        idParamsSchema.parse(request.params).id,
        payload,
        getAuditContext(request)
      );
    }
  );

  app.get(
    "/api/clients/:clientId/credit-balance",
    {
      schema: { response: { 200: clientCreditBalanceSchema } },
      preHandler: [requireAuth, requirePermission("invoices:read")]
    },
    async (request) =>
      getClientCreditBalanceForClient(
        request.sessionUser!,
        clientIdParamsSchema.parse(request.params).clientId
      )
  );

  app.post(
    "/api/invoices/:id/issue",
    {
      schema: { response: { 200: invoiceDtoSchema } },
      preHandler: [requireAuth, requirePermission("invoices:update")]
    },
    async (request) => issueInvoice(request.sessionUser!, idParamsSchema.parse(request.params).id, getAuditContext(request))
  );

  app.post(
    "/api/invoices/:id/void",
    {
      schema: { response: { 200: invoiceDtoSchema } },
      preHandler: [requireAuth, requirePermission("invoices:update")]
    },
    async (request) => voidInvoice(request.sessionUser!, idParamsSchema.parse(request.params).id, getAuditContext(request))
  );

  app.delete(
    "/api/invoices/:id",
    {
      schema: { response: { 200: successSchema } },
      preHandler: [requireAuth, requirePermission("invoices:delete")]
    },
    async (request) => {
      await deleteInvoice(
        request.sessionUser!,
        idParamsSchema.parse(request.params).id,
        getAuditContext(request)
      );
      return { success: true as const };
    }
  );

  app.post(
    "/api/invoices/:id/payments",
    {
      schema: { response: { 200: invoiceDtoSchema } },
      preHandler: [requireAuth, requirePermission("invoices:update")],
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } }
    },
    async (request) => {
      const payload = createPaymentSchema.parse(request.body);
      return addPayment(
        request.sessionUser!,
        idParamsSchema.parse(request.params).id,
        payload,
        getAuditContext(request)
      );
    }
  );

  // ── Expenses ────────────────────────────────────────────────────────────────

  app.get(
    "/api/expenses",
    {
      schema: { response: { 200: listResponseSchema(expenseDtoSchema) } },
      preHandler: [requireAuth, requirePermission("expenses:read")]
    },
    async (request) => {
      const filters = expenseListQuerySchema.parse(request.query as Record<string, string>);
      const { page, limit } = parsePaginationQuery(filters);
      return listExpenses(request.sessionUser!, filters, { page, limit });
    }
  );

  app.post(
    "/api/expenses",
    {
      schema: { response: { 200: expenseDtoSchema } },
      preHandler: [requireAuth, requirePermission("expenses:create")]
    },
    async (request) => {
      const payload = createExpenseSchema.parse(request.body);
      return createExpense(request.sessionUser!, payload, getAuditContext(request));
    }
  );

  app.get(
    "/api/expenses/:id",
    {
      schema: { response: { 200: expenseDtoSchema } },
      preHandler: [requireAuth, requirePermission("expenses:read")]
    },
    async (request) => getExpense(request.sessionUser!, idParamsSchema.parse(request.params).id)
  );

  app.put(
    "/api/expenses/:id",
    {
      schema: { response: { 200: expenseDtoSchema } },
      preHandler: [requireAuth, requirePermission("expenses:update")]
    },
    async (request) => {
      const payload = updateExpenseSchema.parse(request.body);
      return updateExpense(
        request.sessionUser!,
        idParamsSchema.parse(request.params).id,
        payload,
        getAuditContext(request)
      );
    }
  );

  app.delete(
    "/api/expenses/:id",
    {
      schema: { response: { 200: successSchema } },
      preHandler: [requireAuth, requirePermission("expenses:delete")]
    },
    async (request) => {
      await deleteExpense(
        request.sessionUser!,
        idParamsSchema.parse(request.params).id,
        getAuditContext(request)
      );
      return { success: true as const };
    }
  );

  // ── Invoice PDF ─────────────────────────────────────────────────────────────

  app.get(
    "/api/invoices/:id/pdf",
    { preHandler: [requireAuth, requirePermission("invoices:read")] },
    async (request, reply) => {
      const invoice = await getInvoice(request.sessionUser!, idParamsSchema.parse(request.params).id);
      const firmName = (request.sessionUser! as { firmName?: string }).firmName ?? "ELMS";
      const pdf = await generateInvoicePdf(invoice, firmName);
      reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`)
        .header("Content-Length", pdf.length);
      return reply.send(pdf);
    }
  );

  // ── Case billing summary ────────────────────────────────────────────────────

  app.get(
    "/api/cases/:id/billing",
    {
      schema: { response: { 200: billingSummarySchema } },
      preHandler: [requireAuth, requirePermission("invoices:read")]
    },
    async (request) => getCaseBillingSummary(request.sessionUser!, idParamsSchema.parse(request.params).id)
  );
}
