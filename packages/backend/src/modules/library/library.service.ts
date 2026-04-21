import type { SessionUser } from "@elms/shared";
import { prisma } from "../../db/prisma.js";
import { withTenant } from "../../db/tenant.js";
import { Prisma } from "@prisma/client";
import { buildFuzzySearchCandidates } from "../../utils/fuzzySearch.js";
import { normalizeArabic } from "../../utils/arabic.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CategoryTree {
  id: string;
  nameAr: string;
  nameEn: string;
  nameFr: string;
  slug: string;
  firmId: string | null;
  children: CategoryTree[];
}

export interface LibraryDocumentSummary {
  id: string;
  type: string;
  scope: string;
  title: string;
  summary: string | null;
  lawNumber: string | null;
  lawYear: number | null;
  judgmentNumber: string | null;
  judgmentDate: string | null;
  publishedAt: string | null;
  legislationStatus: string | null;
  categoryId: string | null;
  firmId: string | null;
  createdAt: string;
}

export interface LibraryDocumentDetail extends LibraryDocumentSummary {
  contentText: string | null;
  legalPrinciple: string | null;
  author: string | null;
  articles: ArticleSummary[];
  tags: string[];
  annotations: AnnotationDto[];
}

export interface ArticleSummary {
  id: string;
  articleNumber: string;
  title: string | null;
  body: string;
}

