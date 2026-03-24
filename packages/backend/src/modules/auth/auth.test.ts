import { describe, expect, it } from "vitest";
import { loadEnv } from "../../config/env.js";

describe("loadEnv", () => {
  it("provides development jwt keys when env is missing", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      AUTH_MODE: "cloud",
      STORAGE_DRIVER: "local",
      DATABASE_URL: "postgresql://example"
    });

    expect(env.JWT_PRIVATE_KEY).toContain("BEGIN PRIVATE KEY");
    expect(env.JWT_PUBLIC_KEY).toContain("BEGIN PUBLIC KEY");
  });
});
