import { AuthMode } from "@elms/shared";
import type { AppEnv } from "../../config/env.js";
import { runFirmLifecycleSweep } from "./lifecycle.service.js";

async function runSweepWithLogging() {
  const sweep = await runFirmLifecycleSweep();
  console.info("[edition-lifecycle] sweep completed", sweep);
}

async function startDesktopScheduler() {
  const { default: cron } = await import("node-cron");

  cron.schedule("5 2 * * *", async () => {
    try {
      await runSweepWithLogging();
    } catch (error) {
      console.error("[edition-lifecycle] desktop scheduler error", error);
    }
  });

  console.info("[edition-lifecycle] desktop scheduler started");
}

async function startCloudScheduler(env: AppEnv) {
  const { Queue, Worker } = await import("bullmq");

  const queue = new Queue("edition-lifecycle-scan", {
    connection: { url: env.REDIS_URL },
    defaultJobOptions: { removeOnComplete: 10, removeOnFail: 10 }
  });

  const waiting = await queue.getWaiting();
  if (waiting.length === 0) {
    await queue.add("daily-sweep", {}, { repeat: { pattern: "5 2 * * *" } });
  }

  new Worker(
    "edition-lifecycle-scan",
    async () => {
      await runSweepWithLogging();
    },
    { connection: { url: env.REDIS_URL }, concurrency: 1 }
  );

  console.info("[edition-lifecycle] cloud scheduler started");
}

export async function startEditionLifecycleScheduler(env: AppEnv): Promise<void> {
  try {
    if (env.AUTH_MODE === AuthMode.LOCAL) {
      await startDesktopScheduler();
    } else {
      await startCloudScheduler(env);
    }
  } catch (error) {
    console.error("[edition-lifecycle] failed to start scheduler", error);
  }
}
