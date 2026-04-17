import { prisma } from "../db/prisma.js";
import { withTenant } from "../db/tenant.js";
import type { RepositoryTx } from "./types.js";

export async function inTenantTransaction<T>(firmId: string, run: (tx: RepositoryTx) => Promise<T>): Promise<T> {
  return withTenant(prisma, firmId, run);
}
