import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BookOpen, ChevronRight, ChevronLeft, Search } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { EmptyState, PageHeader, SectionCard } from "../ui";

interface CategoryNode {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  nameFr: string;
  children: CategoryNode[];
}

interface DocumentSummary {
  id: string;
  title: string;
  type: string;
  scope: string;
  publishedAt: string | null;
  category: { id: string; nameAr: string; nameEn: string; nameFr: string } | null;
}

interface DocumentsResponse {
  items: DocumentSummary[];
  total: number;
  page: number;
  totalPages: number;
}

export function LibraryPage() {
  const { t, i18n } = useTranslation("app");
  const isRtl = i18n.resolvedLanguage === "ar";
  const isFrench = i18n.resolvedLanguage === "fr";
  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [searchQ, setSearchQ] = useState("");

  const categoriesQuery = useQuery({
    queryKey: ["library-categories"],
    queryFn: () => apiFetch<CategoryNode[]>("/api/library/categories")
  });

  const documentsQuery = useQuery({
    queryKey: ["library-documents", selectedCategoryId, page, searchQ],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (selectedCategoryId) params.set("categoryId", selectedCategoryId);
      if (searchQ) params.set("q", searchQ);
      return apiFetch<DocumentsResponse>(`/api/library/documents?${params.toString()}`);
    }
  });

  function localizeCategoryName(category: Pick<CategoryNode, "nameAr" | "nameEn" | "nameFr">) {
    if (isRtl) return category.nameAr;
    if (isFrench) return category.nameFr;
    return category.nameEn;
  }

  function CategoryTree({ nodes, depth = 0 }: { nodes: CategoryNode[]; depth?: number }) {
    return (
      <ul className={depth > 0 ? "ms-4 border-s border-slate-200 ps-3" : ""}>
        {nodes.map((node) => (
          <li key={node.id}>
            <button
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-sm transition hover:bg-accentSoft ${selectedCategoryId === node.id ? "bg-accentSoft font-semibold text-accent" : "text-slate-700"}`}
              onClick={() => {
                setSelectedCategoryId(selectedCategoryId === node.id ? undefined : node.id);
                setPage(1);
              }}
            >
              <ChevronIcon aria-hidden="true" className="size-3 shrink-0 text-slate-400" />
              <span>{localizeCategoryName(node)}</span>
            </button>
            {node.children.length > 0 && (
              <CategoryTree depth={depth + 1} nodes={node.children} />
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description={t("library.description")}
        eyebrow={t("library.eyebrow")}
        title={t("library.title")}
        actions={
          <Link
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold transition hover:border-accent"
            to="/app/library/search"
          >
            <Search aria-hidden="true" className="size-4" />
            {t("library.advancedSearch")}
          </Link>
        }
      />

      <div className="flex gap-6">
        {/* Category Sidebar */}
        <aside aria-label={t("library.categories")} className="w-56 shrink-0">
          <SectionCard title={t("library.categories")}>
            {categoriesQuery.isLoading ? (
              <p className="text-sm text-slate-500">{t("common.loading")}</p>
            ) : (
              <>
                <button
                  className={`mb-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-sm transition hover:bg-accentSoft ${!selectedCategoryId ? "bg-accentSoft font-semibold text-accent" : "text-slate-700"}`}
                  onClick={() => { setSelectedCategoryId(undefined); setPage(1); }}
                >
                  {t("library.allDocuments")}
                </button>
                <CategoryTree nodes={categoriesQuery.data ?? []} />
              </>
            )}
          </SectionCard>
        </aside>

        {/* Document List */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="relative">
            <Search aria-hidden="true" className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 ps-9 pe-4 text-sm outline-none focus:border-accent"
              placeholder={t("library.searchPlaceholder")}
              type="search"
              value={searchQ}
              onChange={(e) => { setSearchQ(e.target.value); setPage(1); }}
            />
          </div>

          {documentsQuery.isLoading ? (
            <p className="text-sm text-slate-500">{t("common.loading")}</p>
          ) : !documentsQuery.data?.items.length ? (
            <EmptyState description={t("empty.noDocumentsHelp")} title={t("empty.noDocuments")} />
          ) : (
            <div className="space-y-3">
              {documentsQuery.data.items.map((doc) => (
                <Link
                  className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-accent"
                  key={doc.id}
                  params={{ documentId: doc.id }}
                  to="/app/library/documents/$documentId"
                >
                  <BookOpen aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent" />
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug">
                      {doc.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {doc.type}
                      {doc.category ? ` · ${localizeCategoryName(doc.category)}` : ""}
                      {doc.publishedAt ? ` · ${new Date(doc.publishedAt).getFullYear()}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {documentsQuery.data && documentsQuery.data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("pagination.prev")}
              </button>
              <span className="text-sm text-slate-600">
                {page} / {documentsQuery.data.totalPages}
              </span>
              <button
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm disabled:opacity-40"
                disabled={page >= documentsQuery.data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("pagination.next")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
