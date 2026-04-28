import { Queue } from "bullmq";
import type { AppEnv } from "../config/env.js";

export interface ExtractionJobData {
  documentId: string;
  firmId: string;
}

let queue: Queue<ExtractionJobData> | null = null;

export function getExtractionQueue(env: AppEnv): Queue<ExtractionJobData> {
  if (!queue) {
    queue = new Queue<ExtractionJobData>("document-extraction", {
      connection: { url: env.REDIS_URL },
      defaultJobOptions: {
        attempts: env.EXTRACTION_QUEUE_ATTEMPTS,
        backoff: { type: "exponential", delay: env.EXTRACTION_QUEUE_BACKOFF_MS }
      }
    });
  }
  return queue;
}
