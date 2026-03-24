import { PrismaClient } from "@prisma/client";
import { ensureSystemSecurityModel } from "../src/security/bootstrap.js";
import { ensureSystemLookupOptions } from "../src/security/lookupSeed.js";
import { ensureSystemLibraryCategories } from "../src/security/librarySeed.js";
import { seedDevEnvironment } from "../src/security/devSeed.js";

const prisma = new PrismaClient();

async function main() {
  await ensureSystemSecurityModel(prisma);
  await ensureSystemLookupOptions(prisma);
  await ensureSystemLibraryCategories(prisma);

  if (process.env.NODE_ENV === "development") {
    await seedDevEnvironment(prisma);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
