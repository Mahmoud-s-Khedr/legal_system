import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { ensureSystemSecurityModel } from "../src/security/bootstrap.js";
import { ensureSystemLookupOptions } from "../src/security/lookupSeed.js";
import { ensureSystemLibraryCategories } from "../src/security/librarySeed.js";
import { seedDevEnvironment } from "../src/security/devSeed.js";
import { ensureEgyptLocationLookups } from "../src/security/locationSeed.js";

const prisma = new PrismaClient();

async function ensureOperatorBootstrap() {
  const email = process.env.ELMS_OPERATOR_BOOTSTRAP_EMAIL?.trim();
  const password = process.env.ELMS_OPERATOR_BOOTSTRAP_PASSWORD;
  const displayName = process.env.ELMS_OPERATOR_BOOTSTRAP_NAME?.trim() || "Platform Operator";

  if (!email || !password) {
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.operatorUser.upsert({
    where: { email },
    create: { email, passwordHash, displayName, status: "ACTIVE" },
    update: { passwordHash, displayName }
  });
  console.log(`[seed] phase=operator-bootstrap email=${email}`);
}

async function main() {
  const shouldRefreshAnalytics =
    process.env.ELMS_SEED_ANALYTICS_REFRESH === "true" ||
    process.env.ELMS_SEED_ANALYTICS_REFRESH === "1";
  const profile = process.env.ELMS_SEED_PROFILE === "minimal" ? "minimal" : "full";
  const includeIntegrations = process.env.ELMS_SEED_INCLUDE_INTEGRATIONS !== "false";
  const seedValue = process.env.ELMS_SEED_VALUE ?? "elms-dev-seed";

  console.log(`[seed] profile=${profile} includeIntegrations=${includeIntegrations} seed=${seedValue}`);
  console.log("[seed] phase=system");

  await ensureSystemSecurityModel(prisma);
  console.log("[seed] phase=reference");
  await ensureSystemLookupOptions(prisma);
  await ensureSystemLibraryCategories(prisma);
  await ensureEgyptLocationLookups(prisma);
  await ensureOperatorBootstrap();

  if (process.env.NODE_ENV === "development") {
    console.log("[seed] phase=tenant-core/tenant-edge/integration-fixtures");
    await seedDevEnvironment(prisma, { analyticsRefresh: shouldRefreshAnalytics });
    if (shouldRefreshAnalytics) {
      console.log("[seed] phase=analytics");
    }
  }
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    const isDbUnreachable =
      message.includes("Can't reach database server") ||
      message.includes("ECONNREFUSED");

    if (isDbUnreachable) {
      console.error("\n[seed] Database is not reachable. Start the backend dev server first, then rerun:");
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
