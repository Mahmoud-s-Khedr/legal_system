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
      defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
    });
  }
  return queue;
}
