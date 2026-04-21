import { useEffect, useState } from "react";
import { InlineHearingForm } from "./InlineHearingForm";
import { InlineTaskForm } from "./InlineTaskForm";
import { InlineEditField } from "../../components/InlineEditField";
import { useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CaseRoleOnCase,
  CaseStatus,
  type CaseCourtDto,
  type CaseDto,
  type CasePartyDto,
  type CasePartyType,
  type ClientDto,
  type ClientListResponseDto,
  type CreateCaseAssignmentDto,
  type CreateCaseCourtDto,
  type CreateCasePartyDto,
  type HearingListResponseDto,
  type TaskListResponseDto,
  type UpdateCaseCourtDto,
  type UpdateCasePartyDto,
  type UserListResponseDto
} from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { useMutationFeedback } from "../../lib/feedback";
import { useLookupOptions } from "../../lib/lookups";
import { getEnumLabel } from "../../lib/enumLabel";
import { EnumBadge } from "../../components/shared/EnumBadge";
import {
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  FormAlert,
  PageHeader,
  PrimaryButton,
  SectionCard,
  SelectField,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TableWrapper,
  formatDateTime
} from "./ui";
import { DocumentList } from "../../components/documents/DocumentList";
import { DocumentUploadForm } from "../../components/documents/DocumentUploadForm";
import { CaseBillingTab } from "../../components/billing/CaseBillingTab";
import { CaseLegalReferencesTab } from "../../components/library/CaseLegalReferencesTab";

export const caseTabs = [
  "overview",
  "courts",
  "parties",
  "assignments",
  "hearings",
  "tasks",
  "documents",
  "billing",
  "references"
] as const;
type CaseTab = (typeof caseTabs)[number];

export const EMPTY_COURT: CreateCaseCourtDto = {
  courtName: "",
  courtLevel: "",
  circuit: "",
  caseNumber: "",
  startedAt: "",
  notes: ""
};

export function pickActiveCourt(courts: CaseCourtDto[]) {
  return courts.find((court) => court.isActive) ?? courts[0] ?? null;
}