export interface AnnotationDto {
  id: string;
  body: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseLegalReferenceDto {
  id: string;
  caseId: string;
  documentId: string;
  articleId: string | null;
  notes: string | null;
  document: { title: string; type: string };
  article: { articleNumber: string; title: string | null } | null;
  createdAt: string;
}

export interface LibraryFilter {
  type?: string;
  scope?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
}

// ── Category helpers ──────────────────────────────────────────────────────────

function buildTree(
  allCategories: Array<{
    id: string;
    nameAr: string;
    nameEn: string;
    nameFr: string;
    slug: string;
    firmId: string | null;
    parentId: string | null;
  }>,
  parentId: string | null = null
): CategoryTree[] {
  return allCategories
    .filter((c) => c.parentId === parentId)
    .map((c) => ({
      id: c.id,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      nameFr: c.nameFr,
      slug: c.slug,
      firmId: c.firmId,
      children: buildTree(allCategories, c.id)
    }));
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function listCategories(actor: SessionUser): Promise<CategoryTree[]> {
  const rows = await prisma.legalCategory.findMany({
    where: {
      OR: [{ firmId: null }, { firmId: actor.firmId }]
    },
    select: { id: true, nameAr: true, nameEn: true, nameFr: true, slug: true, firmId: true, parentId: true },
    orderBy: { nameEn: "asc" }
  });
  return buildTree(rows);
}

export async function createCategory(
  actor: SessionUser,
  data: { nameAr: string; nameEn: string; nameFr: string; slug: string; parentId?: string }
): Promise<CategoryTree> {
  const cat = await prisma.legalCategory.create({
    data: {
      firmId: actor.firmId,
      nameAr: data.nameAr,
      nameEn: data.nameEn,
      nameFr: data.nameFr,
      slug: data.slug,
      parentId: data.parentId ?? null
    }
  });
  return {
    id: cat.id,
    nameAr: cat.nameAr,
    nameEn: cat.nameEn,
    nameFr: cat.nameFr,
    slug: cat.slug,
    firmId: cat.firmId,
    children: []
  };
}

export async function updateCategory(
  actor: SessionUser,
  categoryId: string,
  data: { nameAr?: string; nameEn?: string; nameFr?: string; slug?: string; parentId?: string | null }
): Promise<CategoryTree | null> {
  const existing = await prisma.legalCategory.findFirst({
    where: { id: categoryId, firmId: actor.firmId }
  });
  if (!existing) return null;

  const updateResult = await prisma.legalCategory.updateMany({
    where: { id: categoryId, firmId: actor.firmId },
    data: {
      nameAr: data.nameAr ?? existing.nameAr,
      nameEn: data.nameEn ?? existing.nameEn,
      nameFr: data.nameFr ?? existing.nameFr,
      slug: data.slug ?? existing.slug,
      parentId: data.parentId !== undefined ? data.parentId : existing.parentId
    }
  });

  if (updateResult.count === 0) return null;

  const updated = await prisma.legalCategory.findFirst({
    where: { id: categoryId, firmId: actor.firmId }
  });

  if (!updated) return null;

  return {
    id: updated.id,
    nameAr: updated.nameAr,
    nameEn: updated.nameEn,
    nameFr: updated.nameFr,
    slug: updated.slug,
    firmId: updated.firmId,
    children: []
  };
}

export async function deleteCategory(actor: SessionUser, categoryId: string): Promise<boolean> {
  const deleted = await prisma.legalCategory.deleteMany({
    where: { id: categoryId, firmId: actor.firmId }
  });
  return deleted.count > 0;
}

// ── Documents ─────────────────────────────────────────────────────────────────

function docToSummary(doc: {
  id: string; type: string; scope: string; title: string;
  summary: string | null; lawNumber: string | null; lawYear: number | null;
  judgmentNumber: string | null; judgmentDate: Date | null; publishedAt: Date | null;
  legislationStatus: string | null; categoryId: string | null; firmId: string | null;
  createdAt: Date;
}): LibraryDocumentSummary {
  return {
    id: doc.id,
    type: doc.type,
    scope: doc.scope,
    title: doc.title,
    summary: doc.summary,
    lawNumber: doc.lawNumber,
    lawYear: doc.lawYear,
    judgmentNumber: doc.judgmentNumber,
    judgmentDate: doc.judgmentDate?.toISOString() ?? null,
    publishedAt: doc.publishedAt?.toISOString() ?? null,
    legislationStatus: doc.legislationStatus,
    categoryId: doc.categoryId,
    firmId: doc.firmId,
    createdAt: doc.createdAt.toISOString()
  };
}

export async function listDocuments(
  actor: SessionUser,
  filter: LibraryFilter,
  page = 1,
  limit = 20
): Promise<{ items: LibraryDocumentSummary[]; total: number }> {
  const searchCandidates = buildFuzzySearchCandidates(filter.q);
  const where: Prisma.LibraryDocumentWhereInput = {
    deletedAt: null,
    OR: [{ scope: "SYSTEM" }, { firmId: actor.firmId }]
  };

  if (filter.type) where.type = { equals: filter.type };
  if (filter.scope) where.scope = filter.scope as "SYSTEM" | "FIRM";
  if (filter.categoryId) where.categoryId = filter.categoryId;
  if (filter.dateFrom) where.publishedAt = { gte: new Date(filter.dateFrom) };
  if (filter.dateTo) {
    where.publishedAt = { ...(where.publishedAt as object ?? {}), lte: new Date(filter.dateTo) };
  }
  if (searchCandidates.length > 0) {
    where.OR = searchCandidates.flatMap((candidate) => [
      { title: { contains: candidate, mode: "insensitive" as const } },
      { summary: { contains: candidate, mode: "insensitive" as const } }
    ]);
  }

  const [items, total] = await Promise.all([
    prisma.libraryDocument.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, type: true, scope: true, title: true, summary: true,
        lawNumber: true, lawYear: true, judgmentNumber: true, judgmentDate: true,
        publishedAt: true, legislationStatus: true, categoryId: true, firmId: true, createdAt: true
      }
    }),
    prisma.libraryDocument.count({ where })
  ]);

  return { items: items.map(docToSummary), total };
}

