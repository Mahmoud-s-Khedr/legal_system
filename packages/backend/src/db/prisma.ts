import { PrismaClient } from "@prisma/client";
import { recordDbTiming } from "../monitoring/performance.js";

type PrismaMiddlewareParams = {
  model?: string;
  action?: string;
};

type PrismaWithUse = PrismaClient & {
  $use?: (
    middleware: (
      params: PrismaMiddlewareParams,
      next: (params: PrismaMiddlewareParams) => Promise<unknown>
    ) => Promise<unknown>
  ) => void;
};

declare global {
  var __elmsPrisma: PrismaClient | undefined;
}

const basePrisma =
  globalThis.__elmsPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

const slowQueryThresholdMs = Number(process.env.PERFORMANCE_DB_SLOW_QUERY_MS ?? "200");
const prismaWithMiddleware = basePrisma as PrismaWithUse;
if (typeof prismaWithMiddleware.$use === "function") {
  prismaWithMiddleware.$use(async (params, next) => {
    const startedAt = process.hrtime.bigint();
    const result = await next(params);
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const model = params?.model ?? "raw";
    const action = params?.action ?? "query";
    recordDbTiming(`${model}.${action}`, elapsedMs, slowQueryThresholdMs);
    return result;
  });
}

export const prisma = basePrisma;

if (process.env.NODE_ENV !== "production") {
  globalThis.__elmsPrisma = basePrisma;
}