export function CaseDetailPage() {
  const { t } = useTranslation("app");
  const feedback = useMutationFeedback();
  const queryClient = useQueryClient();
  const { caseId } = useParams({ from: "/app/cases/$caseId" });
  const [activeTab, setActiveTab] = useState<CaseTab>("overview");
  const [partyForm, setPartyForm] = useState<CreateCasePartyDto>({
    name: "",
    role: "PLAINTIFF",
    partyType: "OPPONENT"
  });
  const [editingParty, setEditingParty] = useState<CasePartyDto | null>(null);
  const [editPartyForm, setEditPartyForm] = useState<UpdateCasePartyDto>({
    name: "",
    role: "",
    partyType: "OPPONENT"
  });
  const [assignmentForm, setAssignmentForm] = useState<CreateCaseAssignmentDto>(
    {
      userId: "",
      roleOnCase: CaseRoleOnCase.LEAD
    }
  );
  const [courtFormResetToken] = useState(0);
  const [showInlineHearingForm, setShowInlineHearingForm] = useState(false);
  const [showInlineTaskForm, setShowInlineTaskForm] = useState(false);

  const caseQuery = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => apiFetch<CaseDto>(`/api/cases/${caseId}`)
  });
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<UserListResponseDto>("/api/users")
  });
  const clientsQuery = useQuery({
    queryKey: ["clients", "case-parties"],
    queryFn: () => apiFetch<ClientListResponseDto>("/api/clients?limit=200")
  });
  const hearingsQuery = useQuery({
    queryKey: ["case-hearings", caseId],
    queryFn: () =>
      apiFetch<HearingListResponseDto>(`/api/hearings?caseId=${caseId}`)
  });
  const tasksQuery = useQuery({
    queryKey: ["case-tasks", caseId],
    queryFn: () => apiFetch<TaskListResponseDto>(`/api/tasks?caseId=${caseId}`)
  });
  const partyRolesQuery = useLookupOptions("PartyRole");
  const courtLevelsQuery = useLookupOptions("CourtLevel");
  const caseTypesQuery = useLookupOptions("CaseType");
  const [editingCourt, setEditingCourt] = useState<CaseCourtDto | null>(null);

  const addPartyMutation = useMutation({
    mutationFn: (payload: CreateCasePartyDto) =>
      apiFetch(`/api/cases/${caseId}/parties`, {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      setPartyForm({ name: "", role: "PLAINTIFF", partyType: "OPPONENT" });
      setEditingParty(null);
      feedback.success("messages.saved");
      await queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
    }
  });

  const updatePartyMutation = useMutation({
    mutationFn: ({ partyId, payload }: { partyId: string; payload: UpdateCasePartyDto }) =>
      apiFetch(`/api/cases/${caseId}/parties/${partyId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      setEditingParty(null);
      feedback.success("messages.saved");
      await queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
    }
  });

  const deletePartyMutation = useMutation({
    mutationFn: (partyId: string) =>
      apiFetch(`/api/cases/${caseId}/parties/${partyId}`, { method: "DELETE" }),
    onSuccess: async () => {
      feedback.success("messages.saved");
      await queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
    }
  });

  const addAssignmentMutation = useMutation({
    mutationFn: (payload: CreateCaseAssignmentDto) =>
      apiFetch(`/api/cases/${caseId}/assignments`, {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      feedback.success("messages.saved");
      setAssignmentForm({
        userId: "",
        roleOnCase: CaseRoleOnCase.LEAD
      });
      await queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
    }
  });

  const addCourtMutation = useMutation({
    mutationFn: (payload: CreateCaseCourtDto) =>
      apiFetch(`/api/cases/${caseId}/courts`, {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      feedback.success("messages.saved");
      await queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
    }
  });

  const updateCourtMutation = useMutation({
    mutationFn: ({
      courtId,
      payload
    }: {
      courtId: string;
      payload: UpdateCaseCourtDto;
    }) =>
      apiFetch(`/api/cases/${caseId}/courts/${courtId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      setEditingCourt(null);
      feedback.success("messages.saved");
      await queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
    }
  });

  const deleteCourtMutation = useMutation({
    mutationFn: (courtId: string) =>
      apiFetch(`/api/cases/${caseId}/courts/${courtId}`, { method: "DELETE" }),
    onSuccess: async () => {
      feedback.success("messages.saved");
      await queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
    }
  });

  const caseItem = caseQuery.data;

  const clientQuery = useQuery({
    queryKey: ["client", caseItem?.clientId],
    queryFn: () => apiFetch<ClientDto>(`/api/clients/${caseItem!.clientId}`),
    enabled: !!caseItem?.clientId
  });

  if (caseQuery.isLoading) {
    return <p className="p-6 text-sm text-slate-500">{t("labels.loading")}</p>;
  }

  if (caseQuery.isError) {
    return (
      <ErrorState
        title={t("errors.title")}
        description={
          (caseQuery.error as Error)?.message ?? t("errors.fallback")
        }
        retryLabel={t("errors.reload")}
        onRetry={() => void caseQuery.refetch()}
      />
    );
  }

  if (!caseItem) {
    return (
      <EmptyState
        title={t("empty.noCaseSelected")}
        description={t("empty.noCaseSelectedHelp")}
      />
    );
  }

  const activeCourt = pickActiveCourt(caseItem.courts);

  const clientDisplayName = clientQuery.data
    ? clientQuery.data.name
    : (caseItem.clientId ?? null);

  const caseTypeLabel =
    caseTypesQuery.data?.items.find((o) => o.key === caseItem.type)?.labelAr ??
    caseItem.type;

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
  const clientOptions = [
    { value: "", label: t("labels.selectClient") },
    ...(clientsQuery.data?.items ?? []).map((client) => ({
      value: client.id,
      label: client.name
    }))
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("cases.detailEyebrow")}
        title={`${caseItem.title} (${caseItem.caseNumber})`}
        description={activeCourt ? activeCourt.courtName : ""}
        actions={<EnumBadge enumName="CaseStatus" value={caseItem.status} />}
      />
      <div className="sticky top-[calc(var(--header-height)+8px)] z-10 flex gap-2 overflow-x-auto rounded-xl bg-white/90 pb-1 pt-1 backdrop-blur">
        {caseTabs.map((tab) => (
          <button
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
              activeTab === tab
                ? "bg-accent text-white"
                : "bg-slate-100 text-slate-700"
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
        <SectionCard
          title={t("cases.overview")}
          description={t("cases.overviewHelp")}
        >
          <dl className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs font-medium text-slate-500">
                {t("labels.caseTitle")}
              </dt>
              <dd className="mt-0.5">
                <InlineEditField
                  onSave={async (v) => {
                    await apiFetch(`/api/cases/${caseId}`, {
                      method: "PUT",
                      body: JSON.stringify({
                        title: v,
                        caseNumber: caseItem.caseNumber,
                        internalReference: caseItem.internalReference,
                        judicialYear: caseItem.judicialYear,
                        type: caseItem.type,
                        clientId: caseItem.clientId
                      })
                    });
                    await queryClient.invalidateQueries({
                      queryKey: ["case", caseId]
                    });
                    await queryClient.invalidateQueries({
                      queryKey: ["cases"]
                    });
                  }}
                  value={caseItem.title}
                />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">
                {t("labels.status")}
              </dt>
              <dd className="mt-0.5">
                <InlineEditField
                  onSave={async (v) => {
                    await apiFetch(`/api/cases/${caseId}/status`, {
                      method: "PATCH",
                      body: JSON.stringify({ status: v })
                    });
                    await queryClient.invalidateQueries({
                      queryKey: ["case", caseId]
                    });
                    await queryClient.invalidateQueries({
                      queryKey: ["cases"]
                    });
                  }}
                  options={Object.values(CaseStatus).map((v) => ({
                    value: v,
                    label: getEnumLabel(t, "CaseStatus", v)
                  }))}
                  type="select"
                  value={caseItem.status}
                />
              </dd>
            </div>
            <Detail label={t("labels.caseType")} value={caseTypeLabel} />
            <Detail label={t("labels.client")} value={clientDisplayName} />
            <Detail
              label={t("labels.hearings")}
              value={String(caseItem.hearingCount)}
            />
            <Detail
              label={t("labels.tasks")}
              value={String(caseItem.taskCount)}
            />
          </dl>
        </SectionCard>
      ) : null}
      {activeTab === "courts" ? (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <SectionCard
            title={t("cases.courts")}
            description={t("cases.courtsHelp")}
          >
            {!caseItem.courts.length ? (
              <EmptyState
                title={t("empty.noCourts")}
                description={t("empty.noCourtsHelp")}
              />
            ) : (
              <TableWrapper>
                <DataTable>
                  <TableHead>
                    <tr>
                      <TableHeadCell>{t("labels.courtName")}</TableHeadCell>
                      <TableHeadCell>{t("labels.courtLevel")}</TableHeadCell>
                      <TableHeadCell>{t("labels.caseNumber")}</TableHeadCell>
                      <TableHeadCell>{t("labels.status")}</TableHeadCell>
                      <TableHeadCell align="end">
                        {t("actions.more")}
                      </TableHeadCell>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {caseItem.courts.map((court) => (
                      <TableRow key={court.id}>
                        <TableCell>
                          <p className="font-medium">{court.courtName}</p>
                          <p className="text-xs text-slate-500">
                            {court.circuit ?? "—"}
                          </p>
                        </TableCell>
                        <TableCell>
                          {courtLevelMap.get(court.courtLevel) ??
                            court.courtLevel}
                        </TableCell>
                        <TableCell>{court.caseNumber ?? "—"}</TableCell>
                        <TableCell>
                          {court.isActive
                            ? t("labels.active")
                            : t("labels.inactive")}
                        </TableCell>
                        <TableCell align="end">
                          <div className="flex justify-end gap-2">
                            <button
                              className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                              onClick={() => setEditingCourt(court)}
                              type="button"
                            >
                              {t("actions.edit")}
                            </button>
                            <button
                              className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                              onClick={() =>
                                deleteCourtMutation.mutate(court.id)
                              }
                              type="button"
                            >
                              {t("actions.delete")}
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </DataTable>
              </TableWrapper>
            )}
            {deleteCourtMutation.isError ? (
              <div className="mt-3">
                <FormAlert
                  message={
                    (deleteCourtMutation.error as Error)?.message ??
                    t("errors.fallback")
                  }
                />
              </div>
            ) : null}
          </SectionCard>
          <div className="space-y-4">
            {editingCourt ? (
              <SectionCard
                title={t("cases.editCourt")}
                description={t("cases.editCourtHelp")}
              >
                <CourtEditForm
                  courtLevelOptions={courtLevelOptions}
                  court={editingCourt}
                  isPending={updateCourtMutation.isPending}
                  onCancel={() => setEditingCourt(null)}
                  onSubmit={(payload) =>
                    updateCourtMutation.mutate({
                      courtId: editingCourt.id,
                      payload
                    })
                  }
                  t={t}
                />
                {updateCourtMutation.isError ? (
                  <div className="mt-3">
                    <FormAlert
                      message={
                        (updateCourtMutation.error as Error)?.message ??
                        t("errors.fallback")
                      }
                    />
                  </div>
                ) : null}
              </SectionCard>
            ) : (
              <SectionCard
                title={t("cases.addCourt")}
                description={t("cases.addCourtHelp")}
              >
                <CourtAddForm
                  courtLevelOptions={courtLevelOptions}
                  isPending={addCourtMutation.isPending}
                  resetToken={courtFormResetToken}
                  onSubmit={(payload) => addCourtMutation.mutate(payload)}
                  t={t}
                />
                {addCourtMutation.isError ? (
                  <div className="mt-3">
                    <FormAlert
                      message={
                        (addCourtMutation.error as Error)?.message ??
                        t("errors.fallback")
                      }
                    />
                  </div>
                ) : null}
              </SectionCard>
            )}
          </div>
        </div>
      ) : null}
      {activeTab === "parties" ? (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <SectionCard
            title={t("cases.parties")}
            description={t("cases.partiesHelp")}
          >
            {!caseItem.parties.length ? (
              <EmptyState
                title={t("empty.noParties")}
                description={t("empty.noPartiesHelp")}
              />
            ) : (
              <TableWrapper>
                <DataTable>
                  <TableHead>
                    <tr>
                      <TableHeadCell>{t("labels.name")}</TableHeadCell>
                      <TableHeadCell>{t("labels.role")}</TableHeadCell>
                      <TableHeadCell>{t("labels.partyType")}</TableHeadCell>
                      <TableHeadCell align="end">{t("actions.more")}</TableHeadCell>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {caseItem.parties.map((party) => (
                      <TableRow key={party.id}>
                        <TableCell>{party.name}</TableCell>
                        <TableCell>
                          {getEnumLabel(t, "PartyRole", party.role)}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            party.partyType === "CLIENT"
                              ? "bg-green-100 text-green-800"
                              : party.partyType === "OPPONENT"
                              ? "bg-red-100 text-red-800"
                              : "bg-slate-100 text-slate-700"
                          }`}>
                            {t(`partyTypes.${party.partyType}`, party.partyType)}
                          </span>
                        </TableCell>
                        <TableCell align="end">
                          <div className="flex justify-end gap-2">
                            <button
                              className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                              onClick={() => {
                                setEditingParty(party);
                                setEditPartyForm({
                                  name: party.name,
                                  role: party.role,
                                  partyType: party.partyType,
                                  clientId: party.clientId ?? undefined
                                });
                              }}
                              type="button"
                            >
                              {t("actions.edit")}
                            </button>
                            <button
                              className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                              onClick={() => deletePartyMutation.mutate(party.id)}
                              type="button"
                            >
                              {t("actions.delete")}
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </DataTable>
              </TableWrapper>
            )}
            {deletePartyMutation.isError ? (
              <div className="mt-3">
                <FormAlert
                  message={
                    (deletePartyMutation.error as Error)?.message ??
                    t("errors.fallback")
                  }
                />
              </div>
            ) : null}
          </SectionCard>
          <div className="space-y-4">
            {editingParty ? (
              <SectionCard
                title={t("cases.editParty")}
                description={t("cases.addPartyHelp")}
              >
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    updatePartyMutation.mutate({
                      partyId: editingParty.id,
                      payload: editPartyForm
                    });
                  }}
                >
                  <SelectField
                    label={t("labels.partyType")}
                    onChange={(value) =>
                      setEditPartyForm({
                        ...editPartyForm,
                        partyType: value as CasePartyType,
                        clientId:
                          value === "CLIENT"
                            ? (editPartyForm.clientId ?? "")
                            : undefined
                      })
                    }
                    options={[
                      { value: "CLIENT", label: t("partyTypes.CLIENT") },
                      { value: "OPPONENT", label: t("partyTypes.OPPONENT") },
                      { value: "EXTERNAL", label: t("partyTypes.EXTERNAL") }
                    ]}
                    value={editPartyForm.partyType}
                  />
                  {editPartyForm.partyType === "CLIENT" ? (
                    <SelectField
                      label={t("labels.client")}
                      onChange={(value) =>
                        setEditPartyForm({
                          ...editPartyForm,
                          clientId: value,
                          name:
                            clientsQuery.data?.items.find(
                              (client) => client.id === value
                            )?.name ?? editPartyForm.name
                        })
                      }
                      options={clientOptions}
                      value={editPartyForm.clientId ?? ""}
                    />
                  ) : null}
                  <Field
                    label={t("labels.name")}
                    onChange={(value) =>
                      setEditPartyForm({ ...editPartyForm, name: value })
                    }
                    value={editPartyForm.name}
                  />
                  <SelectField
                    label={t("labels.role")}
                    onChange={(value) =>
                      setEditPartyForm({ ...editPartyForm, role: value })
                    }
                    options={
                      partyRoleOptions.length
                        ? partyRoleOptions
                        : [
                            { value: "PLAINTIFF", label: t("partyRoles.PLAINTIFF", "Plaintiff") },
                            { value: "DEFENDANT", label: t("partyRoles.DEFENDANT", "Defendant") }
                          ]
                    }
                    value={editPartyForm.role}
                  />
                  {updatePartyMutation.isError ? (
                    <FormAlert
                      message={
                        (updatePartyMutation.error as Error)?.message ??
                        t("errors.fallback")
                      }
                    />
                  ) : null}
                  <div className="flex gap-2">
                    <PrimaryButton disabled={updatePartyMutation.isPending} type="submit">
                      {updatePartyMutation.isPending ? t("labels.saving") : t("actions.save")}
                    </PrimaryButton>
                    <button
                      className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                      onClick={() => setEditingParty(null)}
                      type="button"
                    >
                      {t("actions.cancel")}
                    </button>
                  </div>
                </form>
              </SectionCard>
            ) : (
              <SectionCard
                title={t("cases.addParty")}
                description={t("cases.addPartyHelp")}
              >
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addPartyMutation.mutate(partyForm);
                  }}
                >
                  <SelectField
                    label={t("labels.partyType")}
                    onChange={(value) =>
                      setPartyForm({
                        ...partyForm,
                        partyType: value as CasePartyType,
                        clientId:
                          value === "CLIENT"
                            ? (partyForm.clientId ?? "")
                            : undefined
                      })
                    }
                    options={[
                      { value: "CLIENT", label: t("partyTypes.CLIENT") },
                      { value: "OPPONENT", label: t("partyTypes.OPPONENT") },
                      { value: "EXTERNAL", label: t("partyTypes.EXTERNAL") }
                    ]}
                    value={partyForm.partyType}
                  />
                  {partyForm.partyType === "CLIENT" ? (
                    <SelectField
                      label={t("labels.client")}
                      onChange={(value) =>
                        setPartyForm({
                          ...partyForm,
                          clientId: value,
                          name:
                            clientsQuery.data?.items.find(
                              (client) => client.id === value
                            )?.name ?? partyForm.name
                        })
                      }
                      options={clientOptions}
                      value={partyForm.clientId ?? ""}
                    />
                  ) : null}
                  <Field
                    label={t("labels.name")}
                    onChange={(value) =>
                      setPartyForm({ ...partyForm, name: value })
                    }
                    value={partyForm.name}
                  />
                  <SelectField
                    label={t("labels.role")}
                    onChange={(value) =>
                      setPartyForm({ ...partyForm, role: value })
                    }
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
                  {addPartyMutation.isError ? (
                    <FormAlert
                      message={
                        (addPartyMutation.error as Error)?.message ??
                        t("errors.fallback")
                      }
                    />
                  ) : null}
                  <PrimaryButton
                    disabled={addPartyMutation.isPending}
                    type="submit"
                  >
                    {addPartyMutation.isPending
                      ? t("labels.saving")
                      : t("actions.addParty")}
                  </PrimaryButton>
                </form>
              </SectionCard>
            )}
          </div>
        </div>
      ) : null}
      {activeTab === "assignments" ? (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <SectionCard
            title={t("cases.assignments")}
            description={t("cases.assignmentsHelp")}
          >
            {!caseItem.assignments.length ? (
              <EmptyState
                title={t("empty.noAssignments")}
                description={t("empty.noAssignmentsHelp")}
              />
            ) : (
              <TableWrapper>
                <DataTable>
                  <TableHead>
                    <tr>
                      <TableHeadCell>{t("labels.user")}</TableHeadCell>
                      <TableHeadCell>{t("labels.role")}</TableHeadCell>
                      <TableHeadCell>{t("labels.startDate")}</TableHeadCell>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {caseItem.assignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell>{assignment.userName}</TableCell>
                        <TableCell>
                          {getEnumLabel(
                            t,
                            "CaseRoleOnCase",
                            assignment.roleOnCase
                          )}
                        </TableCell>
                        <TableCell>
                          {formatDateTime(assignment.assignedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </DataTable>
              </TableWrapper>
            )}
          </SectionCard>
          <SectionCard
            title={t("cases.assignLawyer")}
            description={t("cases.assignLawyerHelp")}
          >
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                addAssignmentMutation.mutate(assignmentForm);
              }}
            >
              <SelectField
                label={t("labels.user")}
                onChange={(value) =>
                  setAssignmentForm({ ...assignmentForm, userId: value })
                }
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
                onChange={(value) =>
                  setAssignmentForm({
                    ...assignmentForm,
                    roleOnCase: value as CaseRoleOnCase
                  })
                }
                options={Object.values(CaseRoleOnCase).map((value) => ({
                  value,
                  label: getEnumLabel(t, "CaseRoleOnCase", value)
                }))}
                value={assignmentForm.roleOnCase}
              />
              <PrimaryButton type="submit">
                {t("actions.assignLawyer")}
              </PrimaryButton>
              {addAssignmentMutation.isError ? (
                <FormAlert
                  message={
                    (addAssignmentMutation.error as Error)?.message ??
                    t("errors.fallback")
                  }
                />
              ) : null}
            </form>
          </SectionCard>
        </div>
      ) : null}
      {activeTab === "hearings" ? (
        <SectionCard
          title={t("cases.relatedHearings")}
          description={t("cases.relatedHearingsHelp")}
        >
          <div className="mb-4 flex justify-end gap-3">
            <button
              className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white"
              onClick={() => setShowInlineHearingForm((v) => !v)}
              type="button"
            >
              {showInlineHearingForm
                ? t("actions.cancel")
                : t("actions.newHearing")}
            </button>
          </div>
          {showInlineHearingForm && (
            <InlineHearingForm
              caseId={caseId}
              onSuccess={() => {
                setShowInlineHearingForm(false);
                void queryClient.invalidateQueries({
                  queryKey: ["case-hearings", caseId]
                });
              }}
            />
          )}
          {!hearingsQuery.data?.items.length ? (
            <EmptyState
              title={t("empty.noHearings")}
              description={t("empty.noHearingsHelp")}
            />
          ) : (
            <TableWrapper>
              <DataTable>
                <TableHead>
                  <tr>
                    <TableHeadCell>{t("labels.sessionDatetime")}</TableHeadCell>
                    <TableHeadCell>{t("labels.assignedLawyer")}</TableHeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {hearingsQuery.data.items.map((hearing) => (
                    <TableRow key={hearing.id}>
                      <TableCell>
                        {formatDateTime(hearing.sessionDatetime)}
                      </TableCell>
                      <TableCell>
                        {hearing.assignedLawyerName ?? t("labels.unassigned")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            </TableWrapper>
          )}
        </SectionCard>
      ) : null}
      {activeTab === "tasks" ? (
        <SectionCard
          title={t("cases.relatedTasks")}
          description={t("cases.relatedTasksHelp")}
        >
          <div className="mb-4 flex justify-end gap-3">
            <button
              className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white"
              onClick={() => setShowInlineTaskForm((v) => !v)}
              type="button"
            >
              {showInlineTaskForm ? t("actions.cancel") : t("actions.newTask")}
            </button>
          </div>
          {showInlineTaskForm && (
            <InlineTaskForm
              caseId={caseId}
              onSuccess={() => {
                setShowInlineTaskForm(false);
                void queryClient.invalidateQueries({
                  queryKey: ["case-tasks", caseId]
                });
              }}
            />
          )}
          {!tasksQuery.data?.items.length ? (
            <EmptyState
              title={t("empty.noTasks")}
              description={t("empty.noTasksHelp")}
            />
          ) : (
            <TableWrapper>
              <DataTable>
                <TableHead>
                  <tr>
                    <TableHeadCell>{t("labels.taskTitle")}</TableHeadCell>
                    <TableHeadCell>{t("labels.status")}</TableHeadCell>
                    <TableHeadCell>{t("labels.assignedLawyer")}</TableHeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {tasksQuery.data.items.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>{task.title}</TableCell>
                      <TableCell>
                        {getEnumLabel(t, "TaskStatus", task.status)}
                      </TableCell>
                      <TableCell>
                        {task.assignedToName ?? t("labels.unassigned")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            </TableWrapper>
          )}
        </SectionCard>
      ) : null}
      {activeTab === "documents" ? (
        <div className="space-y-5">
          <SectionCard
            description={t("documents.uploadHelp")}
            title={t("documents.uploadTitle")}
          >
            <DocumentUploadForm
              caseId={caseId}
              invalidateKey={["case-documents", caseId]}
              onSuccess={() => undefined}
            />
          </SectionCard>
          <SectionCard
            description={t("documents.listHelp")}
            title={t("cases.tabs.documents")}
          >
            <DocumentList
              caseId={caseId}
              queryKey={["case-documents", caseId]}
            />
          </SectionCard>
        </div>
      ) : null}
      {activeTab === "billing" ? <CaseBillingTab caseId={caseId} /> : null}
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
  resetToken,
  onSubmit,
  t
}: {
  courtLevelOptions: { value: string; label: string }[];
  isPending: boolean;
  resetToken: number;
  onSubmit: (payload: CreateCaseCourtDto) => void;
  t: (key: string) => string;
}) {
  const [form, setForm] = useState<CreateCaseCourtDto>(EMPTY_COURT);
  useEffect(() => {
    if (resetToken > 0) {
      setForm(EMPTY_COURT);
    }
  }, [resetToken]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <Field
        label={t("labels.courtName")}
        onChange={(v) => setForm({ ...form, courtName: v })}
        value={form.courtName}
      />
      <SelectField
        label={t("labels.courtLevel")}
        onChange={(v) => setForm({ ...form, courtLevel: v })}
        options={
          courtLevelOptions.length
            ? courtLevelOptions
            : [{ value: "FIRST_INSTANCE", label: "First Instance" }]
        }
        value={form.courtLevel}
      />
      <Field
        label={t("labels.circuit")}
        onChange={(v) => setForm({ ...form, circuit: v })}
        value={form.circuit ?? ""}
      />
      <Field
        label={t("labels.caseNumber")}
        onChange={(v) => setForm({ ...form, caseNumber: v })}
        value={form.caseNumber ?? ""}
      />
      <Field
        label={t("labels.startDate")}
        onChange={(v) => setForm({ ...form, startedAt: v })}
        type="date"
        commitMode="blur"
        value={form.startedAt ?? ""}
      />
      <PrimaryButton disabled={isPending} type="submit">
        {isPending ? "..." : t("cases.addCourt")}
      </PrimaryButton>
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
      <Field
        label={t("labels.courtName")}
        onChange={(v) => setForm({ ...form, courtName: v })}
        value={form.courtName}
      />
      <SelectField
        label={t("labels.courtLevel")}
        onChange={(v) => setForm({ ...form, courtLevel: v })}
        options={
          courtLevelOptions.length
            ? courtLevelOptions
            : [{ value: "FIRST_INSTANCE", label: "First Instance" }]
        }
        value={form.courtLevel}
      />
      <Field
        label={t("labels.circuit")}
        onChange={(v) => setForm({ ...form, circuit: v ?? "" })}
        value={form.circuit ?? ""}
      />
      <Field
        label={t("labels.caseNumber")}
        onChange={(v) => setForm({ ...form, caseNumber: v })}
        value={form.caseNumber ?? ""}
      />
      <Field
        label={t("labels.startDate")}
        onChange={(v) => setForm({ ...form, startedAt: v })}
        type="date"
        commitMode="blur"
        value={form.startedAt ?? ""}
      />
      <Field
        label={t("labels.endDate")}
        onChange={(v) => setForm({ ...form, endedAt: v })}
        type="date"
        commitMode="blur"
        value={form.endedAt ?? ""}
      />
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
        <PrimaryButton type="submit">
          {isPending ? "..." : t("actions.saveChanges")}
        </PrimaryButton>
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
