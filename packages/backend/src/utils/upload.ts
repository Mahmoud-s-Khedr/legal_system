import { fileTypeFromBuffer } from "file-type";
import { Readable } from "node:stream";

const FILE_TYPE_SNIFF_BYTES = 256 * 1024;

export interface UploadSniffResult {
  mimeType: string | null;
  sniffBytes: Buffer;
  stream: NodeJS.ReadableStream;
}

export async function sniffMimeAndReplayStream(
  stream: NodeJS.ReadableStream
): Promise<UploadSniffResult> {
  const reader = stream as AsyncIterable<Uint8Array | Buffer>;
  const iterator = reader[Symbol.asyncIterator]();
  const bufferedChunks: Buffer[] = [];
  let sniffBuffer = Buffer.alloc(0);
  let sourceExhausted = false;

  while (sniffBuffer.length < FILE_TYPE_SNIFF_BYTES) {
    const next = await iterator.next();
    if (next.done) {
      sourceExhausted = true;
      break;
    }
    const chunkBuffer = Buffer.isBuffer(next.value)
      ? next.value
      : Buffer.from(next.value);
    bufferedChunks.push(chunkBuffer);
    const needed = FILE_TYPE_SNIFF_BYTES - sniffBuffer.length;
    sniffBuffer = Buffer.concat([sniffBuffer, chunkBuffer.subarray(0, needed)]);
  }

  let mimeType: string | null = null;
  try {
    mimeType = (await fileTypeFromBuffer(sniffBuffer))?.mime ?? null;
  } catch {
    mimeType = null;
  }

  async function* replay(): AsyncGenerator<Buffer> {
    for (const chunk of bufferedChunks) {
      yield chunk;
    }

    if (sourceExhausted) {
      return;
    }

    while (true) {
      const next = await iterator.next();
      if (next.done) {
        break;
      }
      yield Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value);
    }
  }

  return {
    mimeType,
    sniffBytes: sniffBuffer,
    stream: Readable.from(replay())
  };
}

export async function readUploadBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
