export interface IStorageAdapter {
  put(key: string, stream: NodeJS.ReadableStream, mimeType: string): Promise<void>;
  get(key: string): Promise<NodeJS.ReadableStream>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  readonly supportsSignedUrls: boolean;
}
