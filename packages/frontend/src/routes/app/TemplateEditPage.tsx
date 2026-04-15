import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { exportTemplateDocx, type TemplateDto, type UpdateTemplateDto } from "../../lib/templates";
import { EmptyState, Field, FormExitActions, PageHeader, SectionCard, SelectField } from "./ui";
import { useTemplateRender } from "../../lib/templates";
import { TemplateRichEditor } from "../../components/templates/TemplateRichEditor";
import { isTemplateHtmlEmpty, normalizeTemplateHtml, sanitizeTemplateHtml } from "../../lib/templateEditor";
import { useToastStore } from "../../store/toastStore";

const LANGUAGES = ["AR", "EN", "FR"];

export function TemplateEditPage() {
  const { t } = useTranslation("app");
  const { templateId } = useParams({ from: "/app/templates/$templateId/edit" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);

  const { data: tpl, isLoading } = useQuery({
    queryKey: ["templates", templateId],
    queryFn: () => apiFetch<TemplateDto>(`/api/templates/${templateId}`)
  });

  const [form, setForm] = useState<UpdateTemplateDto>({});
  const [renderCaseId, setRenderCaseId] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [exportingTemplate, setExportingTemplate] = useState(false);
  const [exportingRendered, setExportingRendered] = useState(false);

  useEffect(() => {
    if (tpl) {
      setForm({ name: tpl.name, language: tpl.language, body: tpl.body });
    }
  }, [tpl]);

  const update = useMutation({
    mutationFn: (dto: UpdateTemplateDto) =>
      apiFetch<TemplateDto>(`/api/templates/${templateId}`, {
        method: "PUT",
        body: JSON.stringify(dto)
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["templates"] });
      void navigate({ to: "/app/templates" });
    }
  });

  const renderMutation = useTemplateRender(templateId);

  if (isLoading) {
    return <p className="p-6 text-sm text-slate-500">{t("labels.loading")}</p>;
  }

  if (!tpl) {
    return <EmptyState title={t("errors.notFound")} description="" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("templates.editTitle")} description={tpl.name} />

      <SectionCard title={t("templates.identity")}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (tpl.isSystem) {
              return;
            }
            const normalizedBody = normalizeTemplateHtml(form.body ?? "");
            if (isTemplateHtmlEmpty(normalizedBody)) {
              setValidationError(t("templates.validation.bodyRequired"));
              return;
            }
            setValidationError(null);
            update.mutate({ ...form, body: normalizedBody });
          }}
        >
          <Field
            label={t("labels.name")}
            onChange={(v) => setForm({ ...form, name: v })}
            required
            value={form.name ?? ""}
            disabled={tpl.isSystem}
          />
          <SelectField
            label={t("labels.language")}
            value={form.language ?? "AR"}
            onChange={(v) => setForm({ ...form, language: v })}
            options={LANGUAGES.map((l) => ({ value: l, label: l }))}
            disabled={tpl.isSystem}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {t("templates.body")}
            </label>
            <p className="mb-2 text-xs text-slate-400">{t("templates.bodyHelp")}</p>
            <TemplateRichEditor
              value={form.body ?? ""}
              language={form.language ?? "AR"}
              onChange={(body) => {
                setForm({ ...form, body });
                if (validationError) {
                  setValidationError(null);
                }
              }}
              disabled={tpl.isSystem}
            />
            {validationError ? <p className="mt-2 text-sm text-red-600">{validationError}</p> : null}
          </div>
          {!tpl.isSystem && (
            <FormExitActions
              cancelTo="/app/templates"
              cancelLabel={t("actions.cancel")}
              submitLabel={t("actions.saveChanges")}
              savingLabel={t("labels.saving")}
              submitting={update.isPending}
            />
          )}
          {update.error ? (
            <p className="text-sm text-red-600">{(update.error as Error).message}</p>
          ) : null}
        </form>
      </SectionCard>

      <SectionCard title={t("templates.preview")} description={t("templates.previewHelp")}>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Field
              label={t("labels.caseId")}
              placeholder={t("labels.caseIdPlaceholder")}
              value={renderCaseId}
              onChange={setRenderCaseId}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (!renderCaseId) {
                return;
              }
              renderMutation.mutate(
                { caseId: renderCaseId },
                {
                  onSuccess: (data) => {
                    setPreviewHtml(sanitizeTemplateHtml(data.renderedHtml));
                    setPreviewText(data.renderedText);
                  }
                }
              );
            }}
            disabled={renderMutation.isPending || !renderCaseId}
            className="mb-0.5 rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {renderMutation.isPending ? t("labels.loading") : t("templates.render")}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setExportingTemplate(true);
              void exportTemplateDocx(templateId, "template")
                .then(() => addToast(t("reports.exportReady", { format: "DOCX" }), "success"))
                .catch((error) => addToast((error as Error).message, "error"))
                .finally(() => setExportingTemplate(false));
            }}
            disabled={exportingTemplate}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {exportingTemplate ? t("labels.loading") : t("templates.exportTemplateDocx")}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!renderCaseId) {
                addToast(t("templates.validation.caseIdRequired"), "error");
                return;
              }
              setExportingRendered(true);
              void exportTemplateDocx(templateId, "rendered", renderCaseId)
                .then(() => addToast(t("reports.exportReady", { format: "DOCX" }), "success"))
                .catch((error) => addToast((error as Error).message, "error"))
                .finally(() => setExportingRendered(false));
            }}
            disabled={exportingRendered}
            className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {exportingRendered ? t("labels.loading") : t("templates.exportRenderedDocx")}
          </button>
        </div>
        {previewHtml !== null && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("templates.previewRich")}</p>
            <div className="prose prose-sm max-w-none" dir="auto" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        )}
        {previewText !== null && (
          <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-sand p-4 text-sm leading-relaxed" dir="auto">
            {previewText}
          </pre>
        )}
      </SectionCard>
    </div>
  );
}