export async function getDocument(
  actor: SessionUser,
  documentId: string,
  requestingUserId: string
): Promise<LibraryDocumentDetail | null> {
  const doc = await prisma.libraryDocument.findFirst({
    where: {
      id: documentId,
      deletedAt: null,
      OR: [{ scope: "SYSTEM" }, { firmId: actor.firmId }]
    },
    include: {
      articles: { orderBy: { articleNumber: "asc" } },
      tags: { include: { tag: true } },
      annotations: {
        where: { firmId: actor.firmId },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!doc) return null;

  return {
    ...docToSummary(doc),
    contentText: doc.contentText,
    legalPrinciple: doc.legalPrinciple,
    author: doc.author,
    articles: doc.articles.map((a) => ({
      id: a.id,
      articleNumber: a.articleNumber,
      title: a.title,
      body: a.body
    })),
    tags: doc.tags.map((t) => t.tag.name),
    annotations: doc.annotations
      .filter((a) => a.userId === requestingUserId || true) // all firm annotations visible to firm members
      .map((a) => ({
        id: a.id,
        body: a.body,
        userId: a.userId,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString()
      }))
  };
}

export async function createDocument(
  actor: SessionUser,
  data: {
    type: string;
    scope?: "SYSTEM" | "FIRM";
    title: string;
    summary?: string;
    contentText?: string;
    legalPrinciple?: string;
    lawNumber?: string;
    lawYear?: number;
    judgmentNumber?: string;
    judgmentDate?: string;
    author?: string;
    publishedAt?: string;
    categoryId?: string;
    legislationStatus?: string;
    tags?: string[];
    articles?: Array<{ articleNumber: string; title?: string; body: string }>;
  }
): Promise<LibraryDocumentDetail> {
  const doc = await prisma.libraryDocument.create({
    data: {
      firmId: data.scope === "SYSTEM" ? null : actor.firmId,
      scope: data.scope ?? "FIRM",
      type: data.type as string,
      title: data.title,
      summary: data.summary ?? null,
      contentText: data.contentText ?? null,
      legalPrinciple: data.legalPrinciple ?? null,
      lawNumber: data.lawNumber ?? null,
      lawYear: data.lawYear ?? null,
      judgmentNumber: data.judgmentNumber ?? null,
      judgmentDate: data.judgmentDate ? new Date(data.judgmentDate) : null,
      author: data.author ?? null,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      categoryId: data.categoryId ?? null,
      legislationStatus: data.legislationStatus ? (data.legislationStatus as "ACTIVE" | "AMENDED" | "REPEALED") : null,
      articles: data.articles
        ? { create: data.articles.map((a) => ({ articleNumber: a.articleNumber, title: a.title ?? null, body: a.body })) }
        : undefined,
      tags: data.tags
        ? {
            create: await Promise.all(
              data.tags.map(async (tagName) => {
                const tag = await prisma.libraryTag.upsert({
                  where: { name: tagName },
                  create: { name: tagName },
                  update: {}
                });
                return { tagId: tag.id };
              })
            )
          }
        : undefined
    },
    include: {
      articles: { orderBy: { articleNumber: "asc" } },
      tags: { include: { tag: true } }
    }
  });

  return {
    ...docToSummary(doc),
    contentText: doc.contentText,
    legalPrinciple: doc.legalPrinciple,
    author: doc.author,
    articles: (doc.articles ?? []).map((a: { id: string; articleNumber: string; title: string | null; body: string }) => ({
      id: a.id,
      articleNumber: a.articleNumber,
      title: a.title,
      body: a.body
    })),
    tags: (doc.tags ?? []).map((t: { tag: { name: string } }) => t.tag.name),
    annotations: []
  };
}

export async function updateDocument(
  actor: SessionUser,
  documentId: string,
  data: Partial<{
    title: string; summary: string; contentText: string;
    legalPrinciple: string; lawNumber: string; lawYear: number; legislationStatus: string;
    categoryId: string; publishedAt: string; author: string;
  }>
): Promise<LibraryDocumentSummary | null> {
  const existing = await prisma.libraryDocument.findFirst({
    where: { id: documentId, deletedAt: null, OR: [{ scope: "SYSTEM" }, { firmId: actor.firmId }] }
  });
  if (!existing) return null;

  const updated = await prisma.libraryDocument.update({
    where: { id: documentId },
    data: {
      title: data.title ?? existing.title,
      summary: data.summary !== undefined ? data.summary : existing.summary,
      contentText: data.contentText !== undefined ? data.contentText : existing.contentText,
      legalPrinciple: data.legalPrinciple !== undefined ? data.legalPrinciple : existing.legalPrinciple,
      lawNumber: data.lawNumber !== undefined ? data.lawNumber : existing.lawNumber,
      lawYear: data.lawYear !== undefined ? data.lawYear : existing.lawYear,
      legislationStatus: data.legislationStatus ? (data.legislationStatus as "ACTIVE" | "AMENDED" | "REPEALED") : existing.legislationStatus,
      categoryId: data.categoryId !== undefined ? data.categoryId : existing.categoryId,
      publishedAt: data.publishedAt !== undefined ? new Date(data.publishedAt) : existing.publishedAt,
      author: data.author !== undefined ? data.author : existing.author
    }
  });
  return docToSummary(updated);
}

export async function softDeleteDocument(actor: SessionUser, documentId: string): Promise<boolean> {
  const existing = await prisma.libraryDocument.findFirst({
    where: { id: documentId, deletedAt: null, firmId: actor.firmId }
  });
  if (!existing) return false;
  await prisma.libraryDocument.update({ where: { id: documentId }, data: { deletedAt: new Date() } });
  return true;
}

// ── Articles ──────────────────────────────────────────────────────────────────

export async function getArticle(
  actor: SessionUser,
  articleId: string
): Promise<(ArticleSummary & { documentId: string; documentTitle: string }) | null> {
  const article = await prisma.legislationArticle.findFirst({
    where: { id: articleId, document: { deletedAt: null, OR: [{ scope: "SYSTEM" }, { firmId: actor.firmId }] } },
    include: { document: { select: { id: true, title: true } } }
  });
  if (!article) return null;
  return {
    id: article.id,
    articleNumber: article.articleNumber,
    title: article.title,
    body: article.body,
    documentId: article.document.id,
    documentTitle: article.document.title
  };
}

// ── Annotations ───────────────────────────────────────────────────────────────

export async function createAnnotation(
  actor: SessionUser,
  documentId: string,
  body: string
): Promise<AnnotationDto> {
  const annotation = await withTenant(prisma, actor.firmId, async (tx) => {
    return tx.libraryAnnotation.create({
      data: { firmId: actor.firmId, documentId, userId: actor.id, body }
    });
  });
  return {
    id: annotation.id,
    body: annotation.body,
    userId: annotation.userId,
    createdAt: annotation.createdAt.toISOString(),
    updatedAt: annotation.updatedAt.toISOString()
  };
}

export async function updateAnnotation(
  actor: SessionUser,
  annotationId: string,
  body: string
): Promise<AnnotationDto | null> {
  const existing = await prisma.libraryAnnotation.findFirst({
    where: { id: annotationId, firmId: actor.firmId, userId: actor.id }
  });
  if (!existing) return null;
  const updated = await prisma.libraryAnnotation.update({ where: { id: annotationId }, data: { body } });
  return { id: updated.id, body: updated.body, userId: updated.userId, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() };
}

export async function deleteAnnotation(actor: SessionUser, annotationId: string): Promise<boolean> {
  const existing = await prisma.libraryAnnotation.findFirst({
    where: { id: annotationId, firmId: actor.firmId, userId: actor.id }
  });
  if (!existing) return false;
  await prisma.libraryAnnotation.delete({ where: { id: annotationId } });
  return true;
}

// ── Case Legal References ─────────────────────────────────────────────────────

export async function listCaseLegalReferences(
  actor: SessionUser,
  caseId: string
): Promise<CaseLegalReferenceDto[]> {
  const refs = await withTenant(prisma, actor.firmId, async (tx) => {
    return tx.caseLegalReference.findMany({
      where: { caseId, case: { firmId: actor.firmId } },
      include: {
        document: { select: { id: true, title: true, type: true } },
        article: { select: { articleNumber: true, title: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  });

  return refs.map(mapCaseReferenceToDto);
}

function mapCaseReferenceToDto(r: {
  id: string;
  caseId: string;
  documentId: string;
  articleId: string | null;
  notes: string | null;
  createdAt: Date;
  document: { title: string; type: string };
  article: { articleNumber: string; title: string | null } | null;
}): CaseLegalReferenceDto {
  return {
    id: r.id,
    caseId: r.caseId,
    documentId: r.documentId,
    articleId: r.articleId,
    notes: r.notes,
    document: { title: r.document.title, type: r.document.type },
    article: r.article ? { articleNumber: r.article.articleNumber, title: r.article.title } : null,
    createdAt: r.createdAt.toISOString()
  };
}

export async function linkDocumentToCase(
  actor: SessionUser,
  caseId: string,
  documentId: string,
  articleId?: string,
  notes?: string
): Promise<CaseLegalReferenceDto> {
  const reference = await withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.caseLegalReference.findFirst({
      where: { caseId, documentId, articleId: articleId ?? null },
      include: {
        document: { select: { title: true, type: true } },
        article: { select: { articleNumber: true, title: true } }
      }
    });
    if (existing) {
      return existing;
    }

    try {
      return await tx.caseLegalReference.create({
        data: { caseId, documentId, articleId: articleId ?? null, notes: notes ?? null },
        include: {
          document: { select: { title: true, type: true } },
          article: { select: { articleNumber: true, title: true } }
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const deduped = await tx.caseLegalReference.findFirst({
          where: { caseId, documentId, articleId: articleId ?? null },
          include: {
            document: { select: { title: true, type: true } },
            article: { select: { articleNumber: true, title: true } }
          }
        });
        if (deduped) {
          return deduped;
        }
      }
      throw error;
    }
  });

  return mapCaseReferenceToDto(reference);
}

export async function unlinkDocumentFromCase(actor: SessionUser, referenceId: string): Promise<boolean> {
  const existing = await prisma.caseLegalReference.findFirst({
    where: { id: referenceId, case: { firmId: actor.firmId } }
  });
  if (!existing) return false;
  await prisma.caseLegalReference.delete({ where: { id: referenceId } });
  return true;
}

// ── Search ────────────────────────────────────────────────────────────────────

export interface LibrarySearchResult {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  scope: string;
  categoryId: string | null;
  articleMatch?: { id: string; articleNumber: string; body: string };
}

export async function searchLibrary(
  actor: SessionUser,
  query: string,
  filter: { type?: string; scope?: string; categoryId?: string } = {},
  limit = 20
): Promise<LibrarySearchResult[]> {
  const normalizedQuery = normalizeArabic(query.trim());
  if (!normalizedQuery) return [];

  // Use PostgreSQL full-text search via raw query for Arabic support
  const results = await prisma.$queryRaw<Array<{
    id: string; type: string; title: string;
    summary: string | null; scope: string; categoryId: string | null;
    article_id: string | null; article_number: string | null; article_body: string | null;
    rank: number;
  }>>`
    SELECT
      d.id,
      d.type,
      d.title,
      d.summary,
      d.scope,
      d."categoryId" AS "categoryId",
      la.id AS article_id,
      la."articleNumber" AS article_number,
      la.body AS article_body,
      ts_rank(
        to_tsvector('simple', coalesce(d.title,'') || ' ' || coalesce(d."contentText",'') || ' ' || coalesce(la.body,'')),
        websearch_to_tsquery('simple', ${normalizedQuery})
      ) AS rank
    FROM "LibraryDocument" d
    LEFT JOIN "LegislationArticle" la ON la."documentId" = d.id
    WHERE d."deletedAt" IS NULL
      AND (d.scope = 'SYSTEM' OR d."firmId" = ${actor.firmId}::uuid)
      AND (
        to_tsvector('simple', coalesce(d.title,'') || ' ' || coalesce(d."contentText",'') || ' ' || coalesce(la.body,''))
        @@ websearch_to_tsquery('simple', ${normalizedQuery})
      )
      ${filter.type ? Prisma.sql`AND d.type = ${filter.type}` : Prisma.empty}
      ${filter.scope ? Prisma.sql`AND d.scope = ${filter.scope}` : Prisma.empty}
      ${filter.categoryId ? Prisma.sql`AND d."categoryId" = ${filter.categoryId}::uuid` : Prisma.empty}
    ORDER BY rank DESC
    LIMIT ${limit}
  `;

  return results.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    summary: r.summary,
    scope: r.scope,
    categoryId: r.categoryId,
    articleMatch: r.article_id
      ? { id: r.article_id, articleNumber: r.article_number ?? "", body: r.article_body ?? "" }
      : undefined
  }));
}
