import type { FastifyPluginAsync } from "fastify";
import { stripe } from "./stripe.js";
import { prisma } from "../../db/prisma.js";
import type Stripe from "stripe";

export const stripeWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/webhooks/stripe", { config: { rawBody: true } }, async (request, reply) => {
    if (request.server.appEnv.SAAS_BILLING_MODE !== "stripe") {
      return reply.code(409).send({ error: "Stripe billing is disabled for this environment" });
    }

    const signature = request.headers["stripe-signature"];
    const webhookSecret = request.server.appEnv.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret || !request.rawBody) {
      return reply.code(400).send({ error: "Missing signature, secret, or rawBody" });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(request.rawBody, signature, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      app.log.error(`Webhook signature verification failed: ${errorMessage}`);
      return reply.code(400).send({ error: "Webhook Error" });
    }

    try {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;

          await prisma.firmSettings.updateMany({
            where: { stripeCustomerId: customerId },
            data: {
              stripeSubscriptionId: subscription.id,
              billingCycle: subscription.items.data[0]?.plan?.interval || "month"
            }
          });

          // Update Firm lifecycle
          const settings = await prisma.firmSettings.findFirst({ where: { stripeCustomerId: customerId } });
          if (settings) {
            await prisma.firm.update({
              where: { id: settings.firmId },
              data: {
                lifecycleStatus: subscription.status === "active" || subscription.status === "trialing" ? "ACTIVE" : "SUSPENDED"
              }
            });
          }
          break;
        }
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;

          await prisma.firmSettings.updateMany({
            where: { stripeCustomerId: customerId },
            data: { stripeSubscriptionId: null }
          });

          const settings = await prisma.firmSettings.findFirst({ where: { stripeCustomerId: customerId } });
          if (settings) {
            await prisma.firm.update({
              where: { id: settings.firmId },
              data: { lifecycleStatus: "SUSPENDED" }
            });
          }
          break;
        }
      }
    } catch (err) {
      app.log.error({ err }, "Error processing Stripe webhook");
      return reply.code(500).send({ error: "Internal Server Error" });
    }

    return reply.code(200).send({ received: true });
  });
};
