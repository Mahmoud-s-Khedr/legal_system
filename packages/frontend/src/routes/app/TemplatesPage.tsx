import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CaseListResponseDto } from "@elms/shared";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { toCaseSelectOption } from "../../lib/caseOptions";
import {
  exportTemplateDocx,
  useTemplates,
  useDeleteTemplate
} from "../../lib/templates";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  SectionCard,
  SelectField
} from "./ui";
import { getEnumLabel } from "../../lib/enumLabel";
import { useToastStore } from "../../store/toastStore";
import { formatFileSaveSuccessMessage } from "../../lib/fileSaveFeedback";
import { confirmAction } from "../../lib/dialog";

export function TemplatesPage() {
  const { t } = useTranslation("app");
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(
    null
  );
  const deletingTemplateRef = useRef<Set<string>>(new Set());
  const [useCaseByTemplate, setUseCaseByTemplate] = useState<
    Record<string, string>
  >({});
  const [exportingTemplateId, setExportingTemplateId] = useState<string | null>(
    null
  );
  const addToast = useToastStore((state) => state.addToast);

  const {
    data: templates,
    isLoading,
    isError,
    error,
    refetch
  } = useTemplates();
  const deleteMutation = useDeleteTemplate();
  const casesQuery = useQuery({
    queryKey: ["cases", "template-list-use"],
    queryFn: () => apiFetch<CaseListResponseDto>("/api/cases?limit=200")
  });

  const caseOptions = [
    { value: "", label: t("labels.selectCase") },
    ...(casesQuery.data?.items ?? []).map((caseItem) =>
      toCaseSelectOption(t, caseItem)
    )
  ];

  async function requestDeleteConfirmation() {
    try {
      return await confirmAction({
        title: t("actions.confirmDelete"),
        content: t("actions.deleteConfirmMessage"),
        okButtonProps: { danger: true }
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message.trim().toLowerCase() : "";
      const isPatternFailure = message.includes(
        "the string did not match the expected pattern"
      );
      if (isPatternFailure) {
        return confirmAction({
          title: t("actions.confirmDelete"),
          content: t("actions.deleteConfirmMessage"),
          okButtonProps: { danger: true }
        });
      }
      throw error;
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    if (deletingTemplateRef.current.has(templateId)) {
      return;
    }

    const approved = await requestDeleteConfirmation();

    if (!approved || deletingTemplateRef.current.has(templateId)) {
      return;
    }

    deletingTemplateRef.current.add(templateId);
    setDeletingTemplateId(templateId);
    void deleteMutation
      .mutateAsync(templateId)
      .catch(() => {})
      .finally(() => {
        deletingTemplateRef.current.delete(templateId);
        setDeletingTemplateId(null);
      });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("templates.title")}
        description={t("templates.description")}
        actions={
          <Link
            className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white"
            to="/app/templates/new"
          >
            {t("templates.new")}
          </Link>
        }
      />

      <SectionCard title={t("templates.list")}>
        {isLoading && (
          <p className="text-sm text-slate-500">{t("labels.loading")}</p>
        )}
        {!isLoading && isError && (
          <ErrorState
            title={t("errors.title")}
            description={(error as Error)?.message ?? t("errors.fallback")}
            retryLabel={t("errors.reload")}
            onRetry={() => void refetch()}
          />
        )}

        {!isLoading && !isError && !templates?.length && (
          <EmptyState
            title={t("empty.noTemplates")}
            description={t("empty.noTemplatesHelp")}
          />
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
                    {getEnumLabel(t, "Language", tpl.language)}{" "}
                    {tpl.isSystem ? `· ${t("templates.system")}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!tpl.isSystem && (
                    <>
                      <div className="min-w-64">
                        <SelectField
                          label={t("labels.case")}
                          value={useCaseByTemplate[tpl.id] ?? ""}
                          onChange={(value) =>
                            setUseCaseByTemplate((current) => ({
                              ...current,
                              [tpl.id]: value
                            }))
                          }
                          options={caseOptions}
                          hint={
                            casesQuery.isError
                              ? (casesQuery.error as Error)?.message ??
                                t("errors.fallback")
                              : undefined
                          }
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const caseId = useCaseByTemplate[tpl.id] ?? "";
                          if (!caseId) {
                            addToast(
                              t("templates.validation.caseIdRequired"),
                              "error"
                            );
                            return;
                          }
                          setExportingTemplateId(tpl.id);
                          void exportTemplateDocx(tpl.id, "rendered", caseId)
                            .then((savedPath) =>
                              addToast(
                                formatFileSaveSuccessMessage(t, savedPath),
                                "success"
                              )
                            )
                            .catch((error) =>
                              addToast((error as Error).message, "error")
                            )
                            .finally(() => setExportingTemplateId(null));
                        }}
                        disabled={exportingTemplateId === tpl.id}
                        className="rounded-xl bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {exportingTemplateId === tpl.id
                          ? t("labels.loading")
                          : t("templates.use")}
                      </button>
                      <Link
                        to="/app/templates/$templateId/edit"
                        params={{ templateId: tpl.id }}
                        className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                      >
                        {t("actions.edit")}
                      </Link>
                      <button
                        onClick={() => void handleDeleteTemplate(tpl.id)}
                        disabled={deletingTemplateId === tpl.id}
                        className="rounded-xl px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        {t("actions.delete")}
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
