import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useUnsavedChanges, useUnsavedChangesBypass } from "../../lib/useUnsavedChanges";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SessionOutcome,
  type CaseListResponseDto,
  type CreateHearingDto,
  type UserListResponseDto
} from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { isValidDateTimeInput, toIsoOrEmpty } from "../../lib/dateInput";
import { getEnumLabel } from "../../lib/enumLabel";
import { Field, FormExitActions, PageHeader, SectionCard, SelectField, TextAreaField } from "./ui";
import { slotDateTime } from "./hearingCalendar";

function normalizePayload(form: CreateHearingDto): CreateHearingDto {
  return {
    ...form,
    assignedLawyerId: form.assignedLawyerId || null,
    sessionDatetime: new Date(form.sessionDatetime).toISOString(),
    nextSessionAt: toIsoOrEmpty(form.nextSessionAt) || null,
    notes: form.notes || null
  };
}

export function HearingCreatePage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { caseId?: string };
  const queryClient = useQueryClient();
  const { bypassRef, allowNextNavigation } = useUnsavedChangesBypass();

  const [form, setForm] = useState<CreateHearingDto>({
    caseId: search.caseId ?? "",
    assignedLawyerId: "",
    sessionDatetime: slotDateTime(new Date()),
    nextSessionAt: "",
    outcome: null,
    notes: ""
  });
  useUnsavedChanges(!!form.notes || form.outcome !== null, { bypassBlockRef: bypassRef });

  const [debouncedConflictInput, setDebouncedConflictInput] = useState({
    assignedLawyerId: "",
    sessionDatetime: ""
  });

  useEffect(() => {
    if (search.caseId) {
      setForm((current) => ({ ...current, caseId: search.caseId ?? "" }));
    }
  }, [search.caseId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedConflictInput({
        assignedLawyerId: form.assignedLawyerId ?? "",
        sessionDatetime: form.sessionDatetime
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [form.assignedLawyerId, form.sessionDatetime]);

  const casesQuery = useQuery({
    queryKey: ["cases"],
    queryFn: () => apiFetch<CaseListResponseDto>("/api/cases")
  });
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<UserListResponseDto>("/api/users")
  });

  const caseOptions = useMemo(
    () => [
      { value: "", label: t("labels.selectCase") },
      ...(casesQuery.data?.items ?? []).map((caseItem) => ({
        value: caseItem.id,
        label: caseItem.title
      }))
    ],
    [casesQuery.data?.items, t]
  );

  const assigneeOptions = useMemo(
    () => [
      { value: "", label: t("labels.unassigned") },
      ...(usersQuery.data?.items ?? []).map((user) => ({
        value: user.id,
        label: user.fullName
      }))
    ],
    [t, usersQuery.data?.items]
  );

  const outcomeOptions = useMemo(
    () => [
      { value: "", label: t("labels.none") },
      ...Object.values(SessionOutcome).map((value) => ({
        value,
        label: getEnumLabel(t, "SessionOutcome", value)
      }))
    ],
    [t]
  );

  const updateField = useCallback(
    <K extends keyof CreateHearingDto>(key: K, value: CreateHearingDto[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
    },
    []
  );

  const conflictQuery = useQuery({
    queryKey: [
      "hearing-conflicts",
      "new",
      debouncedConflictInput.assignedLawyerId,
      debouncedConflictInput.sessionDatetime
    ],
    queryFn: () =>
      apiFetch<{ hasConflict: boolean; conflictingHearingIds: string[] }>(
        `/api/hearings/conflicts?assignedLawyerId=${encodeURIComponent(debouncedConflictInput.assignedLawyerId)}&sessionDatetime=${encodeURIComponent(toIsoOrEmpty(debouncedConflictInput.sessionDatetime))}`
      ),
    enabled: Boolean(
      debouncedConflictInput.assignedLawyerId && isValidDateTimeInput(debouncedConflictInput.sessionDatetime)
    )
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateHearingDto) =>
      apiFetch("/api/hearings", {
        method: "POST",
        body: JSON.stringify(normalizePayload(payload))
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["hearings"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      allowNextNavigation();
      void navigate({ to: "/app/hearings" });
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("hearings.drawerEyebrow")}
        title={t("hearings.createTitle")}
        description={t("hearings.createHelp")}
      />
      <SectionCard title={t("hearings.createTitle")} description={t("hearings.createHelp")}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate(form);
          }}
        >
          <SelectField
            label={t("labels.case")}
            onChange={(value) => updateField("caseId", value)}
            options={caseOptions}
            required
            value={form.caseId}
          />
          <SelectField
            label={t("labels.assignedLawyer")}
            onChange={(value) => updateField("assignedLawyerId", value)}
            options={assigneeOptions}
            value={form.assignedLawyerId ?? ""}
          />
          <Field
            dir="ltr"
            label={t("labels.sessionDatetime")}
            onChange={(value) => updateField("sessionDatetime", value)}
            required
            type="datetime-local"
            commitMode="blur"
            value={form.sessionDatetime}
          />
          <Field
            dir="ltr"
            label={t("labels.nextSession")}
            onChange={(value) => updateField("nextSessionAt", value)}
            type="datetime-local"
            commitMode="blur"
            value={form.nextSessionAt ?? ""}
          />
          <SelectField
            label={t("labels.outcome")}
            onChange={(value) => updateField("outcome", value ? (value as SessionOutcome) : null)}
            options={outcomeOptions}
            value={form.outcome ?? ""}
          />
          <TextAreaField
            label={t("labels.notes")}
            onChange={(value) => updateField("notes", value)}
            value={form.notes ?? ""}
          />
          {conflictQuery.data?.hasConflict ? (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {t("hearings.conflictWarning")}
            </p>
          ) : null}
          {createMutation.error ? (
            <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
          ) : null}
          <FormExitActions
            cancelTo="/app/hearings"
            cancelLabel={t("actions.cancel")}
            submitLabel={t("actions.scheduleHearing")}
            savingLabel={t("labels.saving")}
            submitting={createMutation.isPending}
          />
        </form>
      </SectionCard>
    </div>
  );
}
