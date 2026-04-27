import type { SessionUser } from "@elms/shared";
import { ExtractionStatus, LibraryScope, Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { normalizeArabic } from "../../utils/arabic.js";
import { buildFuzzySearchCandidates } from "../../utils/fuzzySearch.js";

export interface GlobalSearchResult {
  entityType: string;
  id: string;
  title: string;
  snippet: string | null;
  url: string;
  rank: number;
}

interface SearchFilters {
  q: string;
  entities?: string[];
  limit?: number;
}

function pickSnippet(text: string | null, query: string, maxLen = 120): string | null {
  if (!text) return null;
  const normalized = normalizeArabic(text).toLowerCase();
  const q = normalizeArabic(query).toLowerCase();
  const idx = normalized.indexOf(q);
  if (idx === -1) {
    return text.slice(0, maxLen) + (text.length > maxLen ? "…" : "");
  }
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + q.length + 40);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

function scoreTextMatch(
  text: string | null | undefined,
  normalizedQuery: string,
  searchCandidates: string[]
): number {
  if (!text) return 0;

  const normalizedText = normalizeArabic(text).toLowerCase();
  const query = normalizedQuery.toLowerCase();
  if (!normalizedText) return 0;

  let score = 0;

  if (normalizedText === query) score += 140;
  if (normalizedText.startsWith(query)) score += 80;
  if (normalizedText.includes(query)) score += 50;

  for (const candidate of searchCandidates) {
    const normalizedCandidate = normalizeArabic(candidate).toLowerCase();
    if (!normalizedCandidate || normalizedCandidate === query) continue;
    if (normalizedText.includes(normalizedCandidate)) score += 12;
  }

  return score;
}

function rankScore(
  normalizedQuery: string,
  searchCandidates: string[],
  fields: Array<string | null | undefined>
): number {
  if (fields.length === 0) return 0;

  const [primary, ...secondary] = fields;
  let score = scoreTextMatch(primary, normalizedQuery, searchCandidates) * 3;
  for (const field of secondary) {
    score += scoreTextMatch(field, normalizedQuery, searchCandidates);
  }

  return score;
}

export async function globalSearch(
  actor: SessionUser,
  filters: SearchFilters
): Promise<GlobalSearchResult[]> {
  const { q } = filters;
  const entities =
    filters.entities && filters.entities.length > 0
      ? filters.entities
      : ["cases", "clients", "tasks", "documents", "library"];
  const limit =
    typeof filters.limit === "number" && Number.isFinite(filters.limit)
      ? Math.min(100, Math.max(1, Math.trunc(filters.limit)))
      : 20;
  const normalizedQuery = normalizeArabic(q.trim());
  if (!normalizedQuery) return [];

  const searchCandidates = buildFuzzySearchCandidates(normalizedQuery);
  const perEntityLimit = Math.max(5, Math.ceil(limit / Math.max(entities.length, 1)));
  const results: GlobalSearchResult[] = [];

  if (entities.includes("cases")) {
    const caseWhere = {
      firmId: actor.firmId,
      deletedAt: null,
      OR: searchCandidates.flatMap((candidate) => [
        { title: { contains: candidate, mode: "insensitive" as const } },
        { caseNumber: { contains: candidate, mode: "insensitive" as const } },
        {
          legalReferences: {
            some: {
              OR: [
                {
                  document: {
                    title: {
                      contains: candidate,
                      mode: "insensitive" as const
                    }
                  }
                },
                {
                  article: {
                    articleNumber: {
                      contains: candidate,
                      mode: "insensitive" as const
                    }
                  }
                },
                {
                  article: {
                    title: {
                      contains: candidate,
                      mode: "insensitive" as const
                    }
                  }
                }
              ]
            }
          }
        }
      ])
    };

    const cases = await prisma.case.findMany({
      where: caseWhere,
      select: {
        id: true,
        title: true,
        caseNumber: true,
        status: true,
        legalReferences: {
          select: {
            document: { select: { title: true } },
            article: { select: { articleNumber: true, title: true } }
          },
          orderBy: { createdAt: "desc" },
          take: 1
        }
      },
      orderBy: { updatedAt: "desc" },
      take: perEntityLimit
    });

    results.push(
      ...cases.map((c) => ({
        entityType: "case",
        id: c.id,
        title: c.title,
        snippet:
          c.legalReferences[0]?.article?.articleNumber &&
          c.legalReferences[0]?.document?.title
            ? `${c.caseNumber} · ${c.legalReferences[0].document.title} § ${c.legalReferences[0].article.articleNumber}`
            : c.legalReferences[0]?.document?.title
              ? `${c.caseNumber} · ${c.legalReferences[0].document.title}`
              : `${c.caseNumber}${c.status ? ` · ${c.status}` : ""}`,
        url: `/app/cases/${c.id}`,
        rank: rankScore(normalizedQuery, searchCandidates, [
          c.title,
          c.caseNumber,
          c.legalReferences[0]?.document?.title,
          c.legalReferences[0]?.article?.articleNumber,
          c.legalReferences[0]?.article?.title,
          c.status ?? undefined
        ])
      }))
    );
  }

  if (entities.includes("clients")) {
    const clientWhere = {
      firmId: actor.firmId,
      deletedAt: null,
      OR: searchCandidates.flatMap((candidate) => [
        { name: { contains: candidate, mode: "insensitive" as const } },
        { nationalId: { contains: candidate, mode: "insensitive" as const } },
        { phone: { contains: candidate, mode: "insensitive" as const } },
        { email: { contains: candidate, mode: "insensitive" as const } }
      ])
    };

    const clients = await prisma.client.findMany({
      where: clientWhere,
      select: { id: true, name: true, phone: true, email: true },
      orderBy: { updatedAt: "desc" },
      take: perEntityLimit
    });

    results.push(
      ...clients.map((c) => ({
        entityType: "client",
        id: c.id,
        title: c.name,
        snippet: c.phone ?? c.email ?? null,
        url: `/app/clients/${c.id}`,
        rank: rankScore(normalizedQuery, searchCandidates, [
          c.name,
          c.phone ?? undefined,
          c.email ?? undefined
        ])
      }))
    );
  }

  if (entities.includes("tasks")) {
    const taskWhere = {
      firmId: actor.firmId,
      deletedAt: null,
      OR: searchCandidates.flatMap((candidate) => [
        { title: { contains: candidate, mode: "insensitive" as const } },
        { description: { contains: candidate, mode: "insensitive" as const } }
      ])
    };

    const tasks = await prisma.task.findMany({
      where: taskWhere,
      select: { id: true, title: true, status: true, priority: true },
      orderBy: { updatedAt: "desc" },
      take: perEntityLimit
    });

    results.push(
      ...tasks.map((t) => ({
        entityType: "task",
        id: t.id,
        title: t.title,
        snippet: `${t.status} · ${t.priority}`,
        url: `/app/tasks/${t.id}`,
        rank: rankScore(normalizedQuery, searchCandidates, [
          t.title,
          t.status,
          t.priority
        ])
      }))
    );
  }

  if (entities.includes("documents")) {
    const docWhere: Prisma.DocumentWhereInput = {
      firmId: actor.firmId,
      deletedAt: null,
      extractionStatus: ExtractionStatus.INDEXED,
      OR: searchCandidates.flatMap((candidate) => [
        { title: { contains: candidate, mode: "insensitive" as const } },
        { fileName: { contains: candidate, mode: "insensitive" as const } },
        { contentText: { contains: candidate, mode: "insensitive" as const } }
      ])
    };

    const docs = await prisma.document.findMany({
      where: docWhere,
      select: { id: true, title: true, fileName: true, contentText: true },
      orderBy: { updatedAt: "desc" },
      take: perEntityLimit
    });

    results.push(
      ...docs.map((d) => ({
        entityType: "document",
        id: d.id,
        title: d.title,
        snippet: pickSnippet(d.contentText ?? d.fileName, normalizedQuery),
        url: `/app/documents/${d.id}`,
        rank: rankScore(normalizedQuery, searchCandidates, [
          d.title,
          d.fileName,
          d.contentText ?? undefined
        ])
      }))
    );
  }

  if (entities.includes("library")) {
    const libWhere: Prisma.LibraryDocumentWhereInput = {
      deletedAt: null,
      OR: [
        { scope: LibraryScope.SYSTEM },
        { firmId: actor.firmId }
      ],
      AND: {
        OR: searchCandidates.flatMap((candidate) => [
          { title: { contains: candidate, mode: "insensitive" as const } },
          { summary: { contains: candidate, mode: "insensitive" as const } },
          { contentText: { contains: candidate, mode: "insensitive" as const } }
        ])
      }
    };

    const libs = await prisma.libraryDocument.findMany({
      where: libWhere,
      select: { id: true, title: true, type: true, summary: true, contentText: true },
      orderBy: { updatedAt: "desc" },
      take: perEntityLimit
    });

    results.push(
      ...libs.map((l) => ({
        entityType: "library",
        id: l.id,
        title: l.title,
        snippet: pickSnippet(l.summary ?? l.contentText, normalizedQuery),
        url: `/app/library/documents/${l.id}`,
        rank: rankScore(normalizedQuery, searchCandidates, [
          l.title,
          l.summary ?? undefined,
          l.contentText ?? undefined
        ])
      }))
    );
  }

  // Sort by rank desc, then by title
  results.sort((a, b) => {
    if (b.rank !== a.rank) return b.rank - a.rank;
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  });

  return results.slice(0, limit);
}
