import Anthropic from "@anthropic-ai/sdk";
import { loadEnv } from "../../config/env.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const env = loadEnv();
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return client;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function* streamMessage(
  messages: ChatMessage[],
  systemPrompt: string
): AsyncIterable<string> {
  const env = loadEnv();
  const anthropic = getClient();

  const stream = await anthropic.messages.stream({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content }))
  });

  for await (const chunk of stream) {
    if (
      chunk.type === "content_block_delta" &&
      chunk.delta.type === "text_delta"
    ) {
      yield chunk.delta.text;
    }
  }
}
