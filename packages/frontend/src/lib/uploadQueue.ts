export type UploadQueueStatus = "queued" | "uploading" | "success" | "failed";

export interface UploadQueueSuccessResult<TResult> {
  index: number;
  status: "success";
  result: TResult;
}

export interface UploadQueueFailedResult {
  index: number;
  status: "failed";
  error: Error;
}

export type UploadQueueResult<TResult> = UploadQueueSuccessResult<TResult> | UploadQueueFailedResult;

export interface UploadQueueSummary<TResult> {
  successCount: number;
  failedCount: number;
  results: UploadQueueResult<TResult>[];
}

export interface RunUploadQueueOptions<TItem, TResult> {
  items: TItem[];
  upload: (item: TItem, index: number) => Promise<TResult>;
  concurrency?: number;
  onStatusChange?: (index: number, status: UploadQueueStatus, error?: string) => void;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  return new Error(typeof value === "string" ? value : "Upload failed");
}

function normalizeConcurrency(value: number | undefined): number {
  if (!value || Number.isNaN(value)) {
    return 3;
  }
  return Math.max(1, Math.floor(value));
}

export async function runUploadQueue<TItem, TResult>({
  items,
  upload,
  concurrency,
  onStatusChange
}: RunUploadQueueOptions<TItem, TResult>): Promise<UploadQueueSummary<TResult>> {
  const queueConcurrency = normalizeConcurrency(concurrency);

  if (!items.length) {
    return {
      successCount: 0,
      failedCount: 0,
      results: []
    };
  }

  for (let i = 0; i < items.length; i += 1) {
    onStatusChange?.(i, "queued");
  }

  const results: UploadQueueResult<TResult>[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= items.length) {
        return;
      }

      onStatusChange?.(current, "uploading");
      try {
        const result = await upload(items[current], current);
        results[current] = {
          index: current,
          status: "success",
          result
        };
        onStatusChange?.(current, "success");
      } catch (err) {
        const error = toError(err);
        results[current] = {
          index: current,
          status: "failed",
          error
        };
        onStatusChange?.(current, "failed", error.message);
      }
    }
  }

  const workers = Array.from({ length: Math.min(queueConcurrency, items.length) }, () => worker());
  await Promise.all(workers);

  const failedCount = results.filter((item) => item.status === "failed").length;
  return {
    successCount: results.length - failedCount,
    failedCount,
    results
  };
}
