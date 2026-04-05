import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CreateHearingDto, UserListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { slotDateTime } from "./hearingCalendar";
import { Field, SelectField } from "./ui";

interface Props {
  caseId: string;
  onSuccess: () => void;
}

export function InlineHearingForm({ caseId, onSuccess }: Props) {
  const { t } = useTranslation("app");
  const [form, setForm] = useState<CreateHearingDto>({
    caseId,
    assignedLawyerId: "",
    sessionDatetime: slotDateTime(new Date()),
    nextSessionAt: "",
    outcome: null,
    notes: ""
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<UserListResponseDto>("/api/users")
  });

  const lawyerOptions = [
    { value: "", label: t("labels.unassigned") },
    ...(usersQuery.data?.items ?? []).map((u) => ({ value: u.id, label: u.fullName }))
  ];

  const mutation = useMutation({
    mutationFn: (payload: CreateHearingDto) =>
      apiFetch("/api/hearings", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          assignedLawyerId: payload.assignedLawyerId || null,
          nextSessionAt: payload.nextSessionAt || null,
          notes: payload.notes || null,
          sessionDatetime: new Date(payload.sessionDatetime).toISOString()
        })
      }),
    onSuccess
  });

  function set<K extends keyof CreateHearingDto>(key: K, value: CreateHearingDto[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form
      className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(form);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          commitMode="blur"
          label={t("labels.sessionDatetime")}
          onChange={(v) => set("sessionDatetime", v)}
          required
          type="datetime-local"
          value={form.sessionDatetime}
        />
        <SelectField
          label={t("labels.assignedLawyer")}
          onChange={(v) => set("assignedLawyerId", v)}
          options={lawyerOptions}
          value={form.assignedLawyerId ?? ""}
        />
        <div className="sm:col-span-2">
          <Field
            commitMode="blur"
            label={t("labels.notes")}
            onChange={(v) => set("notes", v)}
            value={form.notes ?? ""}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={mutation.isPending}
          type="submit"
        >
          {mutation.isPending ? t("labels.saving") : t("actions.save")}
        </button>
        <Link
          className="text-sm text-slate-500 hover:text-accent"
          search={{ caseId }}
          to="/app/hearings/new"
        >
          {t("labels.advancedOptions", "Advanced options")} →
        </Link>
      </div>
      {mutation.isError && (
        <p className="mt-2 text-sm text-red-600">
          {(mutation.error as Error)?.message ?? t("errors.fallback")}
        </p>
      )}
    </form>
  );
}
