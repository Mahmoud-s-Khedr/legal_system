import type { AppEnv } from "../../../config/env.js";
import type { IOcrAdapter } from "./IOcrAdapter.js";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export class GoogleVisionAdapter implements IOcrAdapter {
  constructor(private readonly env: AppEnv) {}

  async extract(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      if (mimeType === DOCX_MIME) {
        // Vision API does not handle DOCX; fall back to mammoth
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        return result.value ?? "";
      }
      return await extractWithVision(buffer, mimeType, this.env);
    } catch {
      return "";
    }
  }
}

async function extractWithVision(buffer: Buffer, mimeType: string, env: AppEnv): Promise<string> {
  const vision = await import("@google-cloud/vision");
  const client = new vision.ImageAnnotatorClient({
    apiKey: env.GOOGLE_VISION_API_KEY
  });

  const isPdf = mimeType === "application/pdf";

  if (isPdf) {
    const [result] = await client.documentTextDetection({
      image: { content: buffer.toString("base64") },
      imageContext: { languageHints: ["ar", "en", "fr"] }
    });
    return result.fullTextAnnotation?.text ?? "";
  }

  const [result] = await client.textDetection({
    image: { content: buffer.toString("base64") }
  });
  return result.fullTextAnnotation?.text ?? "";
}
