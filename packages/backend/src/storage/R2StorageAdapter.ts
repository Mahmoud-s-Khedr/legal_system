import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AppEnv } from "../config/env.js";
import type { IStorageAdapter } from "./IStorageAdapter.js";

export class R2StorageAdapter implements IStorageAdapter {
  readonly supportsSignedUrls = true;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly env: AppEnv) {
    if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) {
      throw new Error("R2 storage requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET");
    }
    this.bucket = env.R2_BUCKET;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY
      }
    });
  }

  async put(key: string, stream: NodeJS.ReadableStream, mimeType: string): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as Uint8Array));
    }
    const body = Buffer.concat(chunks);
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: mimeType
    }));
  }

  async get(key: string): Promise<NodeJS.ReadableStream> {
    const response = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    }));
    if (!response.Body) {
      throw new Error(`No body returned from R2 for key: ${key}`);
    }
    return response.Body as NodeJS.ReadableStream;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key
    }));
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}
