export interface IOcrAdapter {
  extract(buffer: Buffer, mimeType: string): Promise<string>;
}
