import type { AppEnv } from "../config/env.js";
import type { IStorageAdapter } from "../storage/IStorageAdapter.js";
import { runDocxPreview } from "./runDocxPreview.js";
import { getDocxPreviewQueue } from "./docxPreviewQueue.js";

type LocalPreviewTask = {
  documentId: string;
  firmId: string;
  env: AppEnv;
  storage: IStorageAdapter;
};

const localPreviewQueue: LocalPreviewTask[] = [];
let localQueueDraining = false;

async function drainLocalPreviewQueue(): Promise<void> {
  while (localPreviewQueue.length > 0) {
    const task = localPreviewQueue.shift();
    if (!task) {
      continue;
    }

    try {
      await runDocxPreview(task.documentId, task.firmId, task.env, task.storage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[docx-preview] local preview task failed", {
        documentId: task.documentId,
        errorMessage: message
      });
    }
  }

  localQueueDraining = false;

  if (localPreviewQueue.length > 0 && !localQueueDraining) {
    localQueueDraining = true;
    setImmediate(() => {
      void drainLocalPreviewQueue();
    });
  }
}

function enqueueLocalPreview(task: LocalPreviewTask): void {
  localPreviewQueue.push(task);

  if (localQueueDraining) {
    return;
  }

  localQueueDraining = true;
  setImmediate(() => {
    void drainLocalPreviewQueue();
  });
}

export async function dispatchDocxPreview(
  documentId: string,
  firmId: string,
  env: AppEnv,
  storage: IStorageAdapter
): Promise<void> {
  if (!env.DOCX_PREVIEW_ENABLED) {
    return;
  }

  if (env.STORAGE_DRIVER === "local") {
    enqueueLocalPreview({ documentId, firmId, env, storage });
    return;
  }

  await getDocxPreviewQueue(env).add("docx-preview", { documentId, firmId });
}
