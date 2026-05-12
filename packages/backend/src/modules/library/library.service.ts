import type { SessionUser } from "@elms/shared";
import { LibraryDocumentType } from "@elms/shared";
import { prisma } from "../../db/prisma.js";
import { withTenant } from "../../db/tenant.js";
import { Prisma } from "@prisma/client";
import { buildFuzzySearchCandidates } from "../../utils/fuzzySearch.js";
import { normalizeArabic } from "../../utils/arabic.js";
import { appError } from "../../errors/appError.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CategoryTree {
  id: string;
  typeId: string | null;
  documentType: string;
  nameAr: string;
  nameEn: string;
  nameFr: string;
  slug: string;
  firmId: string | null;
  children: CategoryTree[];
}

export interface LibraryDocumentSummary {
  id: string;
  typeId: string | null;
  typeLabel: string | null;
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
  storageKey: string | null;
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
  typeId?: string;
  scope?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
}

export interface LibraryDocTypeDto {
  id: string;
  code: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  nameFr: string;
  isActive: boolean;
  isDefault: boolean;
}

const DEFAULT_LIBRARY_TYPES: Array<{
  code: LibraryDocumentType;
  slug: string;
  nameAr: string;
  nameEn: string;
  nameFr: string;
}> = [
  {
    code: LibraryDocumentType.LEGISLATION,
    slug: "legislation",
    nameAr: "تشريع",
    nameEn: "Legislation",
    nameFr: "Législation"
  },
  {
    code: LibraryDocumentType.JUDGMENT,
    slug: "judgment",
    nameAr: "حكم",
    nameEn: "Judgment",
    nameFr: "Jugement"
  },
  {
    code: LibraryDocumentType.PRACTICE_GUIDE,
    slug: "practice-guide",
    nameAr: "دليل عملي",
    nameEn: "Practice Guide",
    nameFr: "Guide pratique"
  },
  {
    code: LibraryDocumentType.ARTICLE,
    slug: "article",
    nameAr: "مقال",
    nameEn: "Article",
    nameFr: "Article"
  },
  {
    code: LibraryDocumentType.COMMENTARY,
    slug: "commentary",
    nameAr: "شرح",
    nameEn: "Commentary",
    nameFr: "Commentaire"
  },
  {
    code: LibraryDocumentType.GENERAL,
    slug: "general",
    nameAr: "عام",
    nameEn: "General",
    nameFr: "Général"
  }
];

async function ensureFirmLibraryTypes(actor: SessionUser) {
  const existing = await prisma.libraryDocType.count({
    where: { firmId: actor.firmId }
  });
  if (existing === 0) {
    await prisma.libraryDocType.createMany({
      data: DEFAULT_LIBRARY_TYPES.map((type) => ({
        firmId: actor.firmId,
        code: type.code,
        slug: type.slug,
        nameAr: type.nameAr,
        nameEn: type.nameEn,
        nameFr: type.nameFr,
        isActive: true,
        isDefault: true
      }))
    });
  }

  const typeMap = await prisma.libraryDocType.findMany({
    where: { firmId: actor.firmId },
    select: { id: true, code: true }
  });
  const byCode = new Map(typeMap.map((type) => [type.code, type.id]));

  for (const [code, id] of byCode.entries()) {
    await prisma.legalCategory.updateMany({
      where: { firmId: actor.firmId, documentType: code, typeId: null },
      data: { typeId: id }
    });
    await prisma.libraryDocument.updateMany({
      where: { firmId: actor.firmId, type: code, typeId: null },
      data: { typeId: id }
    });
  }
}

// ── Category helpers ──────────────────────────────────────────────────────────

