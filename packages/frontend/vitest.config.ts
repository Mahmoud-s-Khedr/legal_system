import { defineConfig } from "vitest/config";
import { getPackageCoverageThresholds } from "../../scripts/coverage/threshold-policy.mjs";

const thresholds = getPackageCoverageThresholds("@elms/frontend");

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.spec.ts", "src/**/*.spec.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/*.spec.ts",
        "src/**/*.spec.tsx",
        "src/**/*.d.ts",
        "src/main.tsx"
      ],
      thresholds
    }
  }
});
