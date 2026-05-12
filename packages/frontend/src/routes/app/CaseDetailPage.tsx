import { useEffect, useState } from "react";
import { InlineHearingForm } from "./InlineHearingForm";
import { InlineTaskForm } from "./InlineTaskForm";
import { InlineEditField } from "../../components/InlineEditField";
import { useParams, useNavigate } from "@tanstack/react-router";
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
import { toClientSelectOption } from "../../lib/caseOptions";
import { useMutationFeedback } from "../../lib/feedback";
import { resolveFormValidationError } from "../../lib/formValidation";
import { useLocalizedLookupOptions } from "../../lib/lookups";
import {
  toLocalizedLocationOptions,
  useCityLookups,
  useGovernorateLookups,
  withLegacyLocationOption
} from "../../lib/locationLookups";
import { getEnumLabel } from "../../lib/enumLabel";
import { pickFieldError } from "../../lib/validationErrors";
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
  TablePagination,
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
  courtType: "",
  governorateValue: "",
  cityValue: "",
  circuit: "",
  startedAt: "",
  notes: ""
};

export function pickActiveCourt(courts: CaseCourtDto[]) {
  return courts.find((court) => court.isActive) ?? courts[0] ?? null;
}

export function buildCaseHearingsUrl(caseId: string, page: number, limit: number) {
  return `/api/hearings?caseId=${encodeURIComponent(caseId)}&page=${page}&limit=${limit}`;
}

export function validatePartyForm(
  form: Pick<CreateCasePartyDto, "name" | "partyType" | "clientId">,
  t: (key: string) => string
) {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) {
    errors.name = t("errors.validation.issue.required");
  }
  if (form.partyType === "CLIENT" && !form.clientId?.trim()) {
    errors.clientId = t("errors.validation.issue.required");
  }
  return errors;
}

export function validateAssignmentForm(
  form: Pick<CreateCaseAssignmentDto, "userId">,
  t: (key: string) => string
) {
  const errors: Record<string, string> = {};
  if (!form.userId.trim()) {
    errors.userId = t("errors.validation.issue.required");
  }
  return errors;
}

