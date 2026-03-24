import type { FastifyReply, FastifyRequest } from "fastify";
import {
  hasEditionFeature,
  type EditionFeature
} from "../modules/editions/editionPolicy.js";

export function requireEditionFeature(feature: EditionFeature) {
  return async function enforceEditionFeature(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const actor = request.sessionUser;
    if (!actor) {
      return reply.status(401).send({ message: "Authentication required" });
    }

    if (!hasEditionFeature(actor.editionKey, feature)) {
      return reply.status(403).send({
        message: "Feature not available in current edition"
      });
    }
  };
}
