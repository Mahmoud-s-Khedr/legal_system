import { defineConfig } from "vitest/config";

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
        "src/index.ts",
        "src/dtos/**",
        "src/types/**"
      ],
      thresholds: {
        lines: 70,
        branches: 65,
        functions: 70,
        statements: 70
      }
    }
  }
});
