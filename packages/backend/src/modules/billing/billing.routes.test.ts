import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const parsePaginationQuery = vi.fn();
const getAuditContext = vi.fn();
const requirePermission = vi.fn((permission: string) => `perm:${permission}`);
const generateInvoicePdf = vi.fn();

const listInvoices = vi.fn();
const deleteInvoice = vi.fn();
const getInvoice = vi.fn();
const addPayment = vi.fn();

vi.mock("../../middleware/requireAuth.js", () => ({
  requireAuth: "auth-guard"
}));

vi.mock("../../middleware/requirePermission.js", () => ({
  requirePermission
}));

vi.mock("../../utils/pagination.js", () => ({
  parsePaginationQuery
}));

vi.mock("../../utils/auditContext.js", () => ({
  getAuditContext
}));

vi.mock("./invoice.pdf.js", () => ({
  generateInvoicePdf
}));

vi.mock("./billing.service.js", () => ({
  addPayment,
  createExpense: vi.fn(),
  createInvoice: vi.fn(),
  deleteExpense: vi.fn(),
  deleteInvoice,
  getCaseBillingSummary: vi.fn(),
  getExpense: vi.fn(),
  getInvoice,
  issueInvoice: vi.fn(),
  listExpenses: vi.fn(),
  listInvoices,
  updateExpense: vi.fn(),
  updateInvoice: vi.fn(),
  voidInvoice: vi.fn()
}));

const { registerBillingRoutes } = await import("./billing.routes.js");

function createApp() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  };
}

function findRouteHandler(calls: unknown[][], path: string) {
  const call = calls.find((entry) => entry[0] === path);
  return call?.[2] as ((request: unknown, reply?: unknown) => Promise<unknown>) | undefined;
}

describe("registerBillingRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parsePaginationQuery.mockReturnValue({ page: 2, limit: 15 });
    getAuditContext.mockReturnValue({ ipAddress: "127.0.0.1", userAgent: "vitest" });
  });

  it("lists invoices with parsed pagination", async () => {
    const app = createApp();
    const actor = makeSessionUser({ permissions: ["invoices:read"] });

    listInvoices.mockResolvedValueOnce({ items: [], total: 0, page: 2, pageSize: 15 });

    await registerBillingRoutes(app as never);

    const listHandler = findRouteHandler(app.get.mock.calls, "/api/invoices");
    expect(listHandler).toBeDefined();

    const result = await listHandler!({
      query: {
        q: "inv-",
        status: "ISSUED",
        page: "2",
        limit: "15"
      },
      sessionUser: actor
    });

    expect(requirePermission).toHaveBeenCalledWith("invoices:read");
    expect(listInvoices).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ q: "inv-", status: "ISSUED" }),
      { page: 2, limit: 15 }
    );
    expect(result).toEqual({ items: [], total: 0, page: 2, pageSize: 15 });
  });

  it("deletes invoice and returns success object", async () => {
    const app = createApp();
    await registerBillingRoutes(app as never);

    const handler = findRouteHandler(app.delete.mock.calls, "/api/invoices/:id");
    expect(handler).toBeDefined();

    deleteInvoice.mockResolvedValueOnce(undefined);

    const actor = makeSessionUser({ permissions: ["invoices:delete"] });
    const result = await handler!({
      params: { id: "invoice-1" },
      sessionUser: actor
    });

    expect(deleteInvoice).toHaveBeenCalledWith(
      actor,
      "invoice-1",
      { ipAddress: "127.0.0.1", userAgent: "vitest" }
    );
    expect(result).toEqual({ success: true });
  });

  it("generates invoice PDF with expected response headers", async () => {
    const app = createApp();
    await registerBillingRoutes(app as never);

    getInvoice.mockResolvedValueOnce({ invoiceNumber: "INV-2026-01" });
    generateInvoicePdf.mockResolvedValueOnce(Buffer.from("pdf-content"));

    const actor = makeSessionUser({ permissions: ["invoices:read"] }) as ReturnType<typeof makeSessionUser> & {
      firmName?: string;
    };
    actor.firmName = "Demo Firm";

    const reply = {
      header: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };

    const handler = findRouteHandler(app.get.mock.calls, "/api/invoices/:id/pdf");
    const result = await handler!({ params: { id: "invoice-1" }, sessionUser: actor }, reply);

    expect(generateInvoicePdf).toHaveBeenCalledWith({ invoiceNumber: "INV-2026-01" }, "Demo Firm");
    expect(reply.header).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(reply.header).toHaveBeenCalledWith(
      "Content-Disposition",
      'attachment; filename="invoice-INV-2026-01.pdf"'
    );
    expect(reply.send).toHaveBeenCalledWith(Buffer.from("pdf-content"));
    expect(result).toBe(reply);
  });

  it("configures payment endpoint rate limit and forwards id param", async () => {
    const app = createApp();
    await registerBillingRoutes(app as never);

    const routeCall = app.post.mock.calls.find((entry) => entry[0] === "/api/invoices/:id/payments");
    expect(routeCall).toBeDefined();

    const options = routeCall?.[1] as { config?: { rateLimit?: { max?: number; timeWindow?: string } } };
    expect(options.config?.rateLimit).toEqual({ max: 20, timeWindow: "1 minute" });

    const handler = routeCall?.[2] as ((request: unknown) => Promise<unknown>) | undefined;
    expect(handler).toBeDefined();

    const actor = makeSessionUser({ permissions: ["invoices:update"] });
    addPayment.mockResolvedValueOnce({ id: "invoice-1" });

    await handler!({
      params: { id: "invoice-1" },
      body: { amount: "100", method: "cash" },
      sessionUser: actor
    });

    expect(addPayment).toHaveBeenCalledWith(
      actor,
      "invoice-1",
      expect.objectContaining({ amount: "100", method: "cash" }),
      { ipAddress: "127.0.0.1", userAgent: "vitest" }
    );
  });
});
