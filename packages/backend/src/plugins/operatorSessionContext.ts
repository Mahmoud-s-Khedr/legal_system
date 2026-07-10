import type { FastifyInstance } from "fastify";
import { OPERATOR_ACCESS_COOKIE } from "../config/constants.js";
import { prisma } from "../db/prisma.js";
import type { OperatorAccessTokenClaims, OperatorSessionUser } from "../modules/operator/operator.types.js";
import { getOperatorJwt } from "./operatorAuth.js";

export function registerOperatorSessionContext(app: FastifyInstance) {
  app.decorateRequest("operatorUser", null);

  // Registered as preValidation (not preHandler) so it resolves before any
  // route's `preValidation: [requireOperatorAuth]` guard runs — Fastify runs
  // all preValidation hooks (global, then route-level) before any preHandler.
  app.addHook("preValidation", async (request) => {
    request.operatorUser = await resolveOperatorUser(app, request.cookies);
  });
}

async function resolveOperatorUser(
  app: FastifyInstance,
  cookies: Record<string, string | undefined>
): Promise<OperatorSessionUser | null> {
  const accessToken = cookies[OPERATOR_ACCESS_COOKIE];
  if (!accessToken) {
    return null;
  }

  try {
    const claims = await getOperatorJwt(app).verify<OperatorAccessTokenClaims>(accessToken, {
      allowedAud: "elms-operator"
    });

    const operator = await prisma.operatorUser.findUnique({
      where: { id: claims.sub }
    });

    if (!operator || operator.status !== "ACTIVE") {
      return null;
    }

    return {
      id: operator.id,
      email: operator.email,
      displayName: operator.displayName,
      status: operator.status
    };
  } catch {
    return null;
  }
}
