import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { startReminderScheduler } from "./modules/notifications/reminder.scheduler.js";
import { startEditionLifecycleScheduler } from "./modules/editions/lifecycle.scheduler.js";

function maskDatabaseUrl(databaseUrl: string): string {
  const atIndex = databaseUrl.lastIndexOf("@");
  if (atIndex === -1) {
    return "[redacted]";
  }

  return `***${databaseUrl.slice(atIndex)}`;
}

async function start() {
  const startedAt = Date.now();
  console.info("[backend-startup] Starting backend process");

  const env = loadEnv();
  console.info("[backend-startup] Environment parsed", {
    nodeEnv: env.NODE_ENV,
    authMode: env.AUTH_MODE,
    host: env.HOST,
    port: env.BACKEND_PORT,
    databaseUrl: maskDatabaseUrl(env.DATABASE_URL)
  });

  console.info("[backend-startup] Creating Fastify app");
  const app = await createApp(env);
  console.info("[backend-startup] Fastify app created");

  console.info("[backend-startup] Binding HTTP listener", {
    host: env.HOST,
    port: env.BACKEND_PORT
  });
  await app.listen({
    host: env.HOST,
    port: env.BACKEND_PORT
  });

  console.info("[backend-startup] Backend is healthy and listening", {
    url: `http://${env.HOST}:${env.BACKEND_PORT}`,
    startupMs: Date.now() - startedAt
  });

  // Start reminder scheduler (non-blocking — scheduler errors are logged, not fatal)
  void startReminderScheduler(env);
  void startEditionLifecycleScheduler(env);

  const shutdown = async (signal: string) => {
    console.info(`[backend-startup] Received ${signal}, shutting down`);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

start().catch((error) => {
  console.error("[backend-startup] Fatal startup error", error);
  process.exitCode = 1;
});
