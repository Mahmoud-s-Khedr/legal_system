import type { DocumentSearchResponseDto, DocumentSearchResultDto, SessionUser } from "@elms/shared";
import { normalizeArabic } from "../../utils/arabic.js";
import { inTenantTransaction } from "../../repositories/unitOfWork.js";
import { searchFirmDocumentsRaw } from "../../repositories/documents/search.repository.js";

interface SearchFilters {
  q: string;
  caseId?: string;
  clientId?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}

export async function searchDocuments(
  actor: SessionUser,
  filters: SearchFilters
): Promise<DocumentSearchResponseDto> {
  const { q, caseId, clientId, type, page = 1, pageSize = 20 } = filters;
  const normalizedQuery = normalizeArabic(q.trim());

  if (!normalizedQuery) {
    return { items: [], total: 0, query: "" };
  }

  const rows = await inTenantTransaction(actor.firmId, async (tx) =>
    searchFirmDocumentsRaw(tx, {
      firmId: actor.firmId,
      normalizedQuery,
      caseId,
      clientId,
      type,
      page,
      pageSize
    })
  );

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
    taskId: row.taskId,
    headline: row.headline ?? "",
    rank: typeof row.rank === "number" ? row.rank : parseFloat(String(row.rank)),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)
  }));

  return { items, total, query: normalizedQuery };
}
