import { PrismaClient } from "@prisma/client";

declare global {
  var __elmsPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__elmsPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__elmsPrisma = prisma;
}
