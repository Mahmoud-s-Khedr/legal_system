import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { stripe } from "./stripe.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { prisma } from "../../db/prisma.js";
import { parsePaginationQuery } from "../../utils/pagination.js";
import { getAuditContext } from "../../utils/auditContext.js";
import { appError } from "../../errors/appError.js";
import {
  addPayment,
  applyInvoiceCredit,
  createExpense,
  createInvoice,
  deleteExpense,
  deleteInvoice,
  getCaseBillingSummary,
  getClientCreditBalanceForClient,
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

const checkoutSchema = z.object({
  priceId: z.string()
});

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().positive().default(1),
  unitPrice: z.string().min(1)
});

const createInvoiceSchema = z.object({
  caseId: z.string().uuid().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  feeType: z.string().min(1).optional(),
  taxAmount: z.string().optional(),
  discountAmount: z.string().optional(),
  issuedAt: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  items: z.array(invoiceItemSchema).min(1)
});

const updateInvoiceSchema = createInvoiceSchema.partial().extend({
  items: z.array(invoiceItemSchema).min(1).optional()
});

const createPaymentSchema = z.object({
  amount: z.string().min(1),
  method: z.string().min(1),
  referenceNumber: z.string().nullable().optional(),
  paidAt: z.string().datetime().optional()
});

const applyInvoiceCreditSchema = z.object({
  amount: z.string().min(1)
});

const createExpenseSchema = z.object({
  caseId: z.string().uuid().nullable().optional(),
  category: z.string().min(1),
  amount: z.string().min(1),
  description: z.string().nullable().optional(),
  receiptDocumentId: z.string().uuid().nullable().optional()
});

const updateExpenseSchema = createExpenseSchema.partial();

