import { PrismaClient } from "@prisma/client";
import { ensureSystemSecurityModel } from "../src/security/bootstrap.js";
import { ensureSystemLookupOptions } from "../src/security/lookupSeed.js";
import { ensureSystemLibraryCategories } from "../src/security/librarySeed.js";
import { seedDevEnvironment } from "../src/security/devSeed.js";

const prisma = new PrismaClient();

async function main() {
  const shouldRefreshAnalytics =
    process.env.ELMS_SEED_ANALYTICS_REFRESH === "true" ||
    process.env.ELMS_SEED_ANALYTICS_REFRESH === "1";

  await ensureSystemSecurityModel(prisma);
  await ensureSystemLookupOptions(prisma);
  await ensureSystemLibraryCategories(prisma);

  if (process.env.NODE_ENV === "development") {
    await seedDevEnvironment(prisma, { analyticsRefresh: shouldRefreshAnalytics });
  }
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    const isDbUnreachable =
      message.includes("Can't reach database server") ||
      message.includes("ECONNREFUSED") ||
      message.includes("127.0.0.1:5433");

    if (isDbUnreachable) {
      console.error("\n[seed] Database is not reachable at 127.0.0.1:5433.");
      console.error("[seed] Start the desktop local backend first (it boots embedded Postgres), then rerun:");
      console.error("  1) pnpm --filter @elms/backend dev:local");
      console.error("  2) pnpm seed:analytics");
      console.error("[seed] Or point DATABASE_URL to a running PostgreSQL instance.\n");
    }
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
