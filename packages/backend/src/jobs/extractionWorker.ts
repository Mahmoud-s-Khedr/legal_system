/**
 * Standalone BullMQ worker entrypoint for cloud extraction.
 * Run separately from the main Fastify server process.
 * Start with: node dist/jobs/extractionWorker.js
 */
import { Worker, Queue } from "bullmq";
import { loadEnv } from "../config/env.js";
import { createStorageAdapter } from "../storage/index.js";
import { runExtraction } from "./runExtraction.js";
import type { ExtractionJobData } from "./extractionQueue.js";

const env = loadEnv();
const storage = createStorageAdapter(env);

const MAX_ATTEMPTS = 3;

const deadLetterQueue = new Queue<ExtractionJobData & { originalJobId: string | undefined; error: string }>(
  "document-extraction-dlq",
  {
    connection: { url: env.REDIS_URL },
    defaultJobOptions: { removeOnComplete: { count: 500 }, removeOnFail: { count: 500 } }
  }
);

const worker = new Worker<ExtractionJobData>(
  "document-extraction",
  async (job) => {
    await runExtraction(job.data.documentId, env, storage);
  },
  {
    connection: { url: env.REDIS_URL },
    concurrency: 3,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 }
  }
);

worker.on("completed", (job) => {
  console.log(`[extraction-worker] job ${job.id} completed for document ${job.data.documentId}`);
});

worker.on("failed", async (job, err) => {
  console.error(`[extraction-worker] job ${job?.id} failed (attempt ${job?.attemptsMade ?? "?"}/${MAX_ATTEMPTS}): ${err.message}`);

  // Move to dead-letter queue after all retries are exhausted
  if (job && job.attemptsMade >= MAX_ATTEMPTS) {
    console.error(`[extraction-worker] job ${job.id} exhausted all retries — moving to DLQ`);
    await deadLetterQueue.add("failed-extraction", {
      ...job.data,
      originalJobId: job.id,
      error: err.message
    });
  }
});

process.on("SIGTERM", async () => {
  await worker.close();
  await deadLetterQueue.close();
  process.exit(0);
});
