import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerCorsPlugin } from "./cors.js";
import type { AppEnv } from "../config/env.js";

function createEnv(overrides: Partial<AppEnv> = {}): AppEnv {
  return {
    NODE_ENV: "production",
    AUTH_MODE: "local",
    STORAGE_DRIVER: "local",
    HOST: "127.0.0.1",
    BACKEND_PORT: 7854,
    FRONTEND_PORT: 5173,
    DATABASE_URL: "postgresql://elms:elms@127.0.0.1:5433/elms_desktop?schema=public",
    REDIS_URL: "redis://127.0.0.1:6379",
    COOKIE_DOMAIN: "localhost",
    ACCESS_TOKEN_TTL_MINUTES: 15,
    REFRESH_TOKEN_TTL_DAYS: 30,
    LOCAL_SESSION_TTL_HOURS: 12,
    JWT_PRIVATE_KEY: "test-private",
    JWT_PUBLIC_KEY: "test-public",
    DESKTOP_FRONTEND_URL: "http://127.0.0.1:5173",
    DESKTOP_BACKEND_URL: "http://127.0.0.1:7854",
    DESKTOP_POSTGRES_PORT: 5433,
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

describe("registerCorsPlugin desktop origins", () => {
  afterEach(() => {
    delete process.env.ELMS_DESKTOP_BOOTSTRAP_TOKEN;
    vi.restoreAllMocks();
  });

  it("accepts desktop bootstrap requests from http://tauri.localhost", async () => {
    process.env.ELMS_DESKTOP_BOOTSTRAP_TOKEN = "desktop-token";
    const app = await buildCorsApp(createEnv({ NODE_ENV: "production" }));

    const response = await app.inject({
      method: "GET",
      url: "/ping",
      headers: { origin: "http://tauri.localhost" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("http://tauri.localhost");

    await app.close();
  });

  it("accepts Origin:null only for desktop bootstrap runtime", async () => {
    process.env.ELMS_DESKTOP_BOOTSTRAP_TOKEN = "desktop-token";
    const app = await buildCorsApp(createEnv({ NODE_ENV: "production" }));

    const response = await app.inject({
      method: "GET",
      url: "/ping",
      headers: { origin: "null" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("null");

    await app.close();
  });

  it("rejects Origin:null for non-desktop production runtime", async () => {
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
});
