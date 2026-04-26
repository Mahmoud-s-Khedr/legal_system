import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  useUnsavedChanges,
  useUnsavedChangesBypass
} from "../../lib/useUnsavedChanges";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ClientListResponseDto, CreateCaseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { getEnumLabel } from "../../lib/enumLabel";
import { useMutationFeedback } from "../../lib/feedback";
import { useLookupOptions } from "../../lib/lookups";
import {
  Field,
  FormAlert,
  FormExitActions,
  PageHeader,
  SectionCard,
  SelectField
} from "./ui";

export function CaseCreatePage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const feedback = useMutationFeedback();
  const search = useSearch({ strict: false }) as { clientId?: string };
  const { bypassRef, allowNextNavigation } = useUnsavedChangesBypass();
  const initialClientId = search.clientId ?? "";

  const [form, setForm] = useState<CreateCaseDto>({
    clientId: initialClientId,
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
  useUnsavedChanges(
    JSON.stringify(form) !==
      JSON.stringify({
        clientId: initialClientId,
        title: "",
        caseNumber: "",
        internalReference: "",
        judicialYear: null,
        type: "CIVIL"
      } satisfies CreateCaseDto),
    { bypassBlockRef: bypassRef }
  );

  const createMutation = useMutation({
    mutationFn: (payload: CreateCaseDto) =>
      apiFetch("/api/cases", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      feedback.success("messages.caseCreated");
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
      allowNextNavigation();
      void navigate({ to: "/app/cases" });
    }
  });

  const poaLabel = t("labels.poaNumber");

  const clientOptions = [
    { value: "", label: t("labels.selectClient") },
    ...(clientsQuery.data?.items ?? []).map((client) => {
      const typeLabel = getEnumLabel(t, "ClientType", client.type);
      const poaValue = client.poaNumber?.trim() || "—";

      return {
        value: client.id,
        label: `${client.name} — ${typeLabel} — ${poaLabel}: ${poaValue}`,
        searchText: [
          client.name,
          client.type,
          typeLabel,
          client.poaNumber,
          client.phone,
          client.email,
          client.nationalId,
          client.commercialRegister,
          client.taxNumber,
          client.id
        ]
          .filter(Boolean)
          .join(" ")
      };
    })
  ];

  const caseTypeOptions = (caseTypesQuery.data?.items ?? []).map((o) => ({
    value: o.key,
    label: o.labelAr
  }));
  if (!caseTypeOptions.length) {
    caseTypeOptions.push({
      value: "CIVIL",
      label: t("caseTypes.CIVIL", "Civil")
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("cases.eyebrow")}
        title={t("cases.createTitle")}
        description={t("cases.createHelp")}
      />
      <SectionCard
        title={t("cases.createTitle")}
        description={t("cases.createHelp")}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (form.title.trim().length < 2) {
              return;
            }
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
            label={t("labels.caseTitle")}
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
          <p className="text-sm text-slate-500">
            {t("cases.courtNoteAfterCreate")}
          </p>
          <FormExitActions
            cancelTo="/app/cases"
            cancelLabel={t("actions.cancel")}
            submitLabel={t("actions.createCase")}
            savingLabel={t("labels.saving")}
            submitting={
              createMutation.isPending || form.title.trim().length < 2
            }
          />
          {createMutation.error ? (
            <FormAlert message={(createMutation.error as Error).message} />
          ) : null}
        </form>
      </SectionCard>
    </div>
  );
}
