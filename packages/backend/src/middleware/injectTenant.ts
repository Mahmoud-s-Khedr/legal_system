import type { FastifyInstance } from "fastify";

export function registerInjectTenantHook(app: FastifyInstance) {
  app.addHook("onRequest", async (request) => {
    delete request.headers["x-firm-id"];
  });
}
