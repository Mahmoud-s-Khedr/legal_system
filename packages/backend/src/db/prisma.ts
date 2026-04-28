import { PrismaClient } from "@prisma/client";
import { recordDbTiming } from "../monitoring/performance.js";

declare global {
  var __elmsPrisma: PrismaClient | undefined;
}

const basePrisma =
  globalThis.__elmsPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

const slowQueryThresholdMs = Number(process.env.PERFORMANCE_DB_SLOW_QUERY_MS ?? "200");
const prismaWithMiddleware = basePrisma as any;
if (typeof prismaWithMiddleware.$use === "function") {
  prismaWithMiddleware.$use(async (params: any, next: any) => {
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
