import { FirmLifecycleStatus } from "@elms/shared";
import type { FastifyInstance } from "fastify";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const BLOCKED_STATUSES = new Set([
  FirmLifecycleStatus.SUSPENDED,
  FirmLifecycleStatus.PENDING_DELETION
]);
const ALLOWED_WRITE_PATHS = new Set(["/api/auth/logout"]);

export function registerFirmLifecycleWriteGuard(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    if (!WRITE_METHODS.has(request.method)) {
      return;
    }

    if (ALLOWED_WRITE_PATHS.has(request.routeOptions.url ?? "")) {
      return;
    }

    const actor = request.sessionUser;
    if (!actor) {
      return;
    }

    if (!BLOCKED_STATUSES.has(actor.lifecycleStatus)) {
      return;
    }

    await reply.status(423).send({
      message: "Firm subscription is not active for write operations"
    });
  });
}
