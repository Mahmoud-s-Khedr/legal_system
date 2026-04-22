import { describe, expect, it } from "vitest";
import { createStorageAdapter } from "./index.js";
import { LocalStorageAdapter } from "./LocalStorageAdapter.js";
import { R2StorageAdapter } from "./R2StorageAdapter.js";

describe("createStorageAdapter", () => {
  it("creates local adapter", () => {
    const adapter = createStorageAdapter({ STORAGE_DRIVER: "local", LOCAL_STORAGE_PATH: "/tmp/elms" } as never);
    expect(adapter).toBeInstanceOf(LocalStorageAdapter);
  });

  it("creates r2 adapter", () => {
    const adapter = createStorageAdapter(
      {
        STORAGE_DRIVER: "r2",
        R2_ACCOUNT_ID: "acc",
        R2_ACCESS_KEY_ID: "key",
        R2_SECRET_ACCESS_KEY: "secret",
        R2_BUCKET: "bucket"
      } as never
    );
    expect(adapter).toBeInstanceOf(R2StorageAdapter);
  });

  it("throws for unknown driver", () => {
    expect(() => createStorageAdapter({ STORAGE_DRIVER: "unknown" } as never)).toThrow(
      "Unknown STORAGE_DRIVER: unknown"
    );
  });
});
