import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CaseRoleOnCase, type CaseCourtDto, type CaseDto, type ClientDto, type CreateCaseAssignmentDto, type CreateCaseCourtDto, type CreateCasePartyDto, type HearingListResponseDto, type TaskListResponseDto, type UpdateCaseCourtDto, type UserListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { useLookupOptions } from "../../lib/lookups";
import { getEnumLabel } from "../../lib/enumLabel";
import { EnumBadge } from "../../components/shared/EnumBadge";
import { EmptyState, Field, PageHeader, PrimaryButton, SectionCard, SelectField, formatDateTime } from "./ui";
import { DocumentList } from "../../components/documents/DocumentList";
import { DocumentUploadForm } from "../../components/documents/DocumentUploadForm";
import { CaseBillingTab } from "../../components/billing/CaseBillingTab";
import { CaseLegalReferencesTab } from "../../components/library/CaseLegalReferencesTab";

const caseTabs = ["overview", "courts", "parties", "assignments", "hearings", "tasks", "documents", "billing", "references"] as const;
type CaseTab = (typeof caseTabs)[number];

const EMPTY_COURT: CreateCaseCourtDto = {
  courtName: "",
  courtLevel: "",
  circuit: "",
  caseNumber: "",
  startedAt: "",
  notes: ""
};

