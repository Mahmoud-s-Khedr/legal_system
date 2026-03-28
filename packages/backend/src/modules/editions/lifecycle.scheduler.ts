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

export async function startEditionLifecycleScheduler(env: AppEnv): Promise<void> {
  try {
    if (env.AUTH_MODE !== AuthMode.LOCAL) {
      console.warn("[edition-lifecycle] cloud scheduler is deprecated; forcing local scheduler");
    }
    await startDesktopScheduler();
  } catch (error) {
    console.error("[edition-lifecycle] failed to start scheduler", error);
  }
}
