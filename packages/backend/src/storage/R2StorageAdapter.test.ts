import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
const signedUrlMock = vi.fn();

class PutObjectCommand {
  constructor(public input: unknown) {}
}

class GetObjectCommand {
  constructor(public input: unknown) {}
}

class DeleteObjectCommand {
  constructor(public input: unknown) {}
}

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = sendMock;
  },
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: signedUrlMock
}));

const { R2StorageAdapter } = await import("./R2StorageAdapter.js");

describe("R2StorageAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires all r2 credentials", () => {
    expect(
      () =>
        new R2StorageAdapter(
          {
            R2_ACCOUNT_ID: "",
            R2_ACCESS_KEY_ID: "",
            R2_SECRET_ACCESS_KEY: "",
            R2_BUCKET: ""
          } as never
        )
    ).toThrow("R2 storage requires R2_ACCOUNT_ID");
  });

  it("uploads, downloads, deletes, and signs urls", async () => {
    const adapter = new R2StorageAdapter(
      {
        R2_ACCOUNT_ID: "acc",
        R2_ACCESS_KEY_ID: "key",
        R2_SECRET_ACCESS_KEY: "secret",
        R2_BUCKET: "bucket"
      } as never
    );

    sendMock.mockResolvedValueOnce(undefined);
    await adapter.put("k1", Readable.from(["abc"]), "text/plain");

    expect(sendMock).toHaveBeenCalledWith(expect.any(PutObjectCommand));

    const body = Readable.from(["hello"]);
    sendMock.mockResolvedValueOnce({ Body: body });
    const stream = await adapter.get("k1");
    let value = "";
    for await (const chunk of stream as AsyncIterable<Buffer | string>) {
      value += chunk.toString();
    }
    expect(value).toBe("hello");

    sendMock.mockResolvedValueOnce({ Body: null });
    await expect(adapter.get("k1")).rejects.toThrow("No body returned from R2");

    sendMock.mockResolvedValueOnce(undefined);
    await adapter.delete("k1");
    expect(sendMock).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));

    signedUrlMock.mockResolvedValueOnce("https://signed");
    await expect(adapter.getSignedUrl("k2", 90)).resolves.toBe("https://signed");
  });
});
