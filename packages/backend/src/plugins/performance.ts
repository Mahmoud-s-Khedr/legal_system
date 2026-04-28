import type { FastifyInstance } from "fastify";
import { recordEndpointTiming } from "../monitoring/performance.js";

export async function registerPerformanceHooks(app: FastifyInstance, enabled: boolean) {
  if (!enabled) {
    return;
  }

  app.addHook("onRequest", (request, _reply, done) => {
    request.startTime = process.hrtime.bigint();
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    const start = request.startTime;
    if (start) {
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      const route = request.routeOptions.url ?? request.url;
      const key = `${request.method} ${route}`;
      recordEndpointTiming(key, elapsedMs, reply.statusCode >= 500);
    }
    done();
  });
}

