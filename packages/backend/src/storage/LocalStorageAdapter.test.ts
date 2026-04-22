import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { LocalStorageAdapter } from "./LocalStorageAdapter.js";

describe("LocalStorageAdapter", () => {
  it("puts, gets, deletes, and handles missing files", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "elms-local-storage-"));
    const adapter = new LocalStorageAdapter({ LOCAL_STORAGE_PATH: dir } as never);

    const key = "nested/doc.txt";
    await adapter.put(key, Readable.from(["hello"]), "text/plain");

    const stream = await adapter.get(key);
    let content = "";
    for await (const chunk of stream as AsyncIterable<Buffer | string>) {
      content += chunk.toString();
    }
    expect(content).toBe("hello");

    await adapter.delete(key);
    await adapter.delete(key);

    await expect(adapter.getSignedUrl("x", 60)).rejects.toThrow(
      "LocalStorageAdapter does not support signed URLs"
    );
  });
});
