import type { DocumentSearchResponseDto, DocumentSearchResultDto, SessionUser } from "@elms/shared";
import { prisma } from "../../db/prisma.js";
import { normalizeArabic } from "../../utils/arabic.js";

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
  totalCount: bigint;
};

const SEARCH_SCORING = {
  ftsWeight: 8,
  trigramWeight: 2,
  substringBonus: 0.35,
  prefixBonus: 0.15,
  trigramThreshold: 0.18,
  shortQueryCandidateCap: 160
} as const;

function toTsQueryInput(query: string) {
  return query
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function searchDocuments(
  actor: SessionUser,
  filters: SearchFilters
): Promise<DocumentSearchResponseDto> {
  const { q, caseId, clientId, type, page = 1, pageSize = 20 } = filters;
  const normalizedQuery = normalizeArabic(q.trim());
  const offset = (page - 1) * pageSize;

  if (!normalizedQuery) {
    return { items: [], total: 0, query: "" };
  }

  const firmId = actor.firmId;
  const compactLength = normalizedQuery.replace(/\s+/g, "").length;
  const isShortQuery = compactLength <= 2;
  const tsQueryInput = toTsQueryInput(normalizedQuery);

  const rows = await prisma.$queryRaw<SearchRow[]>`
    WITH params AS (
      SELECT
        unaccent(lower(${normalizedQuery}))::text AS fuzzy_query,
        ${isShortQuery}::boolean AS is_short_query,
        ${SEARCH_SCORING.ftsWeight}::double precision AS fts_weight,
        ${SEARCH_SCORING.trigramWeight}::double precision AS trigram_weight,
        ${SEARCH_SCORING.substringBonus}::double precision AS substring_bonus,
        ${SEARCH_SCORING.prefixBonus}::double precision AS prefix_bonus,
        ${SEARCH_SCORING.trigramThreshold}::double precision AS trigram_threshold,
        ${SEARCH_SCORING.shortQueryCandidateCap}::int AS short_query_candidate_cap,
        CASE
          WHEN ${tsQueryInput}::text <> '' THEN websearch_to_tsquery('simple', unaccent(${tsQueryInput}))
          ELSE NULL::tsquery
        END AS ts_query
    ),
    scoped_docs AS (
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
        d."contentText",
        d.search_vector,
        d."searchTextNormalized"
      FROM "Document" d
      WHERE
        d."firmId" = ${firmId}::uuid
        AND d."deletedAt" IS NULL
        AND d."extractionStatus" = 'INDEXED'
        AND (${caseId ?? null}::uuid IS NULL OR d."caseId" = ${caseId ?? null}::uuid)
        AND (${clientId ?? null}::uuid IS NULL OR d."clientId" = ${clientId ?? null}::uuid)
        AND (${type ?? null}::text IS NULL OR d.type::text = ${type ?? null}::text)
    ),
    fts_matches AS (
      SELECT
        d.id,
        LEAST(1.0::double precision, ts_rank(d.search_vector, p.ts_query)::double precision) AS fts_rank,
        ts_headline(
          'simple',
          unaccent(coalesce(d."contentText", d.title)),
          p.ts_query,
          'MaxFragments=3,MaxWords=30,MinWords=10,StartSel=<mark>,StopSel=</mark>'
        ) AS headline
      FROM scoped_docs d
      CROSS JOIN params p
      WHERE p.ts_query IS NOT NULL
        AND d.search_vector @@ p.ts_query
    ),
    fuzzy_candidates AS (
      SELECT
        d.id,
        similarity(d."searchTextNormalized", p.fuzzy_query)::double precision AS trgm_similarity,
        (d."searchTextNormalized" LIKE ('%' || p.fuzzy_query || '%')) AS substring_match,
        (
          d."searchTextNormalized" LIKE (p.fuzzy_query || '%')
          OR d."searchTextNormalized" LIKE ('% ' || p.fuzzy_query || '%')
        ) AS prefix_match
      FROM scoped_docs d
      CROSS JOIN params p
      WHERE p.fuzzy_query <> ''
        AND (
          (
            NOT p.is_short_query
            AND (
              d."searchTextNormalized" % p.fuzzy_query
              OR similarity(d."searchTextNormalized", p.fuzzy_query) >= p.trigram_threshold
              OR d."searchTextNormalized" LIKE ('%' || p.fuzzy_query || '%')
            )
          )
          OR
          (
            p.is_short_query
            AND (
              d."searchTextNormalized" LIKE (p.fuzzy_query || '%')
              OR d."searchTextNormalized" LIKE ('% ' || p.fuzzy_query || '%')
              OR d."searchTextNormalized" LIKE ('%' || p.fuzzy_query || '%')
            )
          )
        )
    ),
    fuzzy_matches AS (
      SELECT fc.*
      FROM fuzzy_candidates fc
      CROSS JOIN params p
      ORDER BY
        CASE WHEN p.is_short_query AND fc.prefix_match THEN 1 ELSE 0 END DESC,
        CASE WHEN p.is_short_query THEN 0 ELSE fc.trgm_similarity END DESC,
        CASE WHEN fc.substring_match THEN 1 ELSE 0 END DESC,
        fc.id DESC
      LIMIT (
        SELECT CASE WHEN is_short_query THEN short_query_candidate_cap ELSE 1000000 END
        FROM params
      )
    ),
    combined AS (
      SELECT
        id,
        fts_rank,
        0::double precision AS trgm_similarity,
        false AS substring_match,
        false AS prefix_match,
        headline
      FROM fts_matches
      UNION ALL
      SELECT
        id,
        0::double precision AS fts_rank,
        trgm_similarity,
        substring_match,
        prefix_match,
        NULL::text AS headline
      FROM fuzzy_matches
    ),
    scored AS (
      SELECT
        c.id,
        MAX(c.fts_rank) AS fts_rank,
        MAX(c.trgm_similarity) AS trgm_similarity,
        BOOL_OR(c.substring_match) AS substring_match,
        BOOL_OR(c.prefix_match) AS prefix_match,
        MAX(c.headline) FILTER (WHERE c.headline IS NOT NULL) AS headline,
        (
          MAX(c.fts_rank) * (SELECT fts_weight FROM params)
          + MAX(c.trgm_similarity) * (SELECT trigram_weight FROM params)
          + CASE WHEN BOOL_OR(c.substring_match) THEN (SELECT substring_bonus FROM params) ELSE 0 END
          + CASE WHEN BOOL_OR(c.prefix_match) THEN (SELECT prefix_bonus FROM params) ELSE 0 END
        ) AS final_score
      FROM combined c
      GROUP BY c.id
    )
    SELECT
      d.id,
      d.title,
      d."fileName",
      d."mimeType",
      d.type,
      d."extractionStatus",
      d."caseId",
      d."clientId",
      d."createdAt",
      s.final_score AS rank,
      COALESCE(s.headline, left(unaccent(coalesce(d."contentText", d.title)), 240)) AS headline,
      COUNT(*) OVER() AS "totalCount"
    FROM scored s
    JOIN scoped_docs d ON d.id = s.id
    ORDER BY s.final_score DESC, d."createdAt" DESC, d.id DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const total = Number(rows[0]?.totalCount ?? 0);

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
