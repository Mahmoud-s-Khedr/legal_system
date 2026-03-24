/**
 * Standalone BullMQ worker entrypoint for cloud library extraction.
 * Run separately from the main Fastify server process.
 * Start with: node dist/jobs/libraryExtractionWorker.js
 */
import { Worker, Queue } from "bullmq";
import { loadEnv } from "../config/env.js";
import { createStorageAdapter } from "../storage/index.js";
import { runLibraryExtraction } from "./runLibraryExtraction.js";
import type { LibraryExtractionJobData } from "./libraryExtractionQueue.js";

const env = loadEnv();
const storage = createStorageAdapter(env);

const MAX_ATTEMPTS = 3;

const deadLetterQueue = new Queue<LibraryExtractionJobData & { originalJobId: string | undefined; error: string }>(
  "library-extraction-dlq",
  {
    connection: { url: env.REDIS_URL },
    defaultJobOptions: { removeOnComplete: { count: 500 }, removeOnFail: { count: 500 } }
  }
);

const worker = new Worker<LibraryExtractionJobData>(
  "library-extraction",
  async (job) => {
    await runLibraryExtraction(job.data.libraryDocumentId, env, storage);
  },
  {
    connection: { url: env.REDIS_URL },
    concurrency: 3,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 }
  }
);

worker.on("completed", (job) => {
  console.log(`[library-extraction-worker] job ${job.id} completed for document ${job.data.libraryDocumentId}`);
});

worker.on("failed", async (job, err) => {
  console.error(`[library-extraction-worker] job ${job?.id} failed (attempt ${job?.attemptsMade ?? "?"}/${MAX_ATTEMPTS}): ${err.message}`);

  if (job && job.attemptsMade >= MAX_ATTEMPTS) {
    console.error(`[library-extraction-worker] job ${job.id} exhausted all retries — moving to DLQ`);
    await deadLetterQueue.add("failed-library-extraction", {
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
