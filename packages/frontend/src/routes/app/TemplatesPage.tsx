import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useTemplates, useDeleteTemplate } from "../../lib/templates";
import { EmptyState, ErrorState, PageHeader, SectionCard } from "./ui";
import { getEnumLabel } from "../../lib/enumLabel";
import { useToastStore } from "../../store/toastStore";

export function TemplatesPage() {
  const { t } = useTranslation("app");
  const [deleting, setDeleting] = useState<string | null>(null);
  const addToast = useToastStore((state) => state.addToast);

  const { data: templates, isLoading, isError, error, refetch } = useTemplates();
  const deleteMutation = useDeleteTemplate();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("templates.title")}
        description={t("templates.description")}
        actions={
          <Link className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white" to="/app/templates/new">
            {t("templates.new")}
          </Link>
        }
      />

      <SectionCard title={t("templates.list")}>
        {isLoading && <p className="text-sm text-slate-500">{t("labels.loading")}</p>}
        {!isLoading && isError && (
          <ErrorState
            title={t("errors.title")}
            description={(error as Error)?.message ?? t("errors.fallback")}
            retryLabel={t("errors.reload")}
            onRetry={() => void refetch()}
          />
        )}

        {!isLoading && !isError && !templates?.length && (
          <EmptyState title={t("empty.noTemplates")} description={t("empty.noTemplatesHelp")} />
        )}

        {!isLoading && !isError && !!templates?.length && (
          <div className="space-y-2">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div>
                  <p className="font-semibold">{tpl.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {getEnumLabel(t, "Language", tpl.language)} {tpl.isSystem ? `· ${t("templates.system")}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!tpl.isSystem && (
                    <>
                      <Link
                        to="/app/templates/$templateId/edit"
                        params={{ templateId: tpl.id }}
                        className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                      >
                        {t("actions.edit")}
                      </Link>
                      <button
                        onClick={() => {
                          if (deleting === tpl.id) {
                            void deleteMutation
                              .mutateAsync(tpl.id)
                              .then(() => setDeleting(null))
                              .catch((error) => {
                                setDeleting(null);
                                addToast((error as Error)?.message ?? t("errors.fallback"), "error");
                              });
                          } else {
                            setDeleting(tpl.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="rounded-xl px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        {deleting === tpl.id ? t("templates.confirmDelete") : t("actions.delete")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
