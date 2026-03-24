import type { PrismaClient } from "@prisma/client";

export interface RetrievedExcerpt {
  documentId: string;
  articleId: string | null;
  documentTitle: string;
  articleNumber: string | null;
  excerpt: string;
}

/**
 * Retrieves top-k relevant excerpts from the library using PostgreSQL full-text search.
 * Language `simple` is used for Arabic compatibility (no stemming applied).
 */
export async function retrieveRelevantExcerpts(
  prisma: PrismaClient,
  firmId: string,
  query: string,
  topK = 5
): Promise<RetrievedExcerpt[]> {
  if (!query.trim()) return [];

  const rows = await prisma.$queryRaw<
    {
      document_id: string;
      article_id: string | null;
      document_title: string;
      article_number: string | null;
      excerpt: string;
      rank: number;
    }[]
  >`
    SELECT
      d.id              AS document_id,
      a.id              AS article_id,
      d.title           AS document_title,
      a.number          AS article_number,
      COALESCE(a.body, d.description, d.title) AS excerpt,
      ts_rank(
        to_tsvector('simple', COALESCE(a.body, '') || ' ' || COALESCE(a.title, '') || ' ' || d.title),
        websearch_to_tsquery('simple', ${query})
      ) AS rank
    FROM library_documents d
    LEFT JOIN legislation_articles a ON a.document_id = d.id
    WHERE
      d.deleted_at IS NULL
      AND (d.scope = 'SYSTEM' OR d.firm_id = ${firmId}::uuid)
      AND to_tsvector('simple', COALESCE(a.body, '') || ' ' || COALESCE(a.title, '') || ' ' || d.title)
          @@ websearch_to_tsquery('simple', ${query})
    ORDER BY rank DESC
    LIMIT ${topK}
  `;

  return rows.map((r) => ({
    documentId: r.document_id,
    articleId: r.article_id,
    documentTitle: r.document_title,
    articleNumber: r.article_number,
    excerpt: r.excerpt?.slice(0, 800) ?? ""
  }));
}