export const billingRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/invoices", { preValidation: [requireAuth, requirePermission("invoices:read")] }, async (request) => {
    const pagination = parsePaginationQuery(request.query as { page?: string; limit?: string });
    const filters = z
      .object({
        q: z.string().optional(),
        caseId: z.string().uuid().optional(),
        clientId: z.string().uuid().optional(),
        status: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional()
      })
      .parse(request.query);

    return listInvoices(request.sessionUser!, filters, pagination);
  });

  app.post("/api/invoices", { preValidation: [requireAuth, requirePermission("invoices:create")] }, async (request) => {
    return createInvoice(
      request.sessionUser!,
      createInvoiceSchema.parse(request.body),
      getAuditContext(request)
    );
  });

  app.get("/api/invoices/:id", { preValidation: [requireAuth, requirePermission("invoices:read")] }, async (request) => {
    const params = z.object({ id: z.string().uuid().or(z.string().min(1)) }).parse(request.params);
    return getInvoice(request.sessionUser!, params.id);
  });

  app.put("/api/invoices/:id", { preValidation: [requireAuth, requirePermission("invoices:update")] }, async (request) => {
    const params = z.object({ id: z.string().uuid().or(z.string().min(1)) }).parse(request.params);
    return updateInvoice(
      request.sessionUser!,
      params.id,
      updateInvoiceSchema.parse(request.body),
      getAuditContext(request)
    );
  });

  app.post("/api/invoices/:id/issue", { preValidation: [requireAuth, requirePermission("invoices:update")] }, async (request) => {
    const params = z.object({ id: z.string().uuid().or(z.string().min(1)) }).parse(request.params);
    return issueInvoice(request.sessionUser!, params.id, getAuditContext(request));
  });

  app.post("/api/invoices/:id/void", { preValidation: [requireAuth, requirePermission("invoices:update")] }, async (request) => {
    const params = z.object({ id: z.string().uuid().or(z.string().min(1)) }).parse(request.params);
    return voidInvoice(request.sessionUser!, params.id, getAuditContext(request));
  });

  app.delete("/api/invoices/:id", { preValidation: [requireAuth, requirePermission("invoices:delete")] }, async (request) => {
    const params = z.object({ id: z.string().uuid().or(z.string().min(1)) }).parse(request.params);
    await deleteInvoice(request.sessionUser!, params.id, getAuditContext(request));
    return { success: true };
  });

  app.get("/api/invoices/:id/pdf", { preValidation: [requireAuth, requirePermission("invoices:read")] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid().or(z.string().min(1)) }).parse(request.params);
    const invoice = await getInvoice(request.sessionUser!, params.id);
    const firmName =
      (request.sessionUser as typeof request.sessionUser & { firmName?: string } | undefined)?.firmName ?? "ELMS";

    try {
      const pdf = await generateInvoicePdf(invoice, firmName);
      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`)
        .send(pdf);
    } catch {
      throw appError("Failed to generate invoice PDF", 500);
    }
  });

  app.post(
    "/api/invoices/:id/payments",
    {
      preValidation: [requireAuth, requirePermission("invoices:update")],
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute"
        }
      }
    },
    async (request) => {
      const params = z.object({ id: z.string().uuid().or(z.string().min(1)) }).parse(request.params);
      return addPayment(
        request.sessionUser!,
        params.id,
        createPaymentSchema.parse(request.body),
        getAuditContext(request)
      );
    }
  );

  app.post(
    "/api/invoices/:id/apply-credit",
    { preValidation: [requireAuth, requirePermission("invoices:update")] },
    async (request) => {
      const params = z.object({ id: z.string().uuid().or(z.string().min(1)) }).parse(request.params);
      return applyInvoiceCredit(
        request.sessionUser!,
        params.id,
        applyInvoiceCreditSchema.parse(request.body),
        getAuditContext(request)
      );
    }
  );

  app.get(
    "/api/clients/:clientId/credit-balance",
    { preValidation: [requireAuth, requirePermission("invoices:read")] },
    async (request) => {
      const params = z.object({ clientId: z.string().uuid().or(z.string().min(1)) }).parse(request.params);
      return getClientCreditBalanceForClient(request.sessionUser!, params.clientId);
    }
  );

  app.get(
    "/api/cases/:caseId/billing",
    { preValidation: [requireAuth, requirePermission("invoices:read")] },
    async (request) => {
      const params = z.object({ caseId: z.string().uuid().or(z.string().min(1)) }).parse(request.params);
      return getCaseBillingSummary(request.sessionUser!, params.caseId);
    }
  );

  app.get("/api/expenses", { preValidation: [requireAuth, requirePermission("expenses:read")] }, async (request) => {
    const pagination = parsePaginationQuery(request.query as { page?: string; limit?: string });
    const filters = z
      .object({
        q: z.string().optional(),
        caseId: z.string().uuid().optional(),
        category: z.string().optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional()
      })
      .parse(request.query);

    return listExpenses(request.sessionUser!, filters, pagination);
  });

  app.post("/api/expenses", { preValidation: [requireAuth, requirePermission("expenses:create")] }, async (request) => {
    return createExpense(
      request.sessionUser!,
      createExpenseSchema.parse(request.body),
      getAuditContext(request)
    );
  });

  app.get("/api/expenses/:id", { preValidation: [requireAuth, requirePermission("expenses:read")] }, async (request) => {
    const params = z.object({ id: z.string().uuid().or(z.string().min(1)) }).parse(request.params);
    return getExpense(request.sessionUser!, params.id);
  });

  app.put("/api/expenses/:id", { preValidation: [requireAuth, requirePermission("expenses:update")] }, async (request) => {
    const params = z.object({ id: z.string().uuid().or(z.string().min(1)) }).parse(request.params);
    return updateExpense(
      request.sessionUser!,
      params.id,
      updateExpenseSchema.parse(request.body),
      getAuditContext(request)
    );
  });

  app.delete("/api/expenses/:id", { preValidation: [requireAuth, requirePermission("expenses:delete")] }, async (request) => {
    const params = z.object({ id: z.string().uuid().or(z.string().min(1)) }).parse(request.params);
    await deleteExpense(request.sessionUser!, params.id, getAuditContext(request));
    return { success: true };
  });

  app.post("/api/billing/checkout", { preValidation: [requireAuth] }, async (request, reply) => {
    if (request.server.appEnv.SAAS_BILLING_MODE !== "stripe") {
      throw appError(
        "Self-serve subscription checkout is disabled for this hosted beta. Billing is handled manually.",
        409,
        { code: "SAAS_BILLING_MANUAL" }
      );
    }

    const { priceId } = checkoutSchema.parse(request.body);
    const firmId = request.sessionUser?.firmId;

    if (!firmId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const settings = await prisma.firmSettings.findUnique({ where: { firmId } });
    let customerId = settings?.stripeCustomerId;

    if (!customerId) {
      const firm = await prisma.firm.findUnique({ where: { id: firmId } });
      const customer = await stripe.customers.create({
        metadata: { firmId },
        name: firm?.name
      });
      customerId = customer.id;

      await prisma.firmSettings.update({
        where: { firmId },
        data: { stripeCustomerId: customerId }
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${request.server.appEnv.FRONTEND_APP_URL}/app/settings/billing?success=true`,
      cancel_url: `${request.server.appEnv.FRONTEND_APP_URL}/app/settings/billing?canceled=true`
    });

    return reply.send({ url: session.url });
  });
};

export const registerBillingRoutes = billingRoutes;
