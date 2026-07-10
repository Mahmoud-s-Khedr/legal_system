import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import { requireOperatorAuth } from "../../middleware/requireOperatorAuth.js";
import { prisma } from "../../db/prisma.js";
import {
  manuallyExtendFirmTrial,
  manuallyReinstateFirm,
  manuallySuspendFirm
} from "../editions/lifecycle.service.js";

const mrrSchema = z.object({
  mrr: z.number().min(0)
});

const extendTrialSchema = z.object({
  days: z.number().int().positive()
});

export const operatorAdminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preValidation", requireOperatorAuth);

  app.get("/api/operator/firms", async (_request, reply) => {
    const firms = await prisma.firm.findMany({
      orderBy: { createdAt: "desc" },
      include: { settings: true }
    });

    return reply.send({ firms });
  });

  app.get("/api/operator/firms/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const firm = await prisma.firm.findUnique({
      where: { id },
      include: { settings: true }
    });

    if (!firm) {
      return reply.status(404).send({ message: "Firm not found" });
    }

    return reply.send({ firm });
  });

  app.patch("/api/operator/firms/:id/mrr", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { mrr } = mrrSchema.parse(request.body);

    const firm = await prisma.firm.update({
      where: { id },
      data: { manualMrr: mrr }
    });

    return reply.send({ firm });
  });

  app.post("/api/operator/firms/:id/suspend", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await manuallySuspendFirm(id);
    const firm = await prisma.firm.findUniqueOrThrow({ where: { id } });
    return reply.send({ firm });
  });

  app.post("/api/operator/firms/:id/reinstate", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await manuallyReinstateFirm(id);
    const firm = await prisma.firm.findUniqueOrThrow({ where: { id } });
    return reply.send({ firm });
  });

  app.post("/api/operator/firms/:id/extend-trial", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { days } = extendTrialSchema.parse(request.body);
    await manuallyExtendFirmTrial(id, days);
    const firm = await prisma.firm.findUniqueOrThrow({ where: { id } });
    return reply.send({ firm });
  });

  app.get("/api/operator/stats", async (_request, reply) => {
    const [activeFirms, totalFirms, mrrAggregate] = await Promise.all([
      prisma.firm.count({ where: { lifecycleStatus: "ACTIVE", deletedAt: null } }),
      prisma.firm.count({ where: { deletedAt: null } }),
      prisma.firm.aggregate({
        _sum: { manualMrr: true },
        where: { deletedAt: null, lifecycleStatus: { in: ["ACTIVE", "GRACE", "LICENSED"] } }
      })
    ]);

    return reply.send({
      activeFirms,
      totalFirms,
      mrrTotal: Number(mrrAggregate._sum.manualMrr ?? 0),
      billingMode: app.appEnv.SAAS_BILLING_MODE
    });
  });
};
