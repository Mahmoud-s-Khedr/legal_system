import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateLookupOptionDto, LookupOptionDto, LookupOptionListResponseDto, UpdateLookupOptionDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { EmptyState, Field, PageHeader, PrimaryButton, SectionCard } from "./ui";

const EMPTY_CREATE: CreateLookupOptionDto = {
  key: "",
  labelAr: "",
  labelEn: "",
  labelFr: "",
  sortOrder: 0
};

export function LookupSettingsDetailPage() {
  const { t } = useTranslation("app");
  const { entity } = useParams({ from: "/app/settings/lookups/$entity" });
  const queryClient = useQueryClient();

  const optionsQuery = useQuery({
    queryKey: ["lookups", entity],
    queryFn: () => apiFetch<LookupOptionListResponseDto>(`/api/lookups/${entity}`)
  });

  const [createForm, setCreateForm] = useState<CreateLookupOptionDto>(EMPTY_CREATE);
  const [editingOption, setEditingOption] = useState<LookupOptionDto | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: CreateLookupOptionDto) =>
      apiFetch(`/api/lookups/${entity}`, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      setCreateForm(EMPTY_CREATE);
      setCreateError(null);
      await queryClient.invalidateQueries({ queryKey: ["lookups", entity] });
    },
    onError: (err: Error) => setCreateError(err.message)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateLookupOptionDto }) =>
      apiFetch(`/api/lookups/${entity}/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      setEditingOption(null);
      await queryClient.invalidateQueries({ queryKey: ["lookups", entity] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/lookups/${entity}/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["lookups", entity] });
    }
  });

  const items = optionsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("lookups.title")}
        title={t(`lookups.entities.${entity}`, entity)}
        description={t("lookups.detailDescription")}
      />
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title={t("lookups.optionsList")} description={t("lookups.optionsListHelp")}>
          {!items.length ? (
            <EmptyState title={t("empty.noLookupOptions")} description={t("empty.noLookupOptionsHelp")} />
          ) : (
            <div className="space-y-2">
              {items.map((option) => (
                <div
                  className={`flex items-center justify-between rounded-2xl border p-4 ${
                    option.isSystem
                      ? "border-slate-100 bg-slate-50 opacity-75"
                      : "border-slate-200 bg-white"
                  }`}
                  key={option.id}
                >
                  <div>
                    <p className="font-semibold text-sm">{option.labelEn}</p>
                    <p className="text-xs text-slate-500">
                      {option.key}
                      {option.isSystem ? ` · ${t("lookups.system")}` : ""}
                      {!option.isActive ? ` · ${t("labels.inactive")}` : ""}
                    </p>
                  </div>
                  {!option.isSystem ? (
                    <div className="flex gap-2">
                      <button
                        className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        onClick={() => setEditingOption(option)}
                        type="button"
                      >
                        {t("actions.edit")}
                      </button>
                      <button
                        className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        onClick={() => deleteMutation.mutate(option.id)}
                        type="button"
                      >
                        {t("actions.delete")}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <div className="space-y-4">
          {editingOption ? (
            <SectionCard title={t("lookups.editOption")} description={t("lookups.editOptionHelp")}>
              <LookupEditForm
                option={editingOption}
                isPending={updateMutation.isPending}
                onCancel={() => setEditingOption(null)}
                onSubmit={(payload) => updateMutation.mutate({ id: editingOption.id, payload })}
                t={t}
              />
            </SectionCard>
          ) : (
            <SectionCard title={t("lookups.addOption")} description={t("lookups.addOptionHelp")}>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void createMutation.mutateAsync(createForm);
                }}
              >
                <Field
                  dir="ltr"
                  label={t("lookups.key")}
                  onChange={(v) => setCreateForm({ ...createForm, key: v.toUpperCase().replace(/\s+/g, "_") })}
                  placeholder="MY_CUSTOM_VALUE"
                  value={createForm.key}
                />
                <Field
                  label={t("lookups.labelAr")}
                  onChange={(v) => setCreateForm({ ...createForm, labelAr: v })}
                  value={createForm.labelAr}
                />
                <Field
                  dir="ltr"
                  label={t("lookups.labelEn")}
                  onChange={(v) => setCreateForm({ ...createForm, labelEn: v })}
                  value={createForm.labelEn}
                />
                <Field
                  dir="ltr"
                  label={t("lookups.labelFr")}
                  onChange={(v) => setCreateForm({ ...createForm, labelFr: v })}
                  value={createForm.labelFr}
                />
                {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
                <PrimaryButton type="submit">
                  {createMutation.isPending ? "..." : t("lookups.addOption")}
                </PrimaryButton>
              </form>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}

function LookupEditForm({
  option,
  isPending,
  onCancel,
  onSubmit,
  t
}: {
  option: LookupOptionDto;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (payload: UpdateLookupOptionDto) => void;
  t: (key: string) => string;
}) {
  const [form, setForm] = useState<UpdateLookupOptionDto>({
    labelAr: option.labelAr,
    labelEn: option.labelEn,
    labelFr: option.labelFr,
    isActive: option.isActive,
    sortOrder: option.sortOrder
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <Field
        label={t("lookups.labelAr")}
        onChange={(v) => setForm({ ...form, labelAr: v })}
        value={form.labelAr}
      />
      <Field
        dir="ltr"
        label={t("lookups.labelEn")}
        onChange={(v) => setForm({ ...form, labelEn: v })}
        value={form.labelEn}
      />
      <Field
        dir="ltr"
        label={t("lookups.labelFr")}
        onChange={(v) => setForm({ ...form, labelFr: v })}
        value={form.labelFr}
      />
      <div className="flex gap-3">
        <PrimaryButton type="submit">{isPending ? "..." : t("actions.saveChanges")}</PrimaryButton>
        <button
          className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={onCancel}
          type="button"
        >
          {t("actions.cancel")}
        </button>
      </div>
    </form>
  );
}
