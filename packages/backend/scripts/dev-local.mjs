import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(scriptDir, "..");
const schemaPath = resolve(backendRoot, "prisma/schema.prisma");
const generatedClientPath = resolve(backendRoot, "node_modules/.prisma/client/index.js");
const envFile = process.argv[2] ?? "../../apps/desktop/.env.desktop";
const SHUTDOWN_GRACE_MS = 3_000;

function needsPrismaGenerate() {
  if (!existsSync(generatedClientPath)) {
    return true;
  }

  if (!existsSync(schemaPath)) {
    return false;
  }

  const schemaStat = statSync(schemaPath);
  const clientStat = statSync(generatedClientPath);
  return schemaStat.mtimeMs > clientStat.mtimeMs;
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: backendRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });

    child.on("error", (error) => {
      rejectPromise(error);
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }

      resolvePromise(code ?? 0);
    });
  });
}

async function main() {
  if (needsPrismaGenerate()) {
    console.log("[backend-dev] prisma client missing or stale, running prisma generate");
    const prismaCode = await run("pnpm", ["prisma", "generate"]);
    if (prismaCode !== 0) {
      process.exit(prismaCode);
    }
  } else {
    console.log("[backend-dev] prisma client up to date, skipping prisma generate");
  }

  const srcPath = resolve(backendRoot, "src");

  let serverProcess = null;
  let restartTimer = null;
  let watcher = null;
  let shuttingDown = false;
  let shutdownPromise = null;
  let lifecycleTail = Promise.resolve();

  function enqueueLifecycle(task) {
    const nextTask = lifecycleTail.then(task, task);
    lifecycleTail = nextTask.catch(() => {});
    return nextTask;
  }

  async function stopServer(signal = "SIGTERM") {
    if (!serverProcess) {
      return;
    }

    const dying = serverProcess;
    serverProcess = null;

    if (dying.exitCode !== null || dying.signalCode !== null) {
      return;
    }

    const exitPromise = new Promise((resolve) => {
      dying.once("exit", resolve);
      dying.once("error", resolve);
    });

    dying.kill(signal);
    const forceKillTimer = setTimeout(() => {
      if (dying.exitCode === null && dying.signalCode === null) {
        console.warn(`[backend-dev] Server did not exit after ${signal}; forcing shutdown`);
        dying.kill("SIGKILL");
      }
    }, SHUTDOWN_GRACE_MS);

    try {
      await exitPromise;
    } finally {
      clearTimeout(forceKillTimer);
    }
  }

  async function startServer() {
    if (shuttingDown) {
      return;
    }

    await stopServer();
    if (shuttingDown) {
      return;
    }

    console.log("[backend-dev] Starting server...");
    const child = spawn("node", ["--import", "tsx/esm", "--env-file", envFile, "src/server.ts"], {
      cwd: backendRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    serverProcess = child;

    child.on("exit", (code, signal) => {
      if (serverProcess === child) {
        serverProcess = null;
      }
      if (shuttingDown) return;
      if (signal === "SIGTERM" || signal === "SIGINT") return;
      if (code !== 0) {
        console.error(`[backend-dev] Server exited with code ${code}`);
      }
    });
  }

  function scheduleRestart() {
    if (shuttingDown) {
      return;
    }

    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      if (shuttingDown) {
        return;
      }
      console.log("[backend-dev] Source changed, restarting server...");
      void enqueueLifecycle(startServer);
    }, 300);
  }

  watcher = watch(srcPath, { recursive: true }, (_, filename) => {
    if (filename && filename.endsWith(".ts")) {
      scheduleRestart();
    }
  });

  async function shutdown(signal) {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shuttingDown = true;
    console.log(`[backend-dev] Received ${signal}, shutting down`);

    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }

    if (watcher) {
      watcher.close();
      watcher = null;
    }

    shutdownPromise = enqueueLifecycle(async () => {
      await stopServer(signal);
    });

    return shutdownPromise;
  }

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM").finally(() => {
      process.exit(0);
    });
  });

  process.on("SIGINT", () => {
    void shutdown("SIGINT").finally(() => {
      process.exit(0);
    });
  });

  await enqueueLifecycle(startServer);

  // Keep the process alive until killed
  await new Promise(() => {});
}

main().catch((error) => {
  console.error("[backend-dev] failed to start local dev server:", error);
  process.exit(1);
});
