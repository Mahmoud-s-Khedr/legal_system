import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BookOpen, Plus, Trash2, Search } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { EmptyState, PrimaryButton, SectionCard } from "../../routes/app/ui";

function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

interface LegalReference {
  id: string;
  notes: string | null;
  document: {
    id: string;
    title: string;
    type: string;
  };
  article: {
    id: string;
    number: string | null;
    title: string | null;
  } | null;
}

interface SearchResult {
  id: string;
  title: string;
  type: string;
  kind: "document" | "article";
  documentId: string;
}

export function CaseLegalReferencesTab({ caseId }: { caseId: string }) {
  const { t } = useTranslation("app");
  const queryClient = useQueryClient();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [notes, setNotes] = useState("");

  const refsQuery = useQuery({
    queryKey: ["case-legal-refs", caseId],
    queryFn: () => apiFetch<LegalReference[]>(`/api/cases/${caseId}/legal-references`)
  });

  const searchQuery = useQuery({
    enabled: searchQ.length > 1,
    queryKey: ["library-search-link", searchQ],
    queryFn: () => apiFetch<{ results: SearchResult[] }>(`/api/library/search?q=${encodeURIComponent(searchQ)}&limit=10`)
  });

  const linkMutation = useMutation({
    mutationFn: ({ documentId, articleId, notesVal }: { documentId: string; articleId?: string; notesVal: string }) =>
      apiFetch(`/api/cases/${caseId}/legal-references`, {
        method: "POST",
        body: JSON.stringify({ documentId, articleId: articleId || undefined, notes: notesVal || undefined })
      }),
    onSuccess: () => {
      setShowSearch(false);
      setSearchQ("");
      setNotes("");
      void queryClient.invalidateQueries({ queryKey: ["case-legal-refs", caseId] });
    }
  });

  const unlinkMutation = useMutation({
    mutationFn: (referenceId: string) =>
      apiFetch(`/api/cases/legal-references/${referenceId}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["case-legal-refs", caseId] });
    }
  });

  return (
    <SectionCard description={t("library.referencesHelp")} title={t("cases.tabs.references")}>
      <div className="space-y-3">
        {!refsQuery.data?.length ? (
          <EmptyState description={t("empty.noReferencesHelp")} title={t("empty.noReferences")} />
        ) : (
          refsQuery.data.map((ref) => {
            const docTitle = ref.document.title;
            return (
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4" key={ref.id}>
                <BookOpen aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <Link
                    className="font-semibold hover:text-accent"
                    params={{ documentId: ref.document.id }}
                    to="/app/library/documents/$documentId"
                  >
                    {docTitle}
                  </Link>
                  <p className="text-xs text-slate-500">{ref.document.type}</p>
                  {ref.article && (
                    <p className="mt-0.5 text-sm text-slate-600">
                      {t("library.article")} {ref.article.number}
                      {ref.article.title ? ` — ${ref.article.title}` : ""}
                    </p>
                  )}
                  {ref.notes && <p className="mt-1 text-sm italic text-slate-500">{ref.notes}</p>}
                </div>
                <button
                  aria-label={t("actions.unlink")}
                  className="rounded-lg p-1 text-slate-400 hover:text-red-500"
                  onClick={() => unlinkMutation.mutate(ref.id)}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {showSearch ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="relative">
            <Search aria-hidden="true" className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              aria-label={t("library.searchPlaceholder")}
              autoFocus
              className="w-full rounded-xl border border-slate-200 bg-white py-2 ps-9 pe-4 text-sm outline-none focus:border-accent"
              placeholder={t("library.searchPlaceholder")}
              type="search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
          </div>

          {searchQuery.data?.results.length ? (
            <>
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {searchQuery.data.results.map((result) => (
                  <button
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-start text-sm transition hover:border-accent"
                    key={`${result.kind}-${result.id}`}
                    onClick={() => {
                      const docId = result.documentId;
                      const artId = result.kind === "article" ? result.id : undefined;
                      linkMutation.mutate({ documentId: docId, articleId: artId, notesVal: notes });
                    }}
                  >
                    <BookOpen aria-hidden="true" className="size-4 shrink-0 text-accent" />
                    <span className="font-medium">{result.title}</span>
                    <span className="ms-auto text-xs text-slate-400">{result.type}</span>
                  </button>
                ))}
              </div>
              <FieldWrap label={t("library.linkNotes")}>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent"
                  placeholder={t("library.linkNotesPlaceholder")}
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </FieldWrap>
            </>
          ) : searchQ.length > 1 ? (
            <p className="text-sm text-slate-500">{t("empty.noResults")}</p>
          ) : null}

          <button
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
            onClick={() => { setShowSearch(false); setSearchQ(""); }}
          >
            {t("actions.cancel")}
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <PrimaryButton onClick={() => setShowSearch(true)}>
            <Plus aria-hidden="true" className="size-4" />
            {t("library.addReference")}
          </PrimaryButton>
        </div>
      )}
    </SectionCard>
  );
}