export function CaseDetailPage() {
  const { t } = useTranslation("app");
  const feedback = useMutationFeedback();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { caseId } = useParams({ from: "/app/cases/$caseId" });
  const [activeTab, setActiveTab] = useState<CaseTab>("overview");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [partyForm, setPartyForm] = useState<CreateCasePartyDto>({
    name: "",
    role: "",
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
  const [partyFormError, setPartyFormError] = useState<string | null>(null);
  const [partyFieldErrors, setPartyFieldErrors] = useState<Record<string, string>>(
    {}
  );
  const [editPartyFormError, setEditPartyFormError] = useState<string | null>(null);
  const [editPartyFieldErrors, setEditPartyFieldErrors] = useState<
    Record<string, string>
  >({});
  const [assignmentFormError, setAssignmentFormError] = useState<string | null>(null);
  const [assignmentFieldErrors, setAssignmentFieldErrors] = useState<
    Record<string, string>
  >({});
  const [courtFormResetToken] = useState(0);
  const [showInlineHearingForm, setShowInlineHearingForm] = useState(false);
  const [showInlineTaskForm, setShowInlineTaskForm] = useState(false);
  const [hearingsPage, setHearingsPage] = useState(1);
  const [hearingsLimit, setHearingsLimit] = useState(20);

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
    queryKey: ["case-hearings", caseId, hearingsPage, hearingsLimit],
    queryFn: () =>
      apiFetch<HearingListResponseDto>(
        buildCaseHearingsUrl(caseId, hearingsPage, hearingsLimit)
      )
  });
  const tasksQuery = useQuery({
    queryKey: ["case-tasks", caseId],
    queryFn: () => apiFetch<TaskListResponseDto>(`/api/tasks?caseId=${caseId}`)
  });
  const partyRolesQuery = useLocalizedLookupOptions("PartyRole");
  const courtLevelsQuery = useLocalizedLookupOptions("CourtLevel");
  const courtTypesQuery = useLocalizedLookupOptions("CourtType");
  const caseTypesQuery = useLocalizedLookupOptions("CaseType");
  const [editingCourt, setEditingCourt] = useState<CaseCourtDto | null>(null);
  const defaultPartyRole = partyRolesQuery.data?.items?.[0]?.key ?? "";

  useEffect(() => {
    setHearingsPage(1);
  }, [caseId]);

  useEffect(() => {
    if (!partyForm.role && defaultPartyRole) {
      setPartyForm((prev) => ({ ...prev, role: defaultPartyRole }));
    }
  }, [defaultPartyRole, partyForm.role]);

  const addPartyMutation = useMutation({
    mutationFn: (payload: CreateCasePartyDto) =>
      apiFetch(`/api/cases/${caseId}/parties`, {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      setPartyForm({ name: "", role: defaultPartyRole, partyType: "OPPONENT" });
      setPartyFormError(null);
      setPartyFieldErrors({});
      setEditingParty(null);
      feedback.success("messages.saved");
      await queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: (error) => {
      const resolved = resolveFormValidationError(error, t("errors.fallback"));
      setPartyFormError(resolved.message);
      setPartyFieldErrors(resolved.fieldErrors);
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
      setEditPartyFormError(null);
      setEditPartyFieldErrors({});
      feedback.success("messages.saved");
      await queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: (error) => {
      const resolved = resolveFormValidationError(error, t("errors.fallback"));
      setEditPartyFormError(resolved.message);
      setEditPartyFieldErrors(resolved.fieldErrors);
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
      setAssignmentFormError(null);
      setAssignmentFieldErrors({});
      setAssignmentForm({
        userId: "",
        roleOnCase: CaseRoleOnCase.LEAD
      });
      await queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: (error) => {
      const resolved = resolveFormValidationError(error, t("errors.fallback"));
      setAssignmentFormError(resolved.message);
      setAssignmentFieldErrors(resolved.fieldErrors);
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

  const deleteCaseMutation = useMutation({
    mutationFn: () => apiFetch(`/api/cases/${caseId}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cases"] });
      void navigate({ to: "/app/cases" });
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

  const caseTypeLabel = caseTypesQuery.getLabel(caseItem.type);

  const courtLevelMap = new Map(
    (courtLevelsQuery.data?.items ?? []).map((o) => [
      o.key,
      courtLevelsQuery.getLabel(o.key)
    ])
  );
  const courtTypeMap = new Map(
    (courtTypesQuery.data?.items ?? []).map((o) => [
      o.key,
      courtTypesQuery.getLabel(o.key)
    ])
  );

  const courtLevelOptions = courtLevelsQuery.options;
  const courtTypeOptions = courtTypesQuery.options;

  const partyRoleOptions = partyRolesQuery.options;
  const clientOptions = [
    { value: "", label: t("labels.selectClient") },
    ...(clientsQuery.data?.items ?? []).map((client) =>
      toClientSelectOption(t, client)
    )
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("cases.detailEyebrow")}
        title={`${caseItem.title} (${caseItem.caseNumber})`}
        description={activeCourt ? activeCourt.courtName : ""}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <EnumBadge enumName="CaseStatus" value={caseItem.status} />
            <button
              className="rounded-2xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
              onClick={() => setShowDeleteConfirm(true)}
              type="button"
            >
              {t("actions.delete")}
            </button>
          </div>
        }
      />
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <p className="font-semibold">{t("actions.confirmDelete")}</p>
            <p className="mt-2 text-sm text-slate-500">{t("actions.deleteConfirmMessage")}</p>
            <div className="mt-5 flex gap-3">
              <button
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                disabled={deleteCaseMutation.isPending}
                onClick={() => deleteCaseMutation.mutate()}
                type="button"
              >
                {t("actions.delete")}
              </button>
              <button
                className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold"
                onClick={() => setShowDeleteConfirm(false)}
                type="button"
              >
                {t("actions.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
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
                  fieldErrorPaths={["title"]}
                  minLength={2}
                  onSave={async (v) => {
                    await apiFetch(`/api/cases/${caseId}`, {
                      method: "PUT",
                      body: JSON.stringify({
                        title: v,
                        caseNumber: caseItem.caseNumber,
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
                  required
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
                  fieldErrorPaths={["status"]}
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
            {caseItem.internalRef ? (
              <Detail label={t("labels.internalRef")} value={caseItem.internalRef} />
            ) : null}
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
                            {courtTypeMap.get(court.courtType ?? "") ??
                              court.courtType ??
                              court.circuit ??
                              "—"}
                          </p>
                        </TableCell>
                        <TableCell>
                          {courtLevelMap.get(court.courtLevel) ??
                            court.courtLevel}
                        </TableCell>
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
                  courtTypeOptions={courtTypeOptions}
                  court={editingCourt}
                  isPending={updateCourtMutation.isPending}
                  submitError={updateCourtMutation.isError ? updateCourtMutation.error : null}
                  onCancel={() => setEditingCourt(null)}
                  onSubmit={(payload) =>
                    updateCourtMutation.mutate({
                      courtId: editingCourt.id,
                      payload
                    })
                  }
                  t={t}
                />
              </SectionCard>
            ) : (
              <SectionCard
                title={t("cases.addCourt")}
                description={t("cases.addCourtHelp")}
              >
                <CourtAddForm
                  courtLevelOptions={courtLevelOptions}
                  courtTypeOptions={courtTypeOptions}
                  isPending={addCourtMutation.isPending}
                  resetToken={courtFormResetToken}
                  submitError={addCourtMutation.isError ? addCourtMutation.error : null}
                  onSubmit={(payload) => addCourtMutation.mutate(payload)}
                  t={t}
                />
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
                          {partyRolesQuery.getLabel(party.role)}
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
                                setEditPartyFormError(null);
                                setEditPartyFieldErrors({});
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
                    const clientErrors = validatePartyForm(editPartyForm, t);
                    if (Object.keys(clientErrors).length > 0) {
                      setEditPartyFieldErrors(clientErrors);
                      setEditPartyFormError(t("errors.validation.summary"));
                      return;
                    }
                    setEditPartyFormError(null);
                    setEditPartyFieldErrors({});
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
                      onChange={(value) => {
                        setEditPartyForm({
                          ...editPartyForm,
                          clientId: value,
                          name:
                            clientsQuery.data?.items.find(
                              (client) => client.id === value
                            )?.name ?? editPartyForm.name
                        });
                        setEditPartyFieldErrors((prev) => ({ ...prev, clientId: "" }));
                      }}
                      options={clientOptions}
                      value={editPartyForm.clientId ?? ""}
                      error={
                        pickFieldError(editPartyFieldErrors, ["clientId"]) ?? undefined
                      }
                    />
                  ) : null}
                  <Field
                    label={t("labels.name")}
                    onChange={(value) => {
                      setEditPartyForm({ ...editPartyForm, name: value });
                      setEditPartyFieldErrors((prev) => ({ ...prev, name: "" }));
                    }}
                    value={editPartyForm.name}
                    error={pickFieldError(editPartyFieldErrors, ["name"]) ?? undefined}
                  />
                  <SelectField
                    label={t("labels.role")}
                    onChange={(value) =>
                      setEditPartyForm({ ...editPartyForm, role: value })
                    }
                    options={partyRoleOptions}
                    value={editPartyForm.role}
                  />
                  {editPartyFormError ? (
                    <FormAlert
                      message={editPartyFormError}
                    />
                  ) : null}
                  <div className="flex gap-2">
                    <PrimaryButton disabled={updatePartyMutation.isPending} type="submit">
                      {updatePartyMutation.isPending ? t("labels.saving") : t("actions.save")}
                    </PrimaryButton>
                    <button
                      className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                      onClick={() => {
                        setEditingParty(null);
                        setEditPartyFormError(null);
                        setEditPartyFieldErrors({});
                      }}
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
                    const clientErrors = validatePartyForm(partyForm, t);
                    if (Object.keys(clientErrors).length > 0) {
                      setPartyFieldErrors(clientErrors);
                      setPartyFormError(t("errors.validation.summary"));
                      return;
                    }
                    setPartyFormError(null);
                    setPartyFieldErrors({});
                    addPartyMutation.mutate(partyForm);
                  }}
                >
                  <SelectField
                    label={t("labels.partyType")}
                    onChange={(value) => {
                      setPartyForm({
                        ...partyForm,
                        partyType: value as CasePartyType,
                        clientId:
                          value === "CLIENT"
                            ? (partyForm.clientId ?? "")
                            : undefined
                      });
                      setPartyFieldErrors((prev) => ({ ...prev, clientId: "", name: "" }));
                    }}
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
                      onChange={(value) => {
                        setPartyForm({
                          ...partyForm,
                          clientId: value,
                          name:
                            clientsQuery.data?.items.find(
                              (client) => client.id === value
                            )?.name ?? partyForm.name
                        });
                        setPartyFieldErrors((prev) => ({ ...prev, clientId: "" }));
                      }}
                      options={clientOptions}
                      value={partyForm.clientId ?? ""}
                      error={pickFieldError(partyFieldErrors, ["clientId"]) ?? undefined}
                    />
                  ) : null}
                  <Field
                    label={t("labels.name")}
                    onChange={(value) => {
                      setPartyForm({ ...partyForm, name: value });
                      setPartyFieldErrors((prev) => ({ ...prev, name: "" }));
                    }}
                    value={partyForm.name}
                    error={pickFieldError(partyFieldErrors, ["name"]) ?? undefined}
                  />
                  <SelectField
                    label={t("labels.role")}
                    onChange={(value) =>
                      setPartyForm({ ...partyForm, role: value })
                    }
                    options={partyRoleOptions}
                    value={partyForm.role}
                  />
                  {partyFormError ? (
                    <FormAlert
                      message={partyFormError}
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
                const requiredErrors = validateAssignmentForm(assignmentForm, t);
                if (Object.keys(requiredErrors).length > 0) {
                  setAssignmentFieldErrors(requiredErrors);
                  setAssignmentFormError(t("errors.validation.summary"));
                  return;
                }
                setAssignmentFormError(null);
                setAssignmentFieldErrors({});
                addAssignmentMutation.mutate(assignmentForm);
              }}
            >
              <SelectField
                label={t("labels.user")}
                onChange={(value) => {
                  setAssignmentForm({ ...assignmentForm, userId: value });
                  setAssignmentFieldErrors((prev) => ({ ...prev, userId: "" }));
                }}
                options={[
                  { value: "", label: t("labels.selectUser") },
                  ...(usersQuery.data?.items ?? []).map((user) => ({
                    value: user.id,
                    label: user.fullName
                  }))
                ]}
                value={assignmentForm.userId}
                error={pickFieldError(assignmentFieldErrors, ["userId"]) ?? undefined}
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
              {assignmentFormError ? (
                <FormAlert
                  message={assignmentFormError}
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
            <>
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
              <TablePagination
                page={hearingsPage}
                pageSize={hearingsLimit}
                total={hearingsQuery.data.total}
                onPageChange={setHearingsPage}
                onPageSizeChange={(size) => {
                  setHearingsLimit(size);
                  setHearingsPage(1);
                }}
              />
            </>
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

type CourtFormErrors = Partial<
  Record<
    "courtName" | "governorateValue" | "cityValue" | "courtLevel" | "startedAt" | "endedAt",
    string
  >
>;

function validateCourtDates({
  startedAt,
  endedAt,
  t
}: {
  startedAt?: string | null;
  endedAt?: string | null;
  t: (key: string) => string;
}): CourtFormErrors {
  const errors: CourtFormErrors = {};
  if (startedAt && Number.isNaN(Date.parse(startedAt))) {
    errors.startedAt = t("errors.validation.issue.invalidDate");
  }
  if (endedAt && Number.isNaN(Date.parse(endedAt))) {
    errors.endedAt = t("errors.validation.issue.invalidDate");
  }
  if (
    startedAt &&
    endedAt &&
    !errors.startedAt &&
    !errors.endedAt &&
    new Date(endedAt).getTime() < new Date(startedAt).getTime()
  ) {
    errors.endedAt = t("cases.validation.court.endDateBeforeStartDate");
  }
  return errors;
}

function CourtAddForm({
  courtLevelOptions,
  courtTypeOptions,
  isPending,
  resetToken,
  submitError,
  onSubmit,
  t
}: {
  courtLevelOptions: { value: string; label: string }[];
  courtTypeOptions: { value: string; label: string }[];
  isPending: boolean;
  resetToken: number;
  submitError: unknown;
  onSubmit: (payload: CreateCaseCourtDto) => void;
  t: (key: string) => string;
}) {
  const [form, setForm] = useState<CreateCaseCourtDto>(EMPTY_COURT);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CourtFormErrors>({});
  const { i18n } = useTranslation("app");
  const governorateQuery = useGovernorateLookups();
  const cityQuery = useCityLookups(form.governorateValue);
  const language = i18n.resolvedLanguage ?? i18n.language ?? "en";
  const governorateOptions = toLocalizedLocationOptions(
    governorateQuery.data?.items,
    language
  );
  const cityOptions = toLocalizedLocationOptions(cityQuery.data?.items, language);
  useEffect(() => {
    if (resetToken > 0) {
      setForm(EMPTY_COURT);
      setValidationMessage(null);
      setFieldErrors({});
    }
  }, [resetToken]);

  useEffect(() => {
    if (!submitError) return;
    const resolved = resolveFormValidationError(submitError, t("errors.fallback"));
    const nextErrors: CourtFormErrors = {
      courtName: pickFieldError(resolved.fieldErrors, ["courtName"]) ?? undefined,
      governorateValue:
        pickFieldError(resolved.fieldErrors, ["governorateValue"]) ?? undefined,
      cityValue: pickFieldError(resolved.fieldErrors, ["cityValue"]) ?? undefined,
      courtLevel: pickFieldError(resolved.fieldErrors, ["courtLevel"]) ?? undefined,
      startedAt: pickFieldError(resolved.fieldErrors, ["startedAt"]) ?? undefined
    };
    setFieldErrors(nextErrors);
    setValidationMessage(resolved.message);
  }, [submitError, t]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const errors: CourtFormErrors = {};
        if (!form.courtLevel?.trim()) {
          errors.courtLevel = t("cases.validation.court.courtLevelRequired");
        }
        if (form.cityValue?.trim() && !form.governorateValue?.trim()) {
          errors.governorateValue = t("cases.validation.court.governorateRequiredForCity");
        }
        Object.assign(errors, validateCourtDates({ startedAt: form.startedAt, t }));
        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors);
          setValidationMessage(t("cases.validation.court.summary"));
          return;
        }
        setValidationMessage(null);
        setFieldErrors({});
        onSubmit(form);
      }}
    >
      <Field
        label={t("labels.courtName")}
        onChange={(v) => {
          setForm({ ...form, courtName: v });
          setFieldErrors((prev) => ({ ...prev, courtName: undefined }));
        }}
        value={form.courtName ?? ""}
        error={fieldErrors.courtName}
      />
      <SelectField
        label={t("labels.governorate")}
        onChange={(v) => {
          setForm({ ...form, governorateValue: v, cityValue: "" });
          setFieldErrors((prev) => ({ ...prev, governorateValue: undefined, cityValue: undefined }));
        }}
        options={[{ value: "", label: t("labels.none") }, ...governorateOptions]}
        value={form.governorateValue ?? ""}
        error={fieldErrors.governorateValue}
      />
      <SelectField
        label={t("labels.city")}
        onChange={(v) => {
          setForm({ ...form, cityValue: v });
          setFieldErrors((prev) => ({ ...prev, cityValue: undefined, governorateValue: undefined }));
        }}
        options={[{ value: "", label: t("labels.none") }, ...cityOptions]}
        value={form.cityValue ?? ""}
        error={fieldErrors.cityValue}
      />
      <SelectField
        label={t("labels.courtType")}
        onChange={(v) => setForm({ ...form, courtType: v })}
        options={[{ value: "", label: t("labels.none") }, ...courtTypeOptions]}
        value={form.courtType ?? ""}
      />
      <SelectField
        label={t("labels.courtLevel")}
        onChange={(v) => {
          setForm({ ...form, courtLevel: v });
          setFieldErrors((prev) => ({ ...prev, courtLevel: undefined }));
        }}
        options={
          courtLevelOptions.length
            ? courtLevelOptions
            : [{ value: "PRIMARY", label: "Primary" }]
        }
        value={form.courtLevel}
        required
        error={fieldErrors.courtLevel}
      />
      <Field
        label={t("labels.circuit")}
        onChange={(v) => setForm({ ...form, circuit: v })}
        value={form.circuit ?? ""}
      />
      <Field
        label={t("labels.startDate")}
        onChange={(v) => {
          setForm({ ...form, startedAt: v });
          setFieldErrors((prev) => ({ ...prev, startedAt: undefined, endedAt: undefined }));
        }}
        type="date"
        commitMode="blur"
        value={form.startedAt ?? ""}
        error={fieldErrors.startedAt}
      />
      <PrimaryButton disabled={isPending} type="submit">
        {isPending ? "..." : t("cases.addCourt")}
      </PrimaryButton>
      {validationMessage ? <FormAlert message={validationMessage} /> : null}
    </form>
  );
}

function CourtEditForm({
  court,
  courtLevelOptions,
  courtTypeOptions,
  isPending,
  submitError,
  onCancel,
  onSubmit,
  t
}: {
  court: CaseCourtDto;
  courtLevelOptions: { value: string; label: string }[];
  courtTypeOptions: { value: string; label: string }[];
  isPending: boolean;
  submitError: unknown;
  onCancel: () => void;
  onSubmit: (payload: UpdateCaseCourtDto) => void;
  t: (key: string) => string;
}) {
  const [form, setForm] = useState<UpdateCaseCourtDto>({
    courtName: court.courtName,
    courtLevel: court.courtLevel,
    courtType: court.courtType,
    governorateValue: court.governorateValue,
    cityValue: court.cityValue,
    circuit: court.circuit ?? "",
    startedAt: court.startedAt ?? "",
    endedAt: court.endedAt ?? "",
    isActive: court.isActive,
    notes: court.notes ?? ""
  });
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CourtFormErrors>({});
  const { i18n } = useTranslation("app");
  const governorateQuery = useGovernorateLookups();
  const cityQuery = useCityLookups(form.governorateValue);
  const language = i18n.resolvedLanguage ?? i18n.language ?? "en";
  const governorateOptions = withLegacyLocationOption(
    toLocalizedLocationOptions(governorateQuery.data?.items, language),
    form.governorateValue
  );
  const cityOptions = withLegacyLocationOption(
    toLocalizedLocationOptions(cityQuery.data?.items, language),
    form.cityValue
  );

  useEffect(() => {
    if (!submitError) return;
    const resolved = resolveFormValidationError(submitError, t("errors.fallback"));
    const nextErrors: CourtFormErrors = {
      courtName: pickFieldError(resolved.fieldErrors, ["courtName"]) ?? undefined,
      governorateValue:
        pickFieldError(resolved.fieldErrors, ["governorateValue"]) ?? undefined,
      cityValue: pickFieldError(resolved.fieldErrors, ["cityValue"]) ?? undefined,
      courtLevel: pickFieldError(resolved.fieldErrors, ["courtLevel"]) ?? undefined,
      startedAt: pickFieldError(resolved.fieldErrors, ["startedAt"]) ?? undefined,
      endedAt: pickFieldError(resolved.fieldErrors, ["endedAt"]) ?? undefined
    };
    setFieldErrors(nextErrors);
    setValidationMessage(resolved.message);
  }, [submitError, t]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const errors: CourtFormErrors = {};
        if (!form.courtLevel?.trim()) {
          errors.courtLevel = t("cases.validation.court.courtLevelRequired");
        }
        if (form.cityValue?.trim() && !form.governorateValue?.trim()) {
          errors.governorateValue = t("cases.validation.court.governorateRequiredForCity");
        }
        Object.assign(
          errors,
          validateCourtDates({ startedAt: form.startedAt, endedAt: form.endedAt, t })
        );
        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors);
          setValidationMessage(t("cases.validation.court.summary"));
          return;
        }
        setValidationMessage(null);
        setFieldErrors({});
        onSubmit({
          ...form,
          courtType: form.courtType || null,
          governorateValue: form.governorateValue || null,
          cityValue: form.cityValue || null,
          circuit: form.circuit || null,
          startedAt: form.startedAt || null,
          endedAt: form.endedAt || null,
          notes: form.notes || null
        });
      }}
    >
      <Field
        label={t("labels.courtName")}
        onChange={(v) => {
          setForm({ ...form, courtName: v });
          setFieldErrors((prev) => ({ ...prev, courtName: undefined }));
        }}
        value={form.courtName ?? ""}
        error={fieldErrors.courtName}
      />
      <SelectField
        label={t("labels.governorate")}
        onChange={(v) => {
          setForm({ ...form, governorateValue: v, cityValue: "" });
          setFieldErrors((prev) => ({ ...prev, governorateValue: undefined, cityValue: undefined }));
        }}
        options={[{ value: "", label: t("labels.none") }, ...governorateOptions]}
        value={form.governorateValue ?? ""}
        error={fieldErrors.governorateValue}
      />
      <SelectField
        label={t("labels.city")}
        onChange={(v) => {
          setForm({ ...form, cityValue: v });
          setFieldErrors((prev) => ({ ...prev, cityValue: undefined, governorateValue: undefined }));
        }}
        options={[{ value: "", label: t("labels.none") }, ...cityOptions]}
        value={form.cityValue ?? ""}
        error={fieldErrors.cityValue}
      />
      <SelectField
        label={t("labels.courtType")}
        onChange={(v) => setForm({ ...form, courtType: v })}
        options={[{ value: "", label: t("labels.none") }, ...courtTypeOptions]}
        value={form.courtType ?? ""}
      />
      <SelectField
        label={t("labels.courtLevel")}
        onChange={(v) => {
          setForm({ ...form, courtLevel: v });
          setFieldErrors((prev) => ({ ...prev, courtLevel: undefined }));
        }}
        options={
          courtLevelOptions.length
            ? courtLevelOptions
            : [{ value: "PRIMARY", label: "Primary" }]
        }
        value={form.courtLevel}
        required
        error={fieldErrors.courtLevel}
      />
      <Field
        label={t("labels.circuit")}
        onChange={(v) => setForm({ ...form, circuit: v ?? "" })}
        value={form.circuit ?? ""}
      />
      <Field
        label={t("labels.startDate")}
        onChange={(v) => {
          setForm({ ...form, startedAt: v });
          setFieldErrors((prev) => ({ ...prev, startedAt: undefined, endedAt: undefined }));
        }}
        type="date"
        commitMode="blur"
        value={form.startedAt ?? ""}
        error={fieldErrors.startedAt}
      />
      <Field
        label={t("labels.endDate")}
        onChange={(v) => {
          setForm({ ...form, endedAt: v });
          setFieldErrors((prev) => ({ ...prev, endedAt: undefined }));
        }}
        type="date"
        commitMode="blur"
        value={form.endedAt ?? ""}
        error={fieldErrors.endedAt}
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
      {validationMessage ? <FormAlert message={validationMessage} /> : null}
    </form>
  );
}
