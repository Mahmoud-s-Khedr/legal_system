import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCreateTemplate, type CreateTemplateDto } from "../../lib/templates";
import { Field, FormExitActions, PageHeader, SectionCard, SelectField } from "./ui";

const LANGUAGES = ["AR", "EN", "FR"];

export function TemplateCreatePage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();

  const [form, setForm] = useState<CreateTemplateDto>({
    name: "",
    language: "AR",
    body: ""
  });

  const create = useCreateTemplate();

  return (
    <div className="space-y-6">
      <PageHeader title={t("templates.createTitle")} description={t("templates.createHelp")} />

      <SectionCard title={t("templates.identity")}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(form, { onSuccess: () => void navigate({ to: "/app/templates" }) });
          }}
        >
          <Field
            label={t("labels.name")}
            onChange={(v) => setForm({ ...form, name: v })}
            required
            value={form.name}
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
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </div>
          <FormExitActions
            cancelTo="/app/templates"
            cancelLabel={t("actions.cancel")}
            submitLabel={t("templates.save")}
            savingLabel={t("labels.saving")}
            submitting={create.isPending}
          />
          {create.error ? (
            <p className="text-sm text-red-600">{(create.error as Error).message}</p>
          ) : null}
        </form>
      </SectionCard>
    </div>
  );
}
