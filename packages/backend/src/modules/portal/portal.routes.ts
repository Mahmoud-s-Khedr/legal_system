/**
 * Client portal read-only data routes.
 * All routes require a valid portal JWT (audience "elms-portal").
 * Clients can only see their own firm's cases and invoices.
 */
import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/prisma.js";

const PORTAL_COOKIE = "elms_portal_token";
const PORTAL_AUDIENCE = "elms-portal";

interface PortalContext {
  clientId: string;
  firmId: string;
}

async function requirePortalAuth(
  app: FastifyInstance,
  request: import("fastify").FastifyRequest,
  reply: import("fastify").FastifyReply
): Promise<PortalContext | null> {
  const token = request.cookies[PORTAL_COOKIE];
  if (!token) {
    await reply.status(401).send({ message: "Portal authentication required" });
    return null;
  }
  try {
    const payload = await app.jwt.verify<{ sub: string; firmId: string; clientId: string; aud: string }>(token);
    if (payload.aud !== PORTAL_AUDIENCE) {
      await reply.status(401).send({ message: "Invalid token audience" });
      return null;
    }
    return { clientId: payload.clientId, firmId: payload.firmId };
  } catch {
    await reply.status(401).send({ message: "Invalid or expired portal token" });
    return null;
  }
}

export async function registerPortalRoutes(app: FastifyInstance) {
  // ── Cases ────────────────────────────────────────────────────────────────────

  app.get("/api/portal/cases", async (request, reply) => {
    const ctx = await requirePortalAuth(app, request, reply);
    if (!ctx) return;

    const cases = await prisma.case.findMany({
      where: { clientId: ctx.clientId, firmId: ctx.firmId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        caseNumber: true,
        type: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        sessions: {
          where: { sessionDatetime: { gte: new Date() } },
          orderBy: { sessionDatetime: "asc" },
          take: 1,
          select: { sessionDatetime: true, outcome: true }
        }
      }
    });

    return cases.map((c) => ({
      id: c.id,
      title: c.title,
      caseNumber: c.caseNumber,
      type: c.type,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      nextHearing: c.sessions[0]?.sessionDatetime ?? null
    }));
  });

  app.get("/api/portal/cases/:caseId", async (request, reply) => {
    const ctx = await requirePortalAuth(app, request, reply);
    if (!ctx) return;

    const { caseId } = request.params as { caseId: string };
    const c = await prisma.case.findFirst({
      where: { id: caseId, clientId: ctx.clientId, firmId: ctx.firmId, deletedAt: null },
      include: {
        courts: { orderBy: { stageOrder: "asc" } },
        sessions: {
          orderBy: { sessionDatetime: "desc" },
          take: 10,
          select: { id: true, sessionDatetime: true, nextSessionAt: true, outcome: true, notes: true }
        },
        assignments: {
          include: {
            user: { select: { fullName: true, email: true } }
          }
        }
      }
    });

    if (!c) return reply.status(404).send({ error: "Case not found" });

    return {
      id: c.id,
      title: c.title,
      caseNumber: c.caseNumber,
      type: c.type,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      courts: c.courts,
      hearings: c.sessions.map((s) => ({
        id: s.id,
        sessionDatetime: s.sessionDatetime,
        nextSessionAt: s.nextSessionAt,
        outcome: s.outcome,
        // Notes are not exposed to clients
      })),
      lawyers: c.assignments.map((a) => ({
        fullName: a.user.fullName,
        role: a.roleOnCase
      }))
    };
  });

  // ── Invoices ─────────────────────────────────────────────────────────────────

  app.get("/api/portal/invoices", async (request, reply) => {
    const ctx = await requirePortalAuth(app, request, reply);
    if (!ctx) return;

    const invoices = await prisma.invoice.findMany({
      where: { clientId: ctx.clientId, firmId: ctx.firmId },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        issuedAt: true,
        dueDate: true,
        subtotalAmount: true,
        taxAmount: true,
        discountAmount: true
      }
    });

    return invoices;
  });
}
