import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useUnsavedChanges, useUnsavedChangesBypass } from "../../lib/useUnsavedChanges";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SessionOutcome,
  type CaseListResponseDto,
  type CreateHearingDto,
  type HearingDto,
  type UserListResponseDto
} from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { isValidDateTimeInput, toIsoOrEmpty } from "../../lib/dateInput";
import { getEnumLabel } from "../../lib/enumLabel";
import { EmptyState, Field, FormExitActions, PageHeader, SectionCard, SelectField, TextAreaField, formatDateTime } from "./ui";
import { toDateTimeLocalValue } from "./hearingCalendar";

function normalizePayload(form: CreateHearingDto): CreateHearingDto {
  const sessionDatetime = toIsoOrEmpty(form.sessionDatetime);
  return {
    ...form,
    assignedLawyerId: form.assignedLawyerId || null,
    sessionDatetime,
    nextSessionAt: toIsoOrEmpty(form.nextSessionAt) || null,
    notes: form.notes || null
  };
}

export function HearingEditPage() {
  const { t } = useTranslation("app");
  const { hearingId } = useParams({ from: "/app/hearings/$hearingId/edit" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { bypassRef, allowNextNavigation } = useUnsavedChangesBypass();

  const hearingQuery = useQuery({
    queryKey: ["hearing", hearingId],
    queryFn: () => apiFetch<HearingDto>(`/api/hearings/${hearingId}`)
  });
  const casesQuery = useQuery({
    queryKey: ["cases"],
    queryFn: () => apiFetch<CaseListResponseDto>("/api/cases")
  });
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<UserListResponseDto>("/api/users")
  });

  const [form, setForm] = useState<CreateHearingDto>({
    caseId: "",
    assignedLawyerId: "",
    sessionDatetime: "",
    nextSessionAt: "",
    outcome: null,
    notes: ""
  });
  const loadedFormRef = useRef<CreateHearingDto | null>(null);
  useUnsavedChanges(loadedFormRef.current !== null && (
    form.caseId !== loadedFormRef.current.caseId ||
    (form.assignedLawyerId ?? "") !== (loadedFormRef.current.assignedLawyerId ?? "") ||
    form.sessionDatetime !== loadedFormRef.current.sessionDatetime ||
    (form.nextSessionAt ?? "") !== (loadedFormRef.current.nextSessionAt ?? "") ||
    (form.outcome ?? null) !== (loadedFormRef.current.outcome ?? null) ||
    (form.notes ?? "") !== (loadedFormRef.current.notes ?? "")
  ), {
    bypassBlockRef: bypassRef
  });

  const [debouncedConflictInput, setDebouncedConflictInput] = useState({
    assignedLawyerId: "",
    sessionDatetime: ""
  });

  useEffect(() => {
    if (hearingQuery.data) {
      const h = hearingQuery.data;
      const loaded: CreateHearingDto = {
        caseId: h.caseId,
        assignedLawyerId: h.assignedLawyerId ?? "",
        sessionDatetime: toDateTimeLocalValue(h.sessionDatetime),
        nextSessionAt: toDateTimeLocalValue(h.nextSessionAt),
        outcome: h.outcome,
        notes: h.notes ?? ""
      };
      setForm(loaded);
      loadedFormRef.current = loaded;
    }
  }, [hearingQuery.data]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedConflictInput({
        assignedLawyerId: form.assignedLawyerId ?? "",
        sessionDatetime: form.sessionDatetime
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [form.assignedLawyerId, form.sessionDatetime]);

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
      hearingId,
      debouncedConflictInput.assignedLawyerId,
      debouncedConflictInput.sessionDatetime
    ],
    queryFn: () =>
      apiFetch<{ hasConflict: boolean; conflictingHearingIds: string[] }>(
        `/api/hearings/conflicts?assignedLawyerId=${encodeURIComponent(debouncedConflictInput.assignedLawyerId)}&sessionDatetime=${encodeURIComponent(toIsoOrEmpty(debouncedConflictInput.sessionDatetime))}&excludeId=${encodeURIComponent(hearingId)}`
      ),
    enabled: Boolean(
      debouncedConflictInput.assignedLawyerId && isValidDateTimeInput(debouncedConflictInput.sessionDatetime)
    )
  });

  const updateMutation = useMutation({
    mutationFn: (payload: CreateHearingDto) =>
      apiFetch(`/api/hearings/${hearingId}`, {
        method: "PUT",
        body: JSON.stringify(normalizePayload(payload))
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["hearings"] });
      await queryClient.invalidateQueries({ queryKey: ["hearing", hearingId] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      allowNextNavigation();
      void navigate({ to: "/app/hearings" });
    }
  });

  if (hearingQuery.isLoading) {
    return <p className="p-6 text-sm text-slate-500">{t("labels.loading")}</p>;
  }

  if (hearingQuery.isError) {
    return (
      <EmptyState
        title={t("errors.title")}
        description={(hearingQuery.error as Error)?.message ?? t("errors.fallback")}
      />
    );
  }

  if (!hearingQuery.data) {
    return (
      <EmptyState
        title={t("empty.noHearings")}
        description={t("empty.noHearingsHelp")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("hearings.drawerEyebrow")}
        title={t("hearings.editTitle")}
        description={hearingQuery.data ? formatDateTime(hearingQuery.data.sessionDatetime) : "..."}
      />
      <SectionCard title={t("hearings.editTitle")} description={t("hearings.editHelp")}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isValidDateTimeInput(form.sessionDatetime)) {
              return;
            }
            updateMutation.mutate(form);
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
          {updateMutation.error ? (
            <p className="text-sm text-red-600">{(updateMutation.error as Error).message}</p>
          ) : null}
          <FormExitActions
            cancelTo="/app/hearings"
            cancelLabel={t("actions.cancel")}
            submitLabel={t("hearings.saveChanges")}
            savingLabel={t("labels.saving")}
            submitting={updateMutation.isPending}
          />
        </form>
      </SectionCard>
    </div>
  );
}
