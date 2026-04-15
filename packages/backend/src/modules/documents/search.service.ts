import type { DocumentSearchResponseDto, DocumentSearchResultDto, SessionUser } from "@elms/shared";
import { prisma } from "../../db/prisma.js";

interface SearchFilters {
  q: string;
  caseId?: string;
  clientId?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}

type SearchRow = {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  type: string;
  extractionStatus: string;
  caseId: string | null;
  clientId: string | null;
  createdAt: Date;
  rank: number;
  headline: string;
};

export async function searchDocuments(
  actor: SessionUser,
  filters: SearchFilters
): Promise<DocumentSearchResponseDto> {
  const { q, caseId, clientId, type, page = 1, pageSize = 20 } = filters;
  const normalizedQuery = q.trim();
  const offset = (page - 1) * pageSize;

  if (!normalizedQuery) {
    return { items: [], total: 0, query: "" };
  }

  const firmId = actor.firmId;

  const rows = await prisma.$queryRaw<SearchRow[]>`
    SELECT
      d.id,
      d.title,
      d."fileName",
      d."mimeType",
      d.type::text AS type,
      d."extractionStatus"::text AS "extractionStatus",
      d."caseId",
      d."clientId",
      d."createdAt",
      ts_rank(d.search_vector, query) AS rank,
      ts_headline(
        'simple',
        unaccent(coalesce(d."contentText", d.title)),
        query,
        'MaxFragments=3,MaxWords=30,MinWords=10,StartSel=<mark>,StopSel=</mark>'
      ) AS headline
    FROM "Document" d,
         websearch_to_tsquery('simple', unaccent(${normalizedQuery})) query
    WHERE
      d."firmId" = ${firmId}::uuid
      AND d."deletedAt" IS NULL
      AND d."extractionStatus" = 'INDEXED'
      AND d.search_vector @@ query
      AND (${caseId ?? null}::uuid IS NULL OR d."caseId" = ${caseId ?? null}::uuid)
      AND (${clientId ?? null}::uuid IS NULL OR d."clientId" = ${clientId ?? null}::uuid)
      AND (${type ?? null}::text IS NULL OR d.type::text = ${type ?? null}::text)
    ORDER BY rank DESC, d."createdAt" DESC, d.id DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const countRows = await prisma.$queryRaw<[{ total: bigint }]>`
    SELECT count(*) AS total
    FROM "Document" d,
         websearch_to_tsquery('simple', unaccent(${normalizedQuery})) query
    WHERE
      d."firmId" = ${firmId}::uuid
      AND d."deletedAt" IS NULL
      AND d."extractionStatus" = 'INDEXED'
      AND d.search_vector @@ query
      AND (${caseId ?? null}::uuid IS NULL OR d."caseId" = ${caseId ?? null}::uuid)
      AND (${clientId ?? null}::uuid IS NULL OR d."clientId" = ${clientId ?? null}::uuid)
      AND (${type ?? null}::text IS NULL OR d.type::text = ${type ?? null}::text)
  `;

  const total = Number(countRows[0]?.total ?? 0);

  const items: DocumentSearchResultDto[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    fileName: row.fileName,
    mimeType: row.mimeType,
    type: row.type as DocumentSearchResultDto["type"],
    extractionStatus: row.extractionStatus as DocumentSearchResultDto["extractionStatus"],
    caseId: row.caseId,
    clientId: row.clientId,
    headline: row.headline ?? "",
    rank: typeof row.rank === "number" ? row.rank : parseFloat(String(row.rank)),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)
  }));

  return { items, total, query: normalizedQuery };
}
