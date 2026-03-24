import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

export async function applyTenantContext(prisma: PrismaClient, firmId: string) {
  await prisma.$executeRaw`SELECT set_config('app.current_firm_id', ${firmId}, true)`;
}

export async function withTenant<T>(
  prisma: PrismaClient,
  firmId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_firm_id', ${firmId}, true)`;
    return fn(tx);
  });
}
