import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ClientListResponseDto, CreateCaseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { useLookupOptions } from "../../lib/lookups";
import { Field, PageHeader, PrimaryButton, SectionCard, SelectField } from "./ui";

export function CaseCreatePage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<CreateCaseDto>({
    clientId: "",
    title: "",
    caseNumber: "",
    internalReference: "",
    judicialYear: null,
    type: "CIVIL"
  });

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: () => apiFetch<ClientListResponseDto>("/api/clients?limit=200")
  });

  const caseTypesQuery = useLookupOptions("CaseType");

  const createMutation = useMutation({
    mutationFn: (payload: CreateCaseDto) =>
      apiFetch("/api/cases", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
      void navigate({ to: "/app/cases" });
    }
  });

  const clientOptions = [
    { value: "", label: t("labels.selectClient") },
    ...(clientsQuery.data?.items ?? []).map((c) => ({
      value: c.id,
      label: c.name
    }))
  ];

  const caseTypeOptions = (caseTypesQuery.data?.items ?? []).map((o) => ({
    value: o.key,
    label: o.labelAr
  }));
  if (!caseTypeOptions.length) {
    caseTypeOptions.push({ value: "CIVIL", label: t("caseTypes.CIVIL", "Civil") });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("cases.eyebrow")}
        title={t("cases.createTitle")}
        description={t("cases.createHelp")}
      />
      <SectionCard title={t("cases.createTitle")} description={t("cases.createHelp")}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate(form);
          }}
        >
          <SelectField
            label={t("labels.client")}
            onChange={(value) => setForm({ ...form, clientId: value })}
            options={clientOptions}
            required
            value={form.clientId}
          />
          <Field
            label={t("labels.title")}
            onChange={(value) => setForm({ ...form, title: value })}
            required
            value={form.title}
          />
          <Field
            label={t("labels.caseNumber")}
            onChange={(value) => setForm({ ...form, caseNumber: value })}
            required
            value={form.caseNumber}
          />
          <Field
            label={t("labels.internalReference")}
            onChange={(value) => setForm({ ...form, internalReference: value })}
            value={form.internalReference ?? ""}
          />
          <SelectField
            label={t("labels.caseType")}
            onChange={(value) => setForm({ ...form, type: value })}
            options={caseTypeOptions}
            required
            value={form.type}
          />
          <p className="text-sm text-slate-500">{t("cases.courtNoteAfterCreate")}</p>
          <PrimaryButton type="submit">{t("actions.createCase")}</PrimaryButton>
          {createMutation.error ? (
            <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
          ) : null}
        </form>
      </SectionCard>
    </div>
  );
}
