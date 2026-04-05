import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import type { TemplateDto, UpdateTemplateDto } from "../../lib/templates";
import { EmptyState, Field, FormExitActions, PageHeader, SectionCard, SelectField } from "./ui";
import { useTemplateRender } from "../../lib/templates";

const LANGUAGES = ["AR", "EN", "FR"];

export function TemplateEditPage() {
  const { t } = useTranslation("app");
  const { templateId } = useParams({ from: "/app/templates/$templateId/edit" });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: tpl, isLoading } = useQuery({
    queryKey: ["templates", templateId],
    queryFn: () => apiFetch<TemplateDto>(`/api/templates/${templateId}`)
  });

  const [form, setForm] = useState<UpdateTemplateDto>({});
  const [renderCaseId, setRenderCaseId] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

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
            update.mutate(form);
          }}
        >
          <Field
            label={t("labels.name")}
            onChange={(v) => setForm({ ...form, name: v })}
            required
            value={form.name ?? ""}
          />
          <SelectField
            label={t("labels.language")}
            value={form.language ?? "AR"}
            onChange={(v) => setForm({ ...form, language: v })}
            options={LANGUAGES.map((l) => ({ value: l, label: l }))}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {t("templates.body")}
            </label>
            <p className="mb-2 text-xs text-slate-400">{t("templates.bodyHelp")}</p>
            <textarea
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm focus:border-accent focus:outline-none"
              rows={16}
              dir="auto"
              value={form.body ?? ""}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
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
                  onSuccess: (data) => setPreview(data.rendered)
                }
              );
            }}
            disabled={renderMutation.isPending || !renderCaseId}
            className="mb-0.5 rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {renderMutation.isPending ? t("labels.loading") : t("templates.render")}
          </button>
        </div>
        {preview !== null && (
          <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-sand p-4 text-sm leading-relaxed" dir="auto">
            {preview}
          </pre>
        )}
      </SectionCard>
    </div>
  );
}
