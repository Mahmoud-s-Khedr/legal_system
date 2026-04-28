import { Queue } from "bullmq";
import type { AppEnv } from "../config/env.js";

export interface LibraryExtractionJobData {
  libraryDocumentId: string;
  firmId: string;
}

let queue: Queue<LibraryExtractionJobData> | null = null;

export function getLibraryExtractionQueue(env: AppEnv): Queue<LibraryExtractionJobData> {
  if (!queue) {
    queue = new Queue<LibraryExtractionJobData>("library-extraction", {
      connection: { url: env.REDIS_URL },
      defaultJobOptions: {
        attempts: env.EXTRACTION_QUEUE_ATTEMPTS,
        backoff: { type: "exponential", delay: env.EXTRACTION_QUEUE_BACKOFF_MS }
      }
    });
  }
  return queue;
}
