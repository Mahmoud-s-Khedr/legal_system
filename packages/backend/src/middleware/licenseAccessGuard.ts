import { FirmLifecycleStatus } from "@elms/shared";
import type { FastifyInstance } from "fastify";
import { isTrialEnabled } from "../modules/editions/editionPolicy.js";

const SETTINGS_ONLY_ALLOWED_PATHS = new Set([
  "/api/auth/me",
  "/api/auth/logout",
  "/api/firms/me",
  "/api/firms/me/subscription",
  "/api/firms/me/edition-change-request",
  "/api/licenses/activate",
  "/api/users/:id",
  "/api/users/me/password",
  "/api/notifications/preferences"
]);

export function registerLicenseAccessGuard(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const actor = request.sessionUser;
    if (!actor) {
      return;
    }

    const routeUrl = request.routeOptions.url ?? "";
    if (SETTINGS_ONLY_ALLOWED_PATHS.has(routeUrl)) {
      return;
    }

    const isLicensed = actor.lifecycleStatus === FirmLifecycleStatus.LICENSED;
    if (isLicensed) {
      return;
    }

    const trialEnabled = isTrialEnabled(actor.editionKey);

    if (trialEnabled) {
      return;
    }

    await reply.status(403).send({
      code: "LICENSE_REQUIRED",
      message: "License activation required. Access is limited to settings until activation."
    });
  });
}
