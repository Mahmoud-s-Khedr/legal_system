export type { IStorageAdapter } from "./IStorageAdapter.js";
export { LocalStorageAdapter } from "./LocalStorageAdapter.js";
export { R2StorageAdapter } from "./R2StorageAdapter.js";

import type { AppEnv } from "../config/env.js";
import type { IStorageAdapter } from "./IStorageAdapter.js";
import { LocalStorageAdapter } from "./LocalStorageAdapter.js";
import { R2StorageAdapter } from "./R2StorageAdapter.js";

export function createStorageAdapter(env: AppEnv): IStorageAdapter {
  if (env.STORAGE_DRIVER === "local") return new LocalStorageAdapter(env);
  if (env.STORAGE_DRIVER === "r2") return new R2StorageAdapter(env);
  throw new Error(`Unknown STORAGE_DRIVER: ${env.STORAGE_DRIVER}`);
}
