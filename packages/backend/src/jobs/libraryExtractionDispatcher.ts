import type { AppEnv } from "../config/env.js";
import type { IStorageAdapter } from "../storage/IStorageAdapter.js";
import { runLibraryExtraction } from "./runLibraryExtraction.js";
import { getLibraryExtractionQueue } from "./libraryExtractionQueue.js";

export async function dispatchLibraryExtraction(
  libraryDocumentId: string,
  firmId: string,
  env: AppEnv,
  storage: IStorageAdapter
): Promise<void> {
  if (env.STORAGE_DRIVER === "local") {
    // Run inline after response is sent — no Redis/BullMQ required for desktop
    setImmediate(() => {
      void runLibraryExtraction(libraryDocumentId, env, storage);
    });
  } else {
    await getLibraryExtractionQueue(env).add("extract-library", { libraryDocumentId, firmId });
  }
}
