import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { AppEnv } from "../config/env.js";
import type { IStorageAdapter } from "./IStorageAdapter.js";

export class LocalStorageAdapter implements IStorageAdapter {
  readonly supportsSignedUrls = false;

  constructor(private readonly env: AppEnv) {}

  private resolvePath(key: string): string {
    return path.join(this.env.LOCAL_STORAGE_PATH, key);
  }

  async put(key: string, stream: NodeJS.ReadableStream, _mimeType: string): Promise<void> {
    void _mimeType;
    const filePath = this.resolvePath(key);
    await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
    const writeStream = fs.createWriteStream(filePath);
    await pipeline(stream, writeStream);
  }

  async get(key: string): Promise<NodeJS.ReadableStream> {
    const filePath = this.resolvePath(key);
    return fs.createReadStream(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    try {
      await fsPromises.unlink(filePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return;
      }
      throw error;
    }
  }

  async getSignedUrl(_key: string, _expiresInSeconds: number): Promise<string> {
    void _key;
    void _expiresInSeconds;
    throw new Error("LocalStorageAdapter does not support signed URLs");
  }
}
