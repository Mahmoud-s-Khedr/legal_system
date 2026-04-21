import { defineConfig } from "vitest/config";
import { getPackageCoverageThresholds } from "../../scripts/coverage/threshold-policy.mjs";

const thresholds = getPackageCoverageThresholds("@elms/backend");

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/**/*.d.ts",
        "src/index.ts",
        "src/server.ts",
        "src/security/bootstrap.ts",
        "src/security/devSeed.ts",
        "src/security/librarySeed.ts",
        "src/security/lookupSeed.ts",
        "prisma/**"
      ],
      thresholds
    }
  }
});
