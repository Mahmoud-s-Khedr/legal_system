import type { SessionUser } from "@elms/shared";
import { prisma } from "../../db/prisma.js";
import { withTenant } from "../../db/tenant.js";
import { loadEnv } from "../../config/env.js";
import { ResearchRole } from "@prisma/client";
import { streamMessage, type ChatMessage } from "./ai.provider.js";
import { retrieveRelevantExcerpts, type RetrievedExcerpt } from "./retrieval.service.js";
import {
  getAiMonthlyLimit,
  hasEditionFeature
} from "../editions/editionPolicy.js";

const SYSTEM_PROMPT = `أنت مساعد قانوني متخصص في القانون المصري وقوانين الشرق الأوسط.
تساعد المحامين وأعضاء فريق المكتب القانوني في البحث والتحليل القانوني.
أجب دائماً بدقة واحترافية، مستشهداً بالمصادر القانونية عند الإمكان.
إذا كانت المعلومات المقدمة في <sources> وثيقة الصلة، استند إليها واذكرها بشكل صريح.
إذا لم تكن متأكداً من إجابة، وضّح ذلك بوضوح بدلاً من تقديم معلومات غير مؤكدة.

You are a legal research assistant specializing in Egyptian and Middle Eastern law.
Assist lawyers with research and legal analysis. When sources are provided, cite them explicitly.
If uncertain, say so clearly rather than providing unverified information.`;

function buildSystemPromptWithSources(excerpts: RetrievedExcerpt[]): string {
  let prompt = SYSTEM_PROMPT;

  if (excerpts.length > 0) {
    const sourcesBlock = excerpts
      .map((e, i) => {
        const ref = e.articleNumber
          ? `${e.documentTitle} — Article ${e.articleNumber}`
          : e.documentTitle;
        return `[${i + 1}] ${ref}\n${e.excerpt}`;
      })
      .join("\n\n---\n\n");
    prompt += `\n\n<sources>\n${sourcesBlock}\n</sources>`;
  }

  return prompt;
}

// ── Session management ───────────────────────────────────────────────────────

export async function createSession(
  actor: SessionUser,
  caseId?: string,
  title?: string
) {
  return withTenant(prisma, actor.firmId, async (tx) =>
    tx.researchSession.create({
      data: {
        firmId: actor.firmId,
        userId: actor.id,
        caseId: caseId ?? null,
        title: title ?? null
      }
    })
  );
}

export async function listSessions(actor: SessionUser) {
  return withTenant(prisma, actor.firmId, async (tx) =>
    tx.researchSession.findMany({
      where: { firmId: actor.firmId, userId: actor.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true, caseId: true, createdAt: true, updatedAt: true }
    })
  );
}

export async function getSession(actor: SessionUser, sessionId: string) {
  return withTenant(prisma, actor.firmId, async (tx) =>
    tx.researchSession.findFirst({
      where: { id: sessionId, firmId: actor.firmId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: { sources: { include: { document: true, article: true } } }
        }
      }
    })
  );
}

export async function deleteSession(actor: SessionUser, sessionId: string): Promise<boolean> {
  const deleted = await withTenant(prisma, actor.firmId, async (tx) =>
    tx.researchSession.deleteMany({ where: { id: sessionId, firmId: actor.firmId, userId: actor.id } })
  );
  return deleted.count > 0;
}

// ── Usage tracking ───────────────────────────────────────────────────────────

export async function checkUsageLimit(firmId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const firm = await prisma.firm.findUniqueOrThrow({
    where: { id: firmId },
    select: { editionKey: true }
  });

  if (!hasEditionFeature(firm.editionKey, "ai_research")) {
    return { allowed: false, used: 0, limit: 0 };
  }

  const policyLimit = getAiMonthlyLimit(firm.editionKey) ?? 0;
  const env = loadEnv();
  const limit = env.AI_MONTHLY_LIMIT === 0 ? policyLimit : Math.min(env.AI_MONTHLY_LIMIT, policyLimit);
  if (limit === 0) return { allowed: true, used: 0, limit: 0 };

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const used = await prisma.researchMessage.count({
    where: {
      role: ResearchRole.USER,
      session: {
        firmId,
        createdAt: { gte: startOfMonth }
      }
    }
  });

  return { allowed: used < limit, used, limit };
}

// ── Message streaming ────────────────────────────────────────────────────────

/**
 * Sends a user message to the research session and returns an async iterable of
 * assistant token chunks. The assistant message and sources are persisted after
 * streaming completes.
 */
export async function* sendMessage(
  actor: SessionUser,
  sessionId: string,
  userContent: string
): AsyncIterable<string> {
  if (!hasEditionFeature(actor.editionKey, "ai_research")) {
    throw new Error("FEATURE_NOT_AVAILABLE");
  }

  // Validate session belongs to actor's firm
  const session = await prisma.researchSession.findFirst({
    where: { id: sessionId, firmId: actor.firmId }
  });
  if (!session) throw new Error("Session not found");

  // Check usage limit
  const usage = await checkUsageLimit(actor.firmId);
  if (!usage.allowed) throw new Error("USAGE_LIMIT_EXCEEDED");

  // Persist user message
  await prisma.researchMessage.create({
    data: { sessionId, role: ResearchRole.USER, content: userContent }
  });

  // Retrieve context from library
  const excerpts = await retrieveRelevantExcerpts(prisma, actor.firmId, userContent);

  // Build history (last 20 messages for context window)
  const history = await prisma.researchMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: 20
  });

  const chatMessages: ChatMessage[] = history.map((m) => ({
    role: m.role === ResearchRole.USER ? "user" : "assistant",
    content: m.content
  }));

  const systemPrompt = buildSystemPromptWithSources(excerpts);

  // Stream response from AI
  let fullResponse = "";
  for await (const token of streamMessage(chatMessages, systemPrompt)) {
    fullResponse += token;
    yield token;
  }

  // Persist assistant message + sources
  const assistantMsg = await prisma.researchMessage.create({
    data: { sessionId, role: ResearchRole.ASSISTANT, content: fullResponse }
  });

  if (excerpts.length > 0) {
    await prisma.researchSessionSource.createMany({
      data: excerpts.map((e) => ({
        sessionId,
        messageId: assistantMsg.id,
        documentId: e.documentId,
        articleId: e.articleId ?? null
      }))
    });
  }

  // Touch updatedAt on session
  await prisma.researchSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() }
  });
}
