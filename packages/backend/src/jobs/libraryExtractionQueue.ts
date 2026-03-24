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
      defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
    });
  }
  return queue;
}
