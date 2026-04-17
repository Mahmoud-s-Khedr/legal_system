import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { type ActivateLicenseDto } from "@elms/shared";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { activateLicense, LicenseServiceError } from "./license.service.js";

const activateLicenseSchema = z.object({
  activationKey: z.string().min(10)
});

export async function registerLicenseRoutes(app: FastifyInstance) {
  app.post(
    "/api/licenses/activate",
    {
      preHandler: [requireAuth, requirePermission("settings:update")]
    },
    async (request, reply) => {
      const payload = activateLicenseSchema.parse(request.body) as ActivateLicenseDto;

      try {
        return await activateLicense(request.sessionUser!.firmId, payload.activationKey);
      } catch (error) {
        if (error instanceof LicenseServiceError) {
          return reply.status(error.statusCode).send({
            code: error.code,
            message: error.message
          });
        }
        throw error;
      }
    }
  );
}
