import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  useUnsavedChanges,
  useUnsavedChangesBypass
} from "../../lib/useUnsavedChanges";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CaseDto, ClientListResponseDto, CreateCaseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { toClientSelectOption } from "../../lib/caseOptions";
import { useMutationFeedback } from "../../lib/feedback";
import { useLocalizedLookupOptions } from "../../lib/lookups";
import { extractApiValidationError, pickFieldError } from "../../lib/validationErrors";
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
    judicialYear: null,
    type: "CIVIL",
    internalRef: null
  });
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: () => apiFetch<ClientListResponseDto>("/api/clients?limit=200")
  });

  const caseTypesQuery = useLocalizedLookupOptions("CaseType");
  useUnsavedChanges(
    JSON.stringify(form) !==
      JSON.stringify({
        clientId: initialClientId,
        title: "",
        caseNumber: "",
        judicialYear: null,
        type: "CIVIL",
        internalRef: null
      } satisfies CreateCaseDto),
    { bypassBlockRef: bypassRef }
  );

  const createMutation = useMutation({
    mutationFn: (payload: CreateCaseDto) =>
      apiFetch<CaseDto>("/api/cases", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async (createdCase) => {
      feedback.success("messages.caseCreated");
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
      allowNextNavigation();
      void navigate({ to: "/app/cases/$caseId", params: { caseId: createdCase.id } });
    }
  });

  const clientOptions = [
    { value: "", label: t("labels.selectClient") },
    ...(clientsQuery.data?.items ?? []).map((client) =>
      toClientSelectOption(t, client)
    )
  ];

  const caseTypeOptions = [...caseTypesQuery.options];
  if (!caseTypeOptions.length) {
    const fallbackLabel = caseTypesQuery.getLabel("CIVIL");
    caseTypeOptions.push({
      value: "CIVIL",
      label: fallbackLabel,
      searchText: `CIVIL ${fallbackLabel}`
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
            setValidationMessage(null);
            setFieldErrors({});
            if (form.judicialYear != null && form.judicialYear < 0) {
              const message = t(
                "quickIntake.validation.judicialYearNonNegative",
                "Judicial year must be zero or greater."
              );
              setFieldErrors({ judicialYear: message });
              setValidationMessage(message);
              return;
            }
            void (async () => {
              try {
                await createMutation.mutateAsync(form);
              } catch (error) {
                const validation = extractApiValidationError(error);
                if (validation) {
                  setValidationMessage(validation.message);
                  setFieldErrors(validation.fieldErrors);
                  return;
                }
                setValidationMessage((error as Error)?.message ?? t("errors.fallback"));
              }
            })();
          }}
        >
          <SelectField
            label={t("labels.client")}
            onChange={(value) => setForm({ ...form, clientId: value })}
            options={clientOptions}
            required
            value={form.clientId}
            error={pickFieldError(fieldErrors, ["clientId"]) ?? undefined}
          />
          <Field
            label={t("labels.caseTitle")}
            onChange={(value) => setForm({ ...form, title: value })}
            required
            value={form.title}
            error={pickFieldError(fieldErrors, ["title"]) ?? undefined}
          />
          <Field
            label={t("labels.caseNumber")}
            onChange={(value) => setForm({ ...form, caseNumber: value })}
            required
            value={form.caseNumber}
            error={pickFieldError(fieldErrors, ["caseNumber"]) ?? undefined}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label={t("labels.judicialYear")}
              type="number"
              value={
                form.judicialYear === null || form.judicialYear === undefined
                  ? ""
                  : String(form.judicialYear)
              }
              onChange={(value) => {
                if (value.trim() === "") {
                  setForm({ ...form, judicialYear: null });
                  return;
                }
                const parsed = Number.parseInt(value, 10);
                setForm({
                  ...form,
                  judicialYear: Number.isNaN(parsed) ? null : parsed
                });
              }}
              error={pickFieldError(fieldErrors, ["judicialYear"]) ?? undefined}
            />
            <Field
              label={t("labels.internalRef")}
              onChange={(value) => setForm({ ...form, internalRef: value || null })}
              value={form.internalRef ?? ""}
              error={pickFieldError(fieldErrors, ["internalRef"]) ?? undefined}
            />
          </div>
          <SelectField
            label={t("labels.caseType")}
            onChange={(value) => setForm({ ...form, type: value })}
            options={caseTypeOptions}
            required
            value={form.type}
            error={pickFieldError(fieldErrors, ["type"]) ?? undefined}
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
          {validationMessage ? <FormAlert message={validationMessage} /> : null}
        </form>
      </SectionCard>
    </div>
  );
}
