import { describe, expect, it } from "vitest";
import { runUploadQueue } from "./uploadQueue";

describe("runUploadQueue", () => {
  it("respects configured concurrency", async () => {
    let active = 0;
    let maxActive = 0;

    const items = Array.from({ length: 9 }, (_, i) => i);
    const summary = await runUploadQueue({
      items,
      concurrency: 3,
      upload: async (value) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return value;
      }
    });

    expect(summary.successCount).toBe(9);
    expect(summary.failedCount).toBe(0);
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it("continues uploading after failures", async () => {
    const items = [1, 2, 3, 4, 5];
    const summary = await runUploadQueue({
      items,
      concurrency: 2,
      upload: async (value) => {
        if (value === 2 || value === 4) {
          throw new Error(`failed ${value}`);
        }
        return value * 10;
      }
    });

    expect(summary.successCount).toBe(3);
    expect(summary.failedCount).toBe(2);
    expect(summary.results.map((item) => item.status)).toEqual([
      "success",
      "failed",
      "success",
      "failed",
      "success"
    ]);
  });

  it("reports per-item status transitions and errors", async () => {
    const events: Array<{ index: number; status: string; error?: string }> = [];

    const summary = await runUploadQueue({
      items: ["ok", "bad"],
      concurrency: 1,
      upload: async (value) => {
        if (value === "bad") {
          throw new Error("boom");
        }
        return value;
      },
      onStatusChange: (index, status, error) => {
        events.push({ index, status, error });
      }
    });

    expect(summary.successCount).toBe(1);
    expect(summary.failedCount).toBe(1);
    expect(events).toEqual([
      { index: 0, status: "queued", error: undefined },
      { index: 1, status: "queued", error: undefined },
      { index: 0, status: "uploading", error: undefined },
      { index: 0, status: "success", error: undefined },
      { index: 1, status: "uploading", error: undefined },
      { index: 1, status: "failed", error: "boom" }
    ]);
  });
});
