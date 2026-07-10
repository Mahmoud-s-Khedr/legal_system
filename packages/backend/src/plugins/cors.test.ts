import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { registerCorsPlugin } from "./cors.js";
import type { AppEnv } from "../config/env.js";

function createEnv(overrides: Partial<AppEnv> = {}): AppEnv {
  return {
    NODE_ENV: "production",
    AUTH_MODE: "cloud",
    STORAGE_DRIVER: "local",
    HOST: "127.0.0.1",
    BACKEND_PORT: 7854,
    FRONTEND_PORT: 5173,
    DATABASE_URL: "postgresql://elms:elms@127.0.0.1:5432/elms_cloud?schema=public",
    REDIS_URL: "redis://127.0.0.1:6379",
    COOKIE_DOMAIN: "localhost",
    FRONTEND_APP_URL: "https://app.elms.example",
    ACCESS_TOKEN_TTL_MINUTES: 15,
    REFRESH_TOKEN_TTL_DAYS: 30,
    LOCAL_SESSION_TTL_HOURS: 12,
    JWT_PRIVATE_KEY: "test-private",
    JWT_PUBLIC_KEY: "test-public",
    ELMS_ENABLE_SWAGGER: false,
    MAX_UPLOAD_BYTES: 1024,
    LOCAL_STORAGE_PATH: "./uploads",
    OCR_BACKEND: "tesseract",
    ALLOWED_ORIGINS: "",
    SMTP_PORT: 587,
    SMTP_FROM: "noreply@elms.app",
    SMS_PROVIDER: "none",
    ANTHROPIC_MODEL: "claude-sonnet-4-6",
    AI_MONTHLY_LIMIT: 500,
    ...overrides
  } as AppEnv;
}

async function buildCorsApp(env: AppEnv) {
  const app = Fastify();
  await registerCorsPlugin(app, env);
  app.get("/ping", async () => ({ ok: true }));
  await app.ready();
  return app;
}

describe("registerCorsPlugin", () => {
  afterEach(() => {
    // no-op — retained for symmetry with prior desktop-token cleanup
  });

  it("accepts the configured FRONTEND_APP_URL origin in production", async () => {
    const app = await buildCorsApp(createEnv({ NODE_ENV: "production" }));

    const response = await app.inject({
      method: "GET",
      url: "/ping",
      headers: { origin: "https://app.elms.example" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("https://app.elms.example");
    expect(response.headers["vary"]).toContain("Origin");

    await app.close();
  });

  it("accepts origins listed in ALLOWED_ORIGINS in production", async () => {
    const app = await buildCorsApp(
      createEnv({ NODE_ENV: "production", ALLOWED_ORIGINS: "https://extra.example" })
    );

    const response = await app.inject({
      method: "GET",
      url: "/ping",
      headers: { origin: "https://extra.example" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("https://extra.example");

    await app.close();
  });

  it("accepts localhost origins in development", async () => {
    const app = await buildCorsApp(createEnv({ NODE_ENV: "development" }));

    const response = await app.inject({
      method: "GET",
      url: "/ping",
      headers: { origin: "http://localhost:5173" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");

    await app.close();
  });

  it("rejects unknown origins in production when not explicitly allowed", async () => {
    const app = await buildCorsApp(
      createEnv({ NODE_ENV: "production", ALLOWED_ORIGINS: "" })
    );

    const response = await app.inject({
      method: "GET",
      url: "/ping",
      headers: { origin: "https://malicious.example" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();

    await app.close();
  });

  it("rejects Origin:null", async () => {
    const app = await buildCorsApp(createEnv({ NODE_ENV: "production" }));

    const response = await app.inject({
      method: "GET",
      url: "/ping",
      headers: { origin: "null" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();

    await app.close();
  });

  it("returns Fastify's default 404 for unmatched routes", async () => {
    const app = await buildCorsApp(createEnv({ NODE_ENV: "production" }));

    const response = await app.inject({
      method: "GET",
      url: "/does-not-exist",
      headers: { origin: "https://app.elms.example" }
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });
});