function buildTree(
  allCategories: Array<{
    id: string;
    typeId: string | null;
    documentType: string;
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
      typeId: c.typeId,
      documentType: c.documentType,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      nameFr: c.nameFr,
      slug: c.slug,
      firmId: c.firmId,
      children: buildTree(allCategories, c.id)
    }));
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function listCategories(
  actor: SessionUser,
  typeId?: string
): Promise<CategoryTree[]> {
  await ensureFirmLibraryTypes(actor);
  const rows = await prisma.legalCategory.findMany({
    where: {
      firmId: actor.firmId,
      ...(typeId ? { typeId } : {})
    },
    select: {
      id: true,
      typeId: true,
      documentType: true,
      nameAr: true,
      nameEn: true,
      nameFr: true,
      slug: true,
      firmId: true,
      parentId: true
    },
    orderBy: { nameEn: "asc" }
  });
  return buildTree(rows);
}

export async function listLibraryTypes(actor: SessionUser): Promise<LibraryDocTypeDto[]> {
  await ensureFirmLibraryTypes(actor);
  const rows = await prisma.libraryDocType.findMany({
    where: { firmId: actor.firmId },
    orderBy: [{ isActive: "desc" }, { nameEn: "asc" }]
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    slug: row.slug,
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    nameFr: row.nameFr,
    isActive: row.isActive,
    isDefault: row.isDefault
  }));
}

export async function createLibraryType(
  actor: SessionUser,
  data: Omit<LibraryDocTypeDto, "id" | "isDefault">
): Promise<LibraryDocTypeDto> {
  await ensureFirmLibraryTypes(actor);
  const created = await prisma.libraryDocType.create({
    data: {
      firmId: actor.firmId,
      code: data.code,
      slug: data.slug,
      nameAr: data.nameAr,
      nameEn: data.nameEn,
      nameFr: data.nameFr,
      isActive: data.isActive,
      isDefault: false
    }
  });
  return {
    id: created.id,
    code: created.code,
    slug: created.slug,
    nameAr: created.nameAr,
    nameEn: created.nameEn,
    nameFr: created.nameFr,
    isActive: created.isActive,
    isDefault: created.isDefault
  };
}

export async function updateLibraryType(
  actor: SessionUser,
  typeId: string,
  data: Partial<Omit<LibraryDocTypeDto, "id">>
): Promise<LibraryDocTypeDto | null> {
  await ensureFirmLibraryTypes(actor);
  const existing = await prisma.libraryDocType.findFirst({
    where: { id: typeId, firmId: actor.firmId }
  });
  if (!existing) return null;
  const updated = await prisma.libraryDocType.update({
    where: { id: typeId },
    data: {
      code: data.code ?? existing.code,
      slug: data.slug ?? existing.slug,
      nameAr: data.nameAr ?? existing.nameAr,
      nameEn: data.nameEn ?? existing.nameEn,
      nameFr: data.nameFr ?? existing.nameFr,
      isActive: data.isActive ?? existing.isActive
    }
  });
  return {
    id: updated.id,
    code: updated.code,
    slug: updated.slug,
    nameAr: updated.nameAr,
    nameEn: updated.nameEn,
    nameFr: updated.nameFr,
    isActive: updated.isActive,
    isDefault: updated.isDefault
  };
}

