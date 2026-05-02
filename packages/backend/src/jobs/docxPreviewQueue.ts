import { Queue } from "bullmq";
import type { AppEnv } from "../config/env.js";

export interface DocxPreviewJobData {
  documentId: string;
  firmId: string;
}

let queue: Queue<DocxPreviewJobData> | null = null;

export function getDocxPreviewQueue(env: AppEnv): Queue<DocxPreviewJobData> {
  if (!queue) {
    queue = new Queue<DocxPreviewJobData>("docx-preview", {
      connection: { url: env.REDIS_URL },
      defaultJobOptions: {
        attempts: env.EXTRACTION_QUEUE_ATTEMPTS,
        backoff: { type: "exponential", delay: env.EXTRACTION_QUEUE_BACKOFF_MS }
      }
    });
  }
  return queue;
}