export function CaseDetailPage() {
  const { t } = useTranslation("app");
  const queryClient = useQueryClient();
  const { caseId } = useParams({ from: "/app/cases/$caseId" });
  const [activeTab, setActiveTab] = useState<CaseTab>("overview");
  const [partyForm, setPartyForm] = useState<CreateCasePartyDto>({
    name: "",
    role: "PLAINTIFF",
    isOurClient: true,
    opposingCounselName: ""
  });
  const [assignmentForm, setAssignmentForm] = useState<CreateCaseAssignmentDto>({
    userId: "",
    roleOnCase: CaseRoleOnCase.LEAD
  });

  const caseQuery = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => apiFetch<CaseDto>(`/api/cases/${caseId}`)
  });
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<UserListResponseDto>("/api/users")
  });
  const hearingsQuery = useQuery({
    queryKey: ["case-hearings", caseId],
    queryFn: () => apiFetch<HearingListResponseDto>(`/api/hearings?caseId=${caseId}`)
  });
  const tasksQuery = useQuery({
    queryKey: ["case-tasks", caseId],
    queryFn: () => apiFetch<TaskListResponseDto>(`/api/tasks?caseId=${caseId}`)
  });
  const partyRolesQuery = useLookupOptions("PartyRole");
  const courtLevelsQuery = useLookupOptions("CourtLevel");
  const caseTypesQuery = useLookupOptions("CaseType");
  const [, setCourtForm] = useState<CreateCaseCourtDto>(EMPTY_COURT);
  const [editingCourt, setEditingCourt] = useState<CaseCourtDto | null>(null);

  const addPartyMutation = useMutation({
    mutationFn: (payload: CreateCasePartyDto) =>
      apiFetch(`/api/cases/${caseId}/parties`, {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      setPartyForm({
        name: "",
        role: "PLAINTIFF",
        isOurClient: true,
        opposingCounselName: ""
      });
      await queryClient.invalidateQueries({ queryKey: ["case", caseId] });
    }
  });

  const addAssignmentMutation = useMutation({
    mutationFn: (payload: CreateCaseAssignmentDto) =>
      apiFetch(`/api/cases/${caseId}/assignments`, {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["case", caseId] });
    }
  });

  const addCourtMutation = useMutation({
    mutationFn: (payload: CreateCaseCourtDto) =>
      apiFetch(`/api/cases/${caseId}/courts`, {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      setCourtForm(EMPTY_COURT);
      await queryClient.invalidateQueries({ queryKey: ["case", caseId] });
    }
  });

  const updateCourtMutation = useMutation({
    mutationFn: ({ courtId, payload }: { courtId: string; payload: UpdateCaseCourtDto }) =>
      apiFetch(`/api/cases/${caseId}/courts/${courtId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      setEditingCourt(null);
      await queryClient.invalidateQueries({ queryKey: ["case", caseId] });
    }
  });

  const deleteCourtMutation = useMutation({
    mutationFn: (courtId: string) =>
      apiFetch(`/api/cases/${caseId}/courts/${courtId}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["case", caseId] });
    }
  });

  const caseItem = caseQuery.data;

  const clientQuery = useQuery({
    queryKey: ["client", caseItem?.clientId],
    queryFn: () => apiFetch<ClientDto>(`/api/clients/${caseItem!.clientId}`),
    enabled: !!caseItem?.clientId
  });

  if (!caseItem) {
    return <EmptyState title={t("empty.noCaseSelected")} description={t("empty.noCaseSelectedHelp")} />;
  }

  const activeCourt = caseItem.courts.find((c) => c.isActive) ?? caseItem.courts[0];

  const clientDisplayName = clientQuery.data
    ? clientQuery.data.name
    : (caseItem.clientId ?? null);

  const caseTypeLabel =
    caseTypesQuery.data?.items.find((o) => o.key === caseItem.type)?.labelAr ?? caseItem.type;

  const courtLevelMap = new Map(
    (courtLevelsQuery.data?.items ?? []).map((o) => [o.key, o.labelAr])
  );

  const courtLevelOptions = (courtLevelsQuery.data?.items ?? []).map((o) => ({
    value: o.key,
    label: o.labelAr
  }));

  const partyRoleOptions = (partyRolesQuery.data?.items ?? []).map((o) => ({
    value: o.key,
    label: o.labelAr
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("cases.detailEyebrow")}
        title={caseItem.title}
        description={`${caseItem.caseNumber}${activeCourt ? ` · ${activeCourt.courtName}` : ""}`}
        actions={<EnumBadge enumName="CaseStatus" value={caseItem.status} />}
      />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {caseTabs.map((tab) => (
          <button
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
              activeTab === tab ? "bg-accent text-white" : "bg-slate-100 text-slate-700"
            }`}
            key={tab}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {t(`cases.tabs.${tab}`)}
          </button>
        ))}
      </div>
      {activeTab === "overview" ? (
        <SectionCard title={t("cases.overview")} description={t("cases.overviewHelp")}>
          <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Detail label={t("labels.caseType")} value={caseTypeLabel} />
            <Detail label={t("labels.client")} value={clientDisplayName} />
            <Detail label={t("labels.hearings")} value={String(caseItem.hearingCount)} />
            <Detail label={t("labels.tasks")} value={String(caseItem.taskCount)} />
          </dl>
        </SectionCard>
      ) : null}
      {activeTab === "courts" ? (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <SectionCard title={t("cases.courts")} description={t("cases.courtsHelp")}>
            {!caseItem.courts.length ? (
              <EmptyState title={t("empty.noCourts")} description={t("empty.noCourtsHelp")} />
            ) : (
              <div className="space-y-3">
                {caseItem.courts.map((court, index) => (
                  <article className="rounded-2xl border border-slate-200 bg-white p-4" key={court.id}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">
                        {index + 1}. {court.courtName}
                      </p>
                      <div className="flex items-center gap-2">
                        {court.isActive ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            {t("labels.active")}
                          </span>
                        ) : null}
                        <button
                          className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          onClick={() => setEditingCourt(court)}
                          type="button"
                        >
                          {t("actions.edit")}
                        </button>
                        <button
                          className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          onClick={() => deleteCourtMutation.mutate(court.id)}
                          type="button"
                        >
                          {t("actions.delete")}
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {courtLevelMap.get(court.courtLevel) ?? court.courtLevel}{court.circuit ? ` · ${court.circuit}` : ""}{court.caseNumber ? ` · ${court.caseNumber}` : ""}
                    </p>
                    {court.startedAt ? (
                      <p className="mt-1 text-xs text-slate-400">{formatDateTime(court.startedAt)}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
          <div className="space-y-4">
            {editingCourt ? (
              <SectionCard title={t("cases.editCourt")} description={t("cases.editCourtHelp")}>
                <CourtEditForm
                  courtLevelOptions={courtLevelOptions}
                  court={editingCourt}
                  isPending={updateCourtMutation.isPending}
                  onCancel={() => setEditingCourt(null)}
                  onSubmit={(payload) => updateCourtMutation.mutate({ courtId: editingCourt.id, payload })}
                  t={t}
                />
              </SectionCard>
            ) : (
              <SectionCard title={t("cases.addCourt")} description={t("cases.addCourtHelp")}>
                <CourtAddForm
                  courtLevelOptions={courtLevelOptions}
                  isPending={addCourtMutation.isPending}
                  onSubmit={(payload) => addCourtMutation.mutate(payload)}
                  t={t}
                />
              </SectionCard>
            )}
          </div>
        </div>
      ) : null}
      {activeTab === "parties" ? (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <SectionCard title={t("cases.parties")} description={t("cases.partiesHelp")}>
            {!caseItem.parties.length ? (
              <EmptyState title={t("empty.noParties")} description={t("empty.noPartiesHelp")} />
            ) : (
              <div className="space-y-3">
                {caseItem.parties.map((party) => (
                  <article className="rounded-2xl border border-slate-200 bg-white p-4" key={party.id}>
                    <p className="font-semibold">{party.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {getEnumLabel(t, "PartyRole", party.role)} · {party.isOurClient ? t("cases.ourClient") : t("cases.externalParty")}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard title={t("cases.addParty")} description={t("cases.addPartyHelp")}>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                addPartyMutation.mutate(partyForm);
              }}
            >
              <Field
                label={t("labels.name")}
                onChange={(value) => setPartyForm({ ...partyForm, name: value })}
                value={partyForm.name}
              />
              <SelectField
                label={t("labels.role")}
                onChange={(value) => setPartyForm({ ...partyForm, role: value })}
                options={
                  partyRoleOptions.length
                    ? partyRoleOptions
                    : [
                        { value: "PLAINTIFF", label: t("partyRoles.PLAINTIFF", "Plaintiff") },
                        { value: "DEFENDANT", label: t("partyRoles.DEFENDANT", "Defendant") }
                      ]
                }
                value={partyForm.role}
              />
              <Field
                label={t("labels.opposingCounsel")}
                onChange={(value) => setPartyForm({ ...partyForm, opposingCounselName: value })}
                value={partyForm.opposingCounselName ?? ""}
              />
              <PrimaryButton type="submit">{t("actions.addParty")}</PrimaryButton>
            </form>
          </SectionCard>
        </div>
      ) : null}
      {activeTab === "assignments" ? (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <SectionCard title={t("cases.assignments")} description={t("cases.assignmentsHelp")}>
            {!caseItem.assignments.length ? (
              <EmptyState title={t("empty.noAssignments")} description={t("empty.noAssignmentsHelp")} />
            ) : (
              <div className="space-y-3">
                {caseItem.assignments.map((assignment) => (
                  <article className="rounded-2xl border border-slate-200 bg-white p-4" key={assignment.id}>
                    <p className="font-semibold">{assignment.userName}</p>
                    <p className="mt-1 text-sm text-slate-600">{getEnumLabel(t, "CaseRoleOnCase", assignment.roleOnCase)}</p>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard title={t("cases.assignLawyer")} description={t("cases.assignLawyerHelp")}>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                addAssignmentMutation.mutate(assignmentForm);
              }}
            >
              <SelectField
                label={t("labels.user")}
                onChange={(value) => setAssignmentForm({ ...assignmentForm, userId: value })}
                options={[
                  { value: "", label: t("labels.selectUser") },
                  ...(usersQuery.data?.items ?? []).map((user) => ({
                    value: user.id,
                    label: user.fullName
                  }))
                ]}
                value={assignmentForm.userId}
              />
              <SelectField
                label={t("labels.role")}
                onChange={(value) => setAssignmentForm({ ...assignmentForm, roleOnCase: value as CaseRoleOnCase })}
                options={Object.values(CaseRoleOnCase).map((value) => ({ value, label: getEnumLabel(t, "CaseRoleOnCase", value) }))}
                value={assignmentForm.roleOnCase}
              />
              <PrimaryButton type="submit">{t("actions.assignLawyer")}</PrimaryButton>
            </form>
          </SectionCard>
        </div>
      ) : null}
      {activeTab === "hearings" ? (
        <SectionCard title={t("cases.relatedHearings")} description={t("cases.relatedHearingsHelp")}>
          <div className="mb-4 flex justify-end">
            <Link
              className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white"
              to="/app/hearings/new"
              search={{ caseId }}
            >
              {t("actions.newHearing")}
            </Link>
          </div>
          {!hearingsQuery.data?.items.length ? (
            <EmptyState title={t("empty.noHearings")} description={t("empty.noHearingsHelp")} />
          ) : (
            <div className="space-y-3">
              {hearingsQuery.data.items.map((hearing) => (
                <article className="rounded-2xl border border-slate-200 bg-white p-4" key={hearing.id}>
                  <p className="font-semibold">{formatDateTime(hearing.sessionDatetime)}</p>
                  <p className="mt-1 text-sm text-slate-600">{hearing.assignedLawyerName ?? t("labels.unassigned")}</p>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}
      {activeTab === "tasks" ? (
        <SectionCard title={t("cases.relatedTasks")} description={t("cases.relatedTasksHelp")}>
          <div className="mb-4 flex justify-end">
            <Link
              className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white"
              to="/app/tasks/new"
              search={{ caseId }}
            >
              {t("actions.newTask")}
            </Link>
          </div>
          {!tasksQuery.data?.items.length ? (
            <EmptyState title={t("empty.noTasks")} description={t("empty.noTasksHelp")} />
          ) : (
            <div className="space-y-3">
              {tasksQuery.data.items.map((task) => (
                <article className="rounded-2xl border border-slate-200 bg-white p-4" key={task.id}>
                  <p className="font-semibold">{task.title}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {getEnumLabel(t, "TaskStatus", task.status)} · {task.assignedToName ?? t("labels.unassigned")}
                  </p>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}
      {activeTab === "documents" ? (
        <div className="space-y-5">
          <SectionCard description={t("documents.uploadHelp")} title={t("documents.uploadTitle")}>
            <DocumentUploadForm
              caseId={caseId}
              invalidateKey={["case-documents", caseId]}
              onSuccess={() => undefined}
            />
          </SectionCard>
          <SectionCard description={t("documents.listHelp")} title={t("cases.tabs.documents")}>
            <DocumentList caseId={caseId} queryKey={["case-documents", caseId]} />
          </SectionCard>
        </div>
      ) : null}
      {activeTab === "billing" ? (
        <CaseBillingTab caseId={caseId} />
      ) : null}
      {activeTab === "references" ? (
        <CaseLegalReferencesTab caseId={caseId} />
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-2 font-semibold">{value ?? "—"}</dd>
    </div>
  );
}

function CourtAddForm({
  courtLevelOptions,
  isPending,
  onSubmit,
  t
}: {
  courtLevelOptions: { value: string; label: string }[];
  isPending: boolean;
  onSubmit: (payload: CreateCaseCourtDto) => void;
  t: (key: string) => string;
}) {
  const [form, setForm] = useState<CreateCaseCourtDto>(EMPTY_COURT);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
        setForm(EMPTY_COURT);
      }}
    >
      <Field label={t("labels.courtName")} onChange={(v) => setForm({ ...form, courtName: v })} value={form.courtName} />
      <SelectField
        label={t("labels.courtLevel")}
        onChange={(v) => setForm({ ...form, courtLevel: v })}
        options={courtLevelOptions.length ? courtLevelOptions : [{ value: "FIRST_INSTANCE", label: "First Instance" }]}
        value={form.courtLevel}
      />
      <Field label={t("labels.circuit")} onChange={(v) => setForm({ ...form, circuit: v })} value={form.circuit ?? ""} />
      <Field label={t("labels.caseNumber")} onChange={(v) => setForm({ ...form, caseNumber: v })} value={form.caseNumber ?? ""} />
      <Field label={t("labels.startDate")} onChange={(v) => setForm({ ...form, startedAt: v })} type="date" commitMode="blur" value={form.startedAt ?? ""} />
      <PrimaryButton type="submit">{isPending ? "..." : t("cases.addCourt")}</PrimaryButton>
    </form>
  );
}

function CourtEditForm({
  court,
  courtLevelOptions,
  isPending,
  onCancel,
  onSubmit,
  t
}: {
  court: CaseCourtDto;
  courtLevelOptions: { value: string; label: string }[];
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (payload: UpdateCaseCourtDto) => void;
  t: (key: string) => string;
}) {
  const [form, setForm] = useState<UpdateCaseCourtDto>({
    courtName: court.courtName,
    courtLevel: court.courtLevel,
    circuit: court.circuit ?? "",
    caseNumber: court.caseNumber ?? "",
    startedAt: court.startedAt ?? "",
    endedAt: court.endedAt ?? "",
    isActive: court.isActive,
    notes: court.notes ?? ""
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          ...form,
          circuit: form.circuit || null,
          caseNumber: form.caseNumber || null,
          startedAt: form.startedAt || null,
          endedAt: form.endedAt || null,
          notes: form.notes || null
        });
      }}
    >
      <Field label={t("labels.courtName")} onChange={(v) => setForm({ ...form, courtName: v })} value={form.courtName} />
      <SelectField
        label={t("labels.courtLevel")}
        onChange={(v) => setForm({ ...form, courtLevel: v })}
        options={courtLevelOptions.length ? courtLevelOptions : [{ value: "FIRST_INSTANCE", label: "First Instance" }]}
        value={form.courtLevel}
      />
      <Field label={t("labels.circuit")} onChange={(v) => setForm({ ...form, circuit: v ?? "" })} value={form.circuit ?? ""} />
      <Field label={t("labels.caseNumber")} onChange={(v) => setForm({ ...form, caseNumber: v })} value={form.caseNumber ?? ""} />
      <Field label={t("labels.startDate")} onChange={(v) => setForm({ ...form, startedAt: v })} type="date" commitMode="blur" value={form.startedAt ?? ""} />
      <Field label={t("labels.endDate")} onChange={(v) => setForm({ ...form, endedAt: v })} type="date" commitMode="blur" value={form.endedAt ?? ""} />
      <SelectField
        label={t("labels.status")}
        onChange={(v) => setForm({ ...form, isActive: v === "true" })}
        options={[
          { value: "true", label: t("labels.active") },
          { value: "false", label: t("labels.inactive") }
        ]}
        value={String(form.isActive)}
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