export async function createCategory(
  actor: SessionUser,
  data: {
    nameAr: string;
    nameEn: string;
    nameFr: string;
    slug: string;
    typeId: string;
    parentId?: string;
  }
): Promise<CategoryTree> {
  const type = await prisma.libraryDocType.findFirst({
    where: { id: data.typeId, firmId: actor.firmId, isActive: true }
  });
  if (!type) throw appError("Library type not found or inactive", 404);

  if (data.parentId) {
    const parent = await prisma.legalCategory.findFirst({
      where: {
        id: data.parentId,
        firmId: actor.firmId
      }
    });
    if (!parent) throw appError("Parent category not found", 404);
    if (parent.typeId !== data.typeId) {
      throw appError("Parent category type must match category type", 400);
    }
  }

  const cat = await prisma.legalCategory.create({
    data: {
      firmId: actor.firmId,
      typeId: data.typeId,
      documentType: type.code,
      nameAr: data.nameAr,
      nameEn: data.nameEn,
      nameFr: data.nameFr,
      slug: data.slug,
      parentId: data.parentId ?? null
    }
  });
  return {
    id: cat.id,
    typeId: cat.typeId,
    documentType: cat.documentType,
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
  data: {
    nameAr?: string;
    nameEn?: string;
    nameFr?: string;
    slug?: string;
    typeId?: string;
    parentId?: string | null;
  }
): Promise<CategoryTree | null> {
  const existing = await prisma.legalCategory.findFirst({
    where: { id: categoryId, firmId: actor.firmId }
  });
  if (!existing) return null;

  const nextTypeId = data.typeId ?? existing.typeId;
  if (!nextTypeId) throw appError("Category type is required", 400);
  const type = await prisma.libraryDocType.findFirst({
    where: { id: nextTypeId, firmId: actor.firmId, isActive: true }
  });
  if (!type) throw appError("Library type not found or inactive", 404);

  if (data.parentId) {
    const parent = await prisma.legalCategory.findFirst({
      where: {
        id: data.parentId,
        firmId: actor.firmId
      }
    });
    if (!parent) throw appError("Parent category not found", 404);
    if (parent.typeId !== nextTypeId) {
      throw appError("Parent category type must match category type", 400);
    }
  }

  const updateResult = await prisma.legalCategory.updateMany({
    where: { id: categoryId, firmId: actor.firmId },
    data: {
      typeId: nextTypeId,
      documentType: type.code,
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
    typeId: updated.typeId,
    documentType: updated.documentType,
    nameAr: updated.nameAr,
    nameEn: updated.nameEn,
    nameFr: updated.nameFr,
    slug: updated.slug,
    firmId: updated.firmId,
    children: []
  };
}

async function validateCategoryForType(
  actor: SessionUser,
  categoryId: string | undefined,
  typeId: string
) {
  if (!categoryId) return;
  const category = await prisma.legalCategory.findFirst({
    where: {
      id: categoryId,
      firmId: actor.firmId
    },
    select: { id: true, typeId: true }
  });
  if (!category) {
    throw appError("Category not found", 404);
  }
  if (category.typeId !== typeId) {
    throw appError("Category does not match selected document type", 400);
  }
}

export async function deleteCategory(actor: SessionUser, categoryId: string): Promise<boolean> {
  const deleted = await prisma.legalCategory.deleteMany({
    where: { id: categoryId, firmId: actor.firmId }
  });
  return deleted.count > 0;
}

// ── Documents ─────────────────────────────────────────────────────────────────

function docToSummary(doc: {
  id: string; typeId: string | null; type: string; scope: string; title: string;
  summary: string | null; lawNumber: string | null; lawYear: number | null;
  judgmentNumber: string | null; judgmentDate: Date | null; publishedAt: Date | null;
  legislationStatus: string | null; categoryId: string | null; firmId: string | null;
  createdAt: Date;
  docType?: { nameAr: string; nameEn: string; nameFr: string } | null;
}): LibraryDocumentSummary {
  return {
    id: doc.id,
    typeId: doc.typeId,
    typeLabel: doc.docType?.nameEn ?? null,
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
  if (filter.typeId) where.typeId = filter.typeId;
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
        id: true, typeId: true, type: true, scope: true, title: true, summary: true,
        lawNumber: true, lawYear: true, judgmentNumber: true, judgmentDate: true,
        publishedAt: true, legislationStatus: true, categoryId: true, firmId: true, createdAt: true,
        docType: { select: { nameAr: true, nameEn: true, nameFr: true } }
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
    storageKey: doc.storageKey,
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
    typeId?: string;
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
  let resolvedTypeId = data.typeId;
  if (!resolvedTypeId) {
    const fallback = await prisma.libraryDocType.findFirst({
      where: { firmId: actor.firmId, code: data.type, isActive: true }
    });
    resolvedTypeId = fallback?.id;
  }
  if (!resolvedTypeId) throw appError("Library type is required", 400);
  await validateCategoryForType(actor, data.categoryId, resolvedTypeId);

  const doc = await prisma.libraryDocument.create({
    data: {
      firmId: actor.firmId,
      scope: "FIRM",
      typeId: resolvedTypeId,
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
    storageKey: doc.storageKey,
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

  const effectiveTypeId = existing.typeId;
  if (!effectiveTypeId) throw appError("Document type is missing", 400);
  const requestedCategoryId =
    data.categoryId !== undefined ? data.categoryId : existing.categoryId ?? undefined;
  await validateCategoryForType(actor, requestedCategoryId, effectiveTypeId);

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
  filter: { type?: string; typeId?: string; scope?: string; categoryId?: string } = {},
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
    WITH ranked AS (
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
        ) AS rank,
        CASE
          WHEN lower(coalesce(d.title, '')) = lower(${normalizedQuery}) THEN 300
          WHEN lower(coalesce(la."articleNumber", '')) = lower(${normalizedQuery}) THEN 260
          WHEN lower(coalesce(d.title, '')) LIKE lower(${`${normalizedQuery}%`}) THEN 220
          WHEN lower(coalesce(la."articleNumber", '')) LIKE lower(${`${normalizedQuery}%`}) THEN 200
          WHEN lower(coalesce(d.title, '')) LIKE lower(${`%${normalizedQuery}%`}) THEN 160
          WHEN lower(coalesce(la."articleNumber", '')) LIKE lower(${`%${normalizedQuery}%`}) THEN 150
          ELSE 0
        END AS boost,
        ROW_NUMBER() OVER (
          PARTITION BY d.id, coalesce(la.id, d.id)
          ORDER BY
            CASE
              WHEN lower(coalesce(d.title, '')) = lower(${normalizedQuery}) THEN 300
              WHEN lower(coalesce(la."articleNumber", '')) = lower(${normalizedQuery}) THEN 260
              WHEN lower(coalesce(d.title, '')) LIKE lower(${`${normalizedQuery}%`}) THEN 220
              WHEN lower(coalesce(la."articleNumber", '')) LIKE lower(${`${normalizedQuery}%`}) THEN 200
              WHEN lower(coalesce(d.title, '')) LIKE lower(${`%${normalizedQuery}%`}) THEN 160
              WHEN lower(coalesce(la."articleNumber", '')) LIKE lower(${`%${normalizedQuery}%`}) THEN 150
              ELSE 0
            END DESC,
            ts_rank(
              to_tsvector('simple', coalesce(d.title,'') || ' ' || coalesce(d."contentText",'') || ' ' || coalesce(la.body,'')),
              websearch_to_tsquery('simple', ${normalizedQuery})
            ) DESC,
            d.id ASC
        ) AS dedupe_rank
      FROM "LibraryDocument" d
      LEFT JOIN "LegislationArticle" la ON la."documentId" = d.id
      WHERE d."deletedAt" IS NULL
        AND (d.scope = 'SYSTEM' OR d."firmId" = ${actor.firmId}::uuid)
        AND (
          to_tsvector('simple', coalesce(d.title,'') || ' ' || coalesce(d."contentText",'') || ' ' || coalesce(la.body,''))
          @@ websearch_to_tsquery('simple', ${normalizedQuery})
          OR lower(coalesce(d.title, '')) LIKE lower(${`%${normalizedQuery}%`})
          OR lower(coalesce(la."articleNumber", '')) LIKE lower(${`%${normalizedQuery}%`})
        )
        ${filter.type ? Prisma.sql`AND d.type = ${filter.type}` : Prisma.empty}
        ${filter.typeId ? Prisma.sql`AND d."typeId" = ${filter.typeId}::uuid` : Prisma.empty}
        ${filter.scope ? Prisma.sql`AND d.scope = ${filter.scope}` : Prisma.empty}
        ${filter.categoryId ? Prisma.sql`AND d."categoryId" = ${filter.categoryId}::uuid` : Prisma.empty}
    )
    SELECT
      id,
      type,
      title,
      summary,
      scope,
      "categoryId",
      article_id,
      article_number,
      article_body,
      rank
    FROM ranked
    WHERE dedupe_rank = 1
    ORDER BY boost DESC, rank DESC, title ASC, id ASC
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
