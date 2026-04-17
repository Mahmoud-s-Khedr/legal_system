import type { AppEnv } from "../config/env.js";
import type { IStorageAdapter } from "../storage/IStorageAdapter.js";
import { runExtraction } from "./runExtraction.js";
import { getExtractionQueue } from "./extractionQueue.js";

type LocalExtractionTask = {
  documentId: string;
  env: AppEnv;
  storage: IStorageAdapter;
};

const localExtractionQueue: LocalExtractionTask[] = [];
let localQueueDraining = false;

async function drainLocalExtractionQueue(): Promise<void> {
  while (localExtractionQueue.length > 0) {
    const task = localExtractionQueue.shift();
    if (!task) {
      continue;
    }

    // Serialize local extraction to avoid allocator pressure from concurrent OCR workers.
    try {
      await runExtraction(task.documentId, task.env, task.storage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[extraction] local extraction task failed", {
        documentId: task.documentId,
        errorMessage: message
      });
    }
  }

  localQueueDraining = false;

  if (localExtractionQueue.length > 0 && !localQueueDraining) {
    localQueueDraining = true;
    setImmediate(() => {
      void drainLocalExtractionQueue();
    });
  }
}

function enqueueLocalExtraction(task: LocalExtractionTask): void {
  localExtractionQueue.push(task);

  if (localQueueDraining) {
    return;
  }

  localQueueDraining = true;
  setImmediate(() => {
    void drainLocalExtractionQueue();
  });
}

export async function dispatchExtraction(
  documentId: string,
  firmId: string,
  env: AppEnv,
  storage: IStorageAdapter
): Promise<void> {
  if (env.STORAGE_DRIVER === "local") {
    enqueueLocalExtraction({ documentId, env, storage });
  } else {
    await getExtractionQueue(env).add("extract", { documentId, firmId });
  }
}
