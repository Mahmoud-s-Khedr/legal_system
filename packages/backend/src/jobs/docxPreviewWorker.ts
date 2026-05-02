/**
 * Standalone BullMQ worker entrypoint for DOCX preview conversion.
 * Run separately from the main Fastify server process.
 * Start with: node dist/jobs/docxPreviewWorker.js
 */
import { Worker, Queue } from "bullmq";
import { loadEnv } from "../config/env.js";
import { createStorageAdapter } from "../storage/index.js";
import { runDocxPreview } from "./runDocxPreview.js";
import type { DocxPreviewJobData } from "./docxPreviewQueue.js";

const env = loadEnv();
const storage = createStorageAdapter(env);

const MAX_ATTEMPTS = env.EXTRACTION_QUEUE_ATTEMPTS;

const deadLetterQueue = new Queue<DocxPreviewJobData & { originalJobId: string | undefined; error: string }>(
  "docx-preview-dlq",
  {
    connection: { url: env.REDIS_URL },
    defaultJobOptions: { removeOnComplete: { count: 500 }, removeOnFail: { count: 500 } }
  }
);

const worker = new Worker<DocxPreviewJobData>(
  "docx-preview",
  async (job) => {
    await runDocxPreview(job.data.documentId, job.data.firmId, env, storage);
  },
  {
    connection: { url: env.REDIS_URL },
    concurrency: 1,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 }
  }
);

worker.on("completed", (job) => {
  console.log(`[docx-preview-worker] job ${job.id} completed for document ${job.data.documentId}`);
});

worker.on("failed", async (job, err) => {
  console.error(`[docx-preview-worker] job ${job?.id} failed (attempt ${job?.attemptsMade ?? "?"}/${MAX_ATTEMPTS}): ${err.message}`);

  if (job && job.attemptsMade >= MAX_ATTEMPTS) {
    console.error(`[docx-preview-worker] job ${job.id} exhausted all retries — moving to DLQ`);
    await deadLetterQueue.add("failed-docx-preview", {
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
