import { useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  useUnsavedChanges,
  useUnsavedChangesBypass
} from "../../lib/useUnsavedChanges";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CaseRoleOnCase,
  CaseStatus,
  ClientType,
  Language,
  SessionOutcome,
  TaskPriority,
  TaskStatus,
  type CaseDto,
  type CasePartyType,
  type ClientListResponseDto,
  type CreateCaseAssignmentDto,
  type CreateCaseCourtDto,
  type CreateCaseDto,
  type CreateCasePartyDto,
  type CreateClientDto,
  type CreateHearingDto,
  type CreateTaskDto,
  type UserListResponseDto
} from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch, apiFormFetch } from "../../lib/api";
import { useMutationFeedback } from "../../lib/feedback";
import { useLookupOptions } from "../../lib/lookups";
import { runUploadQueue } from "../../lib/uploadQueue";
import { getEgyptGovernorateOptions } from "../../lib/egyptGovernorates";
import { getEnumLabel } from "../../lib/enumLabel";
import { useHasPermission } from "../../store/authStore";
import {
  Field,
  FormAlert,
  FormExitActions,
  PageHeader,
  SectionCard,
  SelectField
} from "./ui";

type ClientMode = "existing" | "new";
type ClientFormState = Omit<CreateClientDto, "type"> & {
  type: ClientType | "";
};

type DraftCourt = {
  id: string;
  courtName: string;
  courtLevel: string;
  circuit: string;
  caseNumber: string;
  startedAt: string;
  notes: string;
};

type DraftParty = {
  id: string;
  name: string;
  role: string;
  partyType: CasePartyType;
  clientId: string;
};

type DraftAssignment = {
  id: string;
  userId: string;
  roleOnCase: CaseRoleOnCase;
};

type DraftHearing = {
  id: string;
  assignedLawyerId: string;
  sessionDatetime: string;
  nextSessionAt: string;
  outcome: SessionOutcome | "";
  notes: string;
};

type DraftTask = {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  assignedToId: string;
  dueAt: string;
};

type DraftDocument = {
  id: string;
  title: string;
  type: string;
  file: File | null;
};

type SubmitSection =
  | "client"
  | "case"
  | "courts"
  | "parties"
  | "assignments"
  | "status"
  | "hearings"
  | "tasks"
  | "documents";

const DEFAULT_PARTY_ROLE = "PLAINTIFF";

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function toNullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function isIdentityType(type: ClientType | "") {
  return type === ClientType.INDIVIDUAL || type === ClientType.GOVERNMENT;
}

export function normalizeClientPayload(form: ClientFormState): CreateClientDto {
  return {
    name: form.name.trim(),
    type: form.type as ClientType,
    phone: toNullable(form.phone),
    email: toNullable(form.email),
    governorate: toNullable(form.governorate),
    preferredLanguage: form.preferredLanguage ?? Language.AR,
    nationalId: isIdentityType(form.type) ? toNullable(form.nationalId) : null,
    commercialRegister:
      form.type === ClientType.COMPANY
        ? toNullable(form.commercialRegister)
        : null,
    taxNumber:
      form.type === ClientType.COMPANY ? toNullable(form.taxNumber) : null,
    contacts: []
  };
}

function emptyCourt(): DraftCourt {
  return {
    id: makeId("court"),
    courtName: "",
    courtLevel: "",
    circuit: "",
    caseNumber: "",
    startedAt: "",
    notes: ""
  };
}

function emptyParty(): DraftParty {
  return {
    id: makeId("party"),
    name: "",
    role: DEFAULT_PARTY_ROLE,
    partyType: "OPPONENT",
    clientId: ""
  };
}

function emptyAssignment(): DraftAssignment {
  return {
    id: makeId("assignment"),
    userId: "",
    roleOnCase: CaseRoleOnCase.LEAD
  };
}

function emptyHearing(): DraftHearing {
  return {
    id: makeId("hearing"),
    assignedLawyerId: "",
    sessionDatetime: "",
    nextSessionAt: "",
    outcome: "",
    notes: ""
  };
}

function emptyTask(): DraftTask {
  return {
    id: makeId("task"),
    title: "",
    description: "",
    priority: TaskPriority.MEDIUM,
    assignedToId: "",
    dueAt: ""
  };
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function isPartyPristine(party: DraftParty): boolean {
  return (
    !hasText(party.name) &&
    party.role === DEFAULT_PARTY_ROLE &&
    party.partyType === "OPPONENT" &&
    !hasText(party.clientId)
  );
}

export function isQuickIntakeDirty(state: {
  caseForm: Pick<CreateCaseDto, "title" | "caseNumber"> &
    Partial<Pick<CreateCaseDto, "internalReference" | "type">>;
  statusForm?: { status: CaseStatus; note: string };
  existingClientId: string;
  initialExistingClientId?: string;
  clientForm: Pick<ClientFormState, "name">;
  courts: DraftCourt[];
  parties: DraftParty[];
  assignments: DraftAssignment[];
  hearings: DraftHearing[];
  tasks: DraftTask[];
  documents: DraftDocument[];
}): boolean {
  return (
    hasText(state.caseForm.title) ||
    hasText(state.caseForm.caseNumber) ||
    hasText(state.caseForm.internalReference) ||
    (state.caseForm.type ?? "CIVIL") !== "CIVIL" ||
    state.existingClientId !== (state.initialExistingClientId ?? "") ||
    (state.statusForm?.status ?? CaseStatus.ACTIVE) !== CaseStatus.ACTIVE ||
    hasText(state.statusForm?.note) ||
    hasText(state.clientForm.name) ||
    state.courts.some(
      (court) =>
        hasText(court.courtName) ||
        hasText(court.courtLevel) ||
        hasText(court.caseNumber) ||
        hasText(court.startedAt) ||
        hasText(court.circuit) ||
        hasText(court.notes)
    ) ||
    state.parties.some((party) => !isPartyPristine(party)) ||
    state.assignments.some((assignment) => hasText(assignment.userId)) ||
    state.hearings.some(
      (hearing) =>
        hasText(hearing.sessionDatetime) ||
        hasText(hearing.assignedLawyerId) ||
        hasText(hearing.notes) ||
        hasText(hearing.nextSessionAt)
    ) ||
    state.tasks.some(
      (task) =>
        hasText(task.title) ||
        hasText(task.description) ||
        hasText(task.assignedToId) ||
        hasText(task.dueAt)
    ) ||
    state.documents.some((doc) => doc.file !== null || hasText(doc.title))
  );
}

export function CaseQuickIntakePage() {
  const { t, i18n } = useTranslation("app");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const feedback = useMutationFeedback();
  const search = useSearch({ strict: false }) as { clientId?: string };

  const canCreateCases = useHasPermission("cases:create");
  const canReadClients = useHasPermission("clients:read");
  const canCreateClients = useHasPermission("clients:create");
  const canUpdateCases = useHasPermission("cases:update");
  const canAssignCases = useHasPermission("cases:assign");
  const canChangeCaseStatus = useHasPermission("cases:status");
  const canCreateHearings = useHasPermission("hearings:create");
  const canCreateTasks = useHasPermission("tasks:create");
  const canCreateDocuments = useHasPermission("documents:create");

  const [clientMode, setClientMode] = useState<ClientMode>(
    canReadClients ? "existing" : "new"
  );
  const initialExistingClientId = search.clientId ?? "";
  const [existingClientId, setExistingClientId] = useState(
    initialExistingClientId
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null
  );
  const [submitSummary, setSubmitSummary] = useState<{
    caseId: string | null;
    failedSections: SubmitSection[];
    message: string;
  } | null>(null);
  const [retryContext, setRetryContext] = useState<{
    caseId: string;
    failedSections: SubmitSection[];
  } | null>(null);
  const { bypassRef, allowNextNavigation } = useUnsavedChangesBypass();
  const documentPickerRef = useRef<HTMLInputElement>(null);

  const [clientForm, setClientForm] = useState<ClientFormState>({
    name: "",
    type: "",
    phone: "",
    email: "",
    governorate: "",
    preferredLanguage: Language.AR,
    nationalId: "",
    commercialRegister: "",
    taxNumber: "",
    contacts: []
  });

  const [caseForm, setCaseForm] = useState<CreateCaseDto>({
    clientId: search.clientId ?? "",
    title: "",
    caseNumber: "",
    internalReference: "",
    judicialYear: null,
    type: "CIVIL"
  });

  const [statusForm, setStatusForm] = useState<{
    status: CaseStatus;
    note: string;
  }>({
    status: CaseStatus.ACTIVE,
    note: ""
  });

  const [courts, setCourts] = useState<DraftCourt[]>([emptyCourt()]);
  const [parties, setParties] = useState<DraftParty[]>([emptyParty()]);
  const [assignments, setAssignments] = useState<DraftAssignment[]>([
    emptyAssignment()
  ]);
  const [hearings, setHearings] = useState<DraftHearing[]>([emptyHearing()]);
  const [tasks, setTasks] = useState<DraftTask[]>([emptyTask()]);
  const [documents, setDocuments] = useState<DraftDocument[]>([]);
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);

  const quickIntakeDirty = isQuickIntakeDirty({
    caseForm,
    statusForm,
    existingClientId,
    initialExistingClientId,
    clientForm,
    courts,
    parties,
    assignments,
    hearings,
    tasks,
    documents
  });

  useUnsavedChanges(quickIntakeDirty, { bypassBlockRef: bypassRef });

  const clientsQuery = useQuery({
    queryKey: ["clients", "quick-intake"],
    queryFn: () => apiFetch<ClientListResponseDto>("/api/clients?limit=200"),
    enabled: canReadClients
  });

  const usersQuery = useQuery({
    queryKey: ["users", "quick-intake"],
    queryFn: () => apiFetch<UserListResponseDto>("/api/users"),
    enabled: canAssignCases || canCreateHearings || canCreateTasks
  });

  const caseTypesQuery = useLookupOptions("CaseType");
  const courtLevelsQuery = useLookupOptions("CourtLevel");
  const partyRolesQuery = useLookupOptions("PartyRole");
  const docTypesQuery = useLookupOptions("DocumentType");

  const createClientMutation = useMutation({
    mutationFn: (payload: CreateClientDto) =>
      apiFetch<{ id: string; name: string }>("/api/clients", {
        method: "POST",
        body: JSON.stringify(payload)
      })
  });

  const createCaseMutation = useMutation({
    mutationFn: (payload: CreateCaseDto) =>
      apiFetch<CaseDto>("/api/cases", {
        method: "POST",
        body: JSON.stringify(payload)
      })
  });

  const submitting =
    createClientMutation.isPending || createCaseMutation.isPending;

  const clientOptions = useMemo(
    () => [
      { value: "", label: t("labels.selectClient") },
      ...(clientsQuery.data?.items ?? []).map((client) => ({
        value: client.id,
        label: client.name
      }))
    ],
    [clientsQuery.data?.items, t]
  );

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

  const clientTypeOptions = Object.values(ClientType).map((value) => ({
    value,
    label: getEnumLabel(t, "ClientType", value)
  }));

  const languageOptions = Object.values(Language).map((value) => ({
    value,
    label: getEnumLabel(t, "Language", value)
  }));

  const governorateOptions = getEgyptGovernorateOptions(
    i18n.resolvedLanguage ?? i18n.language ?? "en"
  );

  const courtLevelOptions = (courtLevelsQuery.data?.items ?? []).map(
    (item) => ({
      value: item.key,
      label: item.labelAr
    })
  );

  const partyRoleOptions = (partyRolesQuery.data?.items ?? []).map((item) => ({
    value: item.key,
    label: item.labelAr
  }));

  const userOptions = [
    { value: "", label: t("labels.selectUser") },
    ...(usersQuery.data?.items ?? []).map((user) => ({
      value: user.id,
      label: user.fullName
    }))
  ];

  const assignmentRoleOptions = Object.values(CaseRoleOnCase).map((value) => ({
    value,
    label: getEnumLabel(t, "CaseRoleOnCase", value)
  }));

  const statusOptions = Object.values(CaseStatus).map((value) => ({
    value,
    label: getEnumLabel(t, "CaseStatus", value)
  }));

  const sessionOutcomeOptions = [
    { value: "", label: t("labels.none") },
    ...Object.values(SessionOutcome).map((value) => ({
      value,
      label: getEnumLabel(t, "SessionOutcome", value)
    }))
  ];

  const taskPriorityOptions = Object.values(TaskPriority).map((value) => ({
    value,
    label: getEnumLabel(t, "TaskPriority", value)
  }));

  const documentTypeOptions = (docTypesQuery.data?.items ?? []).map((item) => ({
    value: item.key,
    label: getEnumLabel(t, "DocumentType", item.key)
  }));
  if (!documentTypeOptions.length) {
    documentTypeOptions.push({
      value: "GENERAL",
      label: getEnumLabel(t, "DocumentType", "GENERAL")
    });
  }

  const effectiveExistingClientEnabled = canReadClients;
  const effectiveInlineClientEnabled = canCreateClients;

  const hasRequiredReady =
    (clientMode === "existing"
      ? existingClientId.trim() !== ""
      : clientForm.name.trim() !== "" && !!clientForm.type) &&
    caseForm.title.trim() !== "" &&
    caseForm.caseNumber.trim() !== "" &&
    caseForm.type.trim() !== "";

  function addCourtRow() {
    setCourts((prev) => [...prev, emptyCourt()]);
  }

  function updateCourtRow(id: string, patch: Partial<DraftCourt>) {
    setCourts((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  function removeCourtRow(id: string) {
    setCourts((prev) =>
      prev.length === 1 ? prev : prev.filter((row) => row.id !== id)
    );
  }

  function addPartyRow() {
    setParties((prev) => [...prev, emptyParty()]);
  }

  function updatePartyRow(id: string, patch: Partial<DraftParty>) {
    setParties((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  function removePartyRow(id: string) {
    setParties((prev) =>
      prev.length === 1 ? prev : prev.filter((row) => row.id !== id)
    );
  }

  function addAssignmentRow() {
    setAssignments((prev) => [...prev, emptyAssignment()]);
  }

  function updateAssignmentRow(id: string, patch: Partial<DraftAssignment>) {
    setAssignments((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  function removeAssignmentRow(id: string) {
    setAssignments((prev) =>
      prev.length === 1 ? prev : prev.filter((row) => row.id !== id)
    );
  }

  function addHearingRow() {
    setHearings((prev) => [...prev, emptyHearing()]);
  }

  function updateHearingRow(id: string, patch: Partial<DraftHearing>) {
    setHearings((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  function removeHearingRow(id: string) {
    setHearings((prev) =>
      prev.length === 1 ? prev : prev.filter((row) => row.id !== id)
    );
  }

  function addTaskRow() {
    setTasks((prev) => [...prev, emptyTask()]);
  }

  function updateTaskRow(id: string, patch: Partial<DraftTask>) {
    setTasks((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  function removeTaskRow(id: string) {
    setTasks((prev) =>
      prev.length === 1 ? prev : prev.filter((row) => row.id !== id)
    );
  }

  function addDocumentFiles(files: FileList | null) {
    if (!files?.length) return;
    const rows = Array.from(files).map((file) => ({
      id: makeId("document"),
      title: file.name,
      type: "GENERAL",
      file
    }));
    setDocuments((prev) => [...prev, ...rows]);
    if (documentPickerRef.current) {
      documentPickerRef.current.value = "";
    }
  }

  function updateDocumentRow(id: string, patch: Partial<DraftDocument>) {
    setDocuments((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  function removeDocumentRow(id: string) {
    setDocuments((prev) => prev.filter((row) => row.id !== id));
  }

  async function postCourt(caseId: string, row: DraftCourt) {
    const payload: CreateCaseCourtDto = {
      courtName: row.courtName.trim(),
      courtLevel: row.courtLevel,
      circuit: toNullable(row.circuit),
      caseNumber: toNullable(row.caseNumber),
      startedAt: toNullable(row.startedAt),
      notes: toNullable(row.notes)
    };

    return apiFetch(`/api/cases/${caseId}/courts`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async function postParty(caseId: string, row: DraftParty) {
    const payload: CreateCasePartyDto = {
      name: row.name.trim(),
      role: row.role,
      partyType: row.partyType,
      clientId: row.partyType === "CLIENT" ? row.clientId : null
    };

    return apiFetch(`/api/cases/${caseId}/parties`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async function postAssignment(caseId: string, row: DraftAssignment) {
    const payload: CreateCaseAssignmentDto = {
      userId: row.userId,
      roleOnCase: row.roleOnCase
    };

    return apiFetch(`/api/cases/${caseId}/assignments`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async function patchStatus(caseId: string) {
    return apiFetch(`/api/cases/${caseId}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status: statusForm.status,
        note: toNullable(statusForm.note)
      })
    });
  }

  async function postHearing(caseId: string, row: DraftHearing) {
    const payload: CreateHearingDto = {
      caseId,
      assignedLawyerId: toNullable(row.assignedLawyerId),
      sessionDatetime: new Date(row.sessionDatetime).toISOString(),
      nextSessionAt: row.nextSessionAt
        ? new Date(row.nextSessionAt).toISOString()
        : null,
      outcome: row.outcome ? (row.outcome as SessionOutcome) : null,
      notes: toNullable(row.notes)
    };

    return apiFetch("/api/hearings", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async function postTask(caseId: string, row: DraftTask) {
    const payload: CreateTaskDto = {
      caseId,
      title: row.title.trim(),
      description: toNullable(row.description),
      status: TaskStatus.PENDING,
      priority: row.priority,
      assignedToId: toNullable(row.assignedToId),
      dueAt: row.dueAt ? new Date(row.dueAt).toISOString() : null
    };

    return apiFetch("/api/tasks", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async function postDocument(caseId: string, row: DraftDocument) {
    const file = row.file;
    if (!file) return;

    const formData = new FormData();
    formData.append("title", row.title.trim() || file.name);
    formData.append("type", row.type || "GENERAL");
    formData.append("caseId", caseId);
    formData.append("file", file);

    return apiFormFetch("/api/documents", {
      method: "POST",
      body: formData
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationMessage(null);
    setSubmitSummary(null);

    if (!canCreateCases) {
      setValidationMessage(t("quickIntake.noCasePermission"));
      return;
    }

    if (!retryContext && !hasRequiredReady) {
      setValidationMessage(t("quickIntake.validation.caseRequired"));
      return;
    }

    const shouldAttemptSection = (section: SubmitSection) =>
      !retryContext || retryContext.failedSections.includes(section);

    let resolvedClientId = existingClientId;
    let caseId = retryContext?.caseId ?? null;

    try {
      if (!caseId) {
        if (clientMode === "existing") {
          if (!canReadClients) {
            setValidationMessage(t("quickIntake.noClientReadPermission"));
            return;
          }
        } else {
          if (!canCreateClients) {
            setValidationMessage(t("quickIntake.noClientCreatePermission"));
            return;
          }
          const createdClient = await createClientMutation.mutateAsync(
            normalizeClientPayload(clientForm)
          );
          resolvedClientId = createdClient.id;
          await queryClient.invalidateQueries({ queryKey: ["clients"] });
        }

        const createdCase = await createCaseMutation.mutateAsync({
          ...caseForm,
          clientId: resolvedClientId,
          title: caseForm.title.trim(),
          caseNumber: caseForm.caseNumber.trim(),
          internalReference: toNullable(caseForm.internalReference),
          judicialYear: caseForm.judicialYear
        });

        caseId = createdCase.id;
      }
      const failedSections: SubmitSection[] = [];

      if (caseId === null) {
        setValidationMessage(t("errors.fallback"));
        return;
      }
      const resolvedCaseId = caseId;

      if (canUpdateCases && shouldAttemptSection("courts")) {
        const rows = courts.filter(
          (row) => row.courtName.trim() && row.courtLevel.trim()
        );
        if (rows.length) {
          const result = await Promise.allSettled(
            rows.map((row) => postCourt(resolvedCaseId, row))
          );
          if (result.some((r) => r.status === "rejected")) {
            failedSections.push("courts");
          }
        }
      }

      if (canUpdateCases && shouldAttemptSection("parties")) {
        const rows = parties.filter(
          (row) =>
            row.name.trim() &&
            row.role.trim() &&
            (row.partyType !== "CLIENT" || row.clientId.trim() !== "")
        );
        if (rows.length) {
          const result = await Promise.allSettled(
            rows.map((row) => postParty(resolvedCaseId, row))
          );
          if (result.some((r) => r.status === "rejected")) {
            failedSections.push("parties");
          }
        }
      }

      if (canAssignCases && shouldAttemptSection("assignments")) {
        const rows = assignments.filter((row) => row.userId.trim() !== "");
        if (rows.length) {
          const result = await Promise.allSettled(
            rows.map((row) => postAssignment(resolvedCaseId, row))
          );
          if (result.some((r) => r.status === "rejected")) {
            failedSections.push("assignments");
          }
        }
      }

      if (
        canChangeCaseStatus &&
        shouldAttemptSection("status") &&
        statusForm.status !== CaseStatus.ACTIVE
      ) {
        const result = await Promise.allSettled([patchStatus(resolvedCaseId)]);
        if (result.some((r) => r.status === "rejected")) {
          failedSections.push("status");
        }
      }

      if (canCreateHearings && shouldAttemptSection("hearings")) {
        const rows = hearings.filter(
          (row) => row.sessionDatetime.trim() !== ""
        );
        if (rows.length) {
          const result = await Promise.allSettled(
            rows.map((row) => postHearing(resolvedCaseId, row))
          );
          if (result.some((r) => r.status === "rejected")) {
            failedSections.push("hearings");
          }
        }
      }

      if (canCreateTasks && shouldAttemptSection("tasks")) {
        const rows = tasks.filter((row) => row.title.trim() !== "");
        if (rows.length) {
          const result = await Promise.allSettled(
            rows.map((row) => postTask(resolvedCaseId, row))
          );
          if (result.some((r) => r.status === "rejected")) {
            failedSections.push("tasks");
          }
        }
      }

      const docRows = documents.filter((row) => row.file !== null);
      if (shouldAttemptSection("documents") && docRows.length) {
        if (!canCreateDocuments) {
          setValidationMessage(
            t(
              "quickIntake.noDocumentCreatePermission",
              "You do not have permission to upload documents. Documents were skipped."
            )
          );
          failedSections.push("documents");
        } else {
          const docSummary = await runUploadQueue({
            items: docRows,
            concurrency: 3,
            upload: async (row) => postDocument(resolvedCaseId, row)
          });
          if (docSummary.failedCount > 0) {
            failedSections.push("documents");
          }
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["cases"] });
      await queryClient.invalidateQueries({ queryKey: ["case", resolvedCaseId] });
      await queryClient.invalidateQueries({
        queryKey: ["case-hearings", resolvedCaseId]
      });
      await queryClient.invalidateQueries({
        queryKey: ["case-tasks", resolvedCaseId]
      });
      await queryClient.invalidateQueries({
        queryKey: ["case-documents", resolvedCaseId]
      });

      if (failedSections.length > 0) {
        setRetryContext({
          caseId: resolvedCaseId,
          failedSections
        });
        setSubmitSummary({
          caseId: resolvedCaseId,
          failedSections,
          message: t("quickIntake.savedWithIssues", {
            sections: failedSections
              .map((s) => t(`quickIntake.section.${s}`))
              .join(", ")
          })
        });
        return;
      }

      setRetryContext(null);
      feedback.success("messages.caseCreated");
      allowNextNavigation();
      void navigate({ to: "/app/cases/$caseId", params: { caseId: resolvedCaseId } });
    } catch (error) {
      setValidationMessage((error as Error)?.message ?? t("errors.fallback"));
    }
  }

  if (!canCreateCases) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={t("cases.eyebrow")}
          title={t("quickIntake.title")}
          description={t("quickIntake.description")}
        />
        <SectionCard
          title={t("quickIntake.title")}
          description={t("quickIntake.description")}
        >
          <FormAlert
            message={t("quickIntake.noCasePermission")}
            variant="info"
          />
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("cases.eyebrow")}
        title={t("quickIntake.title")}
        description={t("quickIntake.description")}
        actions={
          <Link
            to="/app/cases"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-accent hover:text-accent"
          >
            {t("actions.cancel")}
          </Link>
        }
      />
      <form className="space-y-4" onSubmit={handleSubmit}>
        <SectionCard
          title={t("quickIntake.clientStepTitle")}
          description={t("quickIntake.clientStepHelp")}
        >
          <div className="space-y-4">
            {effectiveExistingClientEnabled && effectiveInlineClientEnabled ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setClientMode("existing")}
                  className={`rounded-2xl border px-3 py-1.5 text-sm font-medium transition ${
                    clientMode === "existing"
                      ? "border-accent bg-accent text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t("quickIntake.useExistingClient")}
                </button>
                <button
                  type="button"
                  onClick={() => setClientMode("new")}
                  className={`rounded-2xl border px-3 py-1.5 text-sm font-medium transition ${
                    clientMode === "new"
                      ? "border-accent bg-accent text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t("quickIntake.createClientInline")}
                </button>
              </div>
            ) : null}

            {clientMode === "existing" ? (
              <>
                <SelectField
                  label={t("labels.client")}
                  value={existingClientId}
                  onChange={(value) => {
                    setExistingClientId(value);
                    setCaseForm((current) => ({ ...current, clientId: value }));
                  }}
                  options={clientOptions}
                  required
                />
                {clientsQuery.isError ? (
                  <FormAlert
                    message={
                      (clientsQuery.error as Error)?.message ??
                      t("errors.fallback")
                    }
                  />
                ) : null}
              </>
            ) : (
              <>
                <Field
                  label={t("labels.name")}
                  value={clientForm.name}
                  onChange={(value) =>
                    setClientForm({ ...clientForm, name: value })
                  }
                  required
                />
                <SelectField
                  label={t("labels.type")}
                  value={clientForm.type}
                  onChange={(value) =>
                    setClientForm({
                      ...clientForm,
                      type: value as ClientType | ""
                    })
                  }
                  options={[
                    { value: "", label: t("labels.selectType") },
                    ...clientTypeOptions
                  ]}
                  required
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    dir="ltr"
                    label={t("labels.email")}
                    type="email"
                    value={clientForm.email ?? ""}
                    onChange={(value) =>
                      setClientForm({ ...clientForm, email: value })
                    }
                  />
                  <Field
                    dir="ltr"
                    label={t("labels.phone")}
                    value={clientForm.phone ?? ""}
                    onChange={(value) =>
                      setClientForm({ ...clientForm, phone: value })
                    }
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField
                    label={t("labels.governorate")}
                    value={clientForm.governorate ?? ""}
                    onChange={(value) =>
                      setClientForm({ ...clientForm, governorate: value })
                    }
                    options={[{ value: "", label: "-" }, ...governorateOptions]}
                  />
                  <SelectField
                    label={t("labels.language")}
                    value={clientForm.preferredLanguage ?? Language.AR}
                    onChange={(value) =>
                      setClientForm({
                        ...clientForm,
                        preferredLanguage: value as Language
                      })
                    }
                    options={languageOptions}
                  />
                </div>
                {isIdentityType(clientForm.type) ? (
                  <Field
                    dir="ltr"
                    label={t("labels.nationalId")}
                    value={clientForm.nationalId ?? ""}
                    onChange={(value) =>
                      setClientForm({ ...clientForm, nationalId: value })
                    }
                  />
                ) : null}
                {clientForm.type === ClientType.COMPANY ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      dir="ltr"
                      label={t("labels.commercialRegister")}
                      value={clientForm.commercialRegister ?? ""}
                      onChange={(value) =>
                        setClientForm({
                          ...clientForm,
                          commercialRegister: value
                        })
                      }
                    />
                    <Field
                      dir="ltr"
                      label={t("labels.taxNumber")}
                      value={clientForm.taxNumber ?? ""}
                      onChange={(value) =>
                        setClientForm({ ...clientForm, taxNumber: value })
                      }
                    />
                  </div>
                ) : null}
              </>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title={t("quickIntake.caseStepTitle")}
          description={t("quickIntake.caseStepHelp")}
        >
          <div className="space-y-4">
            <Field
              label={t("labels.caseTitle")}
              value={caseForm.title}
              onChange={(value) => setCaseForm({ ...caseForm, title: value })}
              required
            />
            <Field
              label={t("labels.caseNumber")}
              value={caseForm.caseNumber}
              onChange={(value) =>
                setCaseForm({ ...caseForm, caseNumber: value })
              }
              required
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label={t("labels.internalReference")}
                value={caseForm.internalReference ?? ""}
                onChange={(value) =>
                  setCaseForm({ ...caseForm, internalReference: value })
                }
              />
              <Field
                label={t("labels.judicialYear")}
                type="number"
                value={
                  caseForm.judicialYear === null
                    ? ""
                    : String(caseForm.judicialYear)
                }
                onChange={(value) => {
                  if (value.trim() === "") {
                    setCaseForm({ ...caseForm, judicialYear: null });
                    return;
                  }
                  const parsed = Number.parseInt(value, 10);
                  setCaseForm({
                    ...caseForm,
                    judicialYear: Number.isNaN(parsed) ? null : parsed
                  });
                }}
              />
            </div>
            <SelectField
              label={t("labels.caseType")}
              value={caseForm.type}
              onChange={(value) => setCaseForm({ ...caseForm, type: value })}
              options={caseTypeOptions}
              required
            />
          </div>
        </SectionCard>

        <div>
          <button
            type="button"
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setShowAdditionalDetails((current) => !current)}
            aria-expanded={showAdditionalDetails}
            aria-controls="quick-intake-additional-sections"
          >
            {showAdditionalDetails
              ? t("quickIntake.hideAdditionalDetails")
              : t("quickIntake.showAdditionalDetails")}
          </button>
        </div>

        {showAdditionalDetails ? (
          <div id="quick-intake-additional-sections" className="space-y-4">

        <SectionCard
          title={t("quickIntake.section.status")}
          description={t("quickIntake.statusHelp")}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField
              label={t("labels.status")}
              value={statusForm.status}
              onChange={(value) =>
                setStatusForm((prev) => ({
                  ...prev,
                  status: value as CaseStatus
                }))
              }
              options={statusOptions}
            />
            <Field
              label={t("labels.notes")}
              value={statusForm.note}
              onChange={(value) =>
                setStatusForm((prev) => ({ ...prev, note: value }))
              }
            />
          </div>
        </SectionCard>

        <SectionCard
          title={t("quickIntake.section.courts")}
          description={t("quickIntake.courtsHelp")}
        >
          <div className="space-y-3">
            {courts.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <Field
                    label={t("labels.courtName")}
                    value={row.courtName}
                    onChange={(value) =>
                      updateCourtRow(row.id, { courtName: value })
                    }
                  />
                  <SelectField
                    label={t("labels.courtLevel")}
                    value={row.courtLevel}
                    onChange={(value) =>
                      updateCourtRow(row.id, { courtLevel: value })
                    }
                    options={[
                      { value: "", label: t("labels.none") },
                      ...courtLevelOptions
                    ]}
                  />
                  <Field
                    label={t("labels.circuit")}
                    value={row.circuit}
                    onChange={(value) =>
                      updateCourtRow(row.id, { circuit: value })
                    }
                  />
                  <Field
                    label={t("labels.caseNumber")}
                    value={row.caseNumber}
                    onChange={(value) =>
                      updateCourtRow(row.id, { caseNumber: value })
                    }
                  />
                  <Field
                    label={t("labels.startDate")}
                    type="date"
                    value={row.startedAt}
                    onChange={(value) =>
                      updateCourtRow(row.id, { startedAt: value })
                    }
                  />
                  <Field
                    label={t("labels.notes")}
                    value={row.notes}
                    onChange={(value) =>
                      updateCourtRow(row.id, { notes: value })
                    }
                  />
                </div>
                <button
                  type="button"
                  className="text-sm text-red-600"
                  onClick={() => removeCourtRow(row.id)}
                >
                  {t("actions.delete")}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
              onClick={addCourtRow}
            >
              {t("quickIntake.addCourt")}
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title={t("quickIntake.section.parties")}
          description={t("quickIntake.partiesHelp")}
        >
          <div className="space-y-3">
            {parties.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <Field
                    label={t("labels.name")}
                    value={row.name}
                    onChange={(value) =>
                      updatePartyRow(row.id, { name: value })
                    }
                  />
                  <SelectField
                    label={t("labels.role")}
                    value={row.role}
                    onChange={(value) =>
                      updatePartyRow(row.id, { role: value })
                    }
                    options={
                      partyRoleOptions.length
                        ? partyRoleOptions
                        : [{ value: "PLAINTIFF", label: "Plaintiff" }]
                    }
                  />
                  <SelectField
                    label={t("labels.partyType")}
                    value={row.partyType}
                    onChange={(value) =>
                      updatePartyRow(row.id, {
                        partyType: value as CasePartyType,
                        clientId: value === "CLIENT" ? row.clientId : ""
                      })
                    }
                    options={[
                      { value: "CLIENT", label: t("partyTypes.CLIENT") },
                      { value: "OPPONENT", label: t("partyTypes.OPPONENT") },
                      { value: "EXTERNAL", label: t("partyTypes.EXTERNAL") }
                    ]}
                  />
                  {row.partyType === "CLIENT" ? (
                    <SelectField
                      label={t("labels.client")}
                      value={row.clientId}
                      onChange={(value) =>
                        updatePartyRow(row.id, { clientId: value })
                      }
                      options={clientOptions}
                    />
                  ) : null}
                </div>
                <button
                  type="button"
                  className="text-sm text-red-600"
                  onClick={() => removePartyRow(row.id)}
                >
                  {t("actions.delete")}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
              onClick={addPartyRow}
            >
              {t("quickIntake.addParty")}
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title={t("quickIntake.section.assignments")}
          description={t("quickIntake.assignmentsHelp")}
        >
          <div className="space-y-3">
            {assignments.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <SelectField
                    label={t("labels.user")}
                    value={row.userId}
                    onChange={(value) =>
                      updateAssignmentRow(row.id, { userId: value })
                    }
                    options={userOptions}
                  />
                  <SelectField
                    label={t("labels.role")}
                    value={row.roleOnCase}
                    onChange={(value) =>
                      updateAssignmentRow(row.id, {
                        roleOnCase: value as CaseRoleOnCase
                      })
                    }
                    options={assignmentRoleOptions}
                  />
                </div>
                <button
                  type="button"
                  className="text-sm text-red-600"
                  onClick={() => removeAssignmentRow(row.id)}
                >
                  {t("actions.delete")}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
              onClick={addAssignmentRow}
            >
              {t("quickIntake.addAssignment")}
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title={t("quickIntake.section.hearings")}
          description={t("quickIntake.hearingsHelp")}
        >
          <div className="space-y-3">
            {hearings.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <Field
                    commitMode="blur"
                    label={t("labels.sessionDatetime")}
                    type="datetime-local"
                    value={row.sessionDatetime}
                    onChange={(value) =>
                      updateHearingRow(row.id, { sessionDatetime: value })
                    }
                  />
                  <SelectField
                    label={t("labels.assignedLawyer")}
                    value={row.assignedLawyerId}
                    onChange={(value) =>
                      updateHearingRow(row.id, { assignedLawyerId: value })
                    }
                    options={[
                      { value: "", label: t("labels.unassigned") },
                      ...userOptions.filter((u) => u.value !== "")
                    ]}
                  />
                  <Field
                    commitMode="blur"
                    label={t("labels.nextSession")}
                    type="datetime-local"
                    value={row.nextSessionAt}
                    onChange={(value) =>
                      updateHearingRow(row.id, { nextSessionAt: value })
                    }
                  />
                  <SelectField
                    label={t("labels.outcome")}
                    value={row.outcome}
                    onChange={(value) =>
                      updateHearingRow(row.id, {
                        outcome: value as SessionOutcome | ""
                      })
                    }
                    options={sessionOutcomeOptions}
                  />
                  <Field
                    label={t("labels.notes")}
                    value={row.notes}
                    onChange={(value) =>
                      updateHearingRow(row.id, { notes: value })
                    }
                  />
                </div>
                <button
                  type="button"
                  className="text-sm text-red-600"
                  onClick={() => removeHearingRow(row.id)}
                >
                  {t("actions.delete")}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
              onClick={addHearingRow}
            >
              {t("quickIntake.addHearing")}
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title={t("quickIntake.section.tasks")}
          description={t("quickIntake.tasksHelp")}
        >
          <div className="space-y-3">
            {tasks.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <Field
                    label={t("labels.taskTitle")}
                    value={row.title}
                    onChange={(value) =>
                      updateTaskRow(row.id, { title: value })
                    }
                  />
                  <SelectField
                    label={t("labels.priority")}
                    value={row.priority}
                    onChange={(value) =>
                      updateTaskRow(row.id, { priority: value as TaskPriority })
                    }
                    options={taskPriorityOptions}
                  />
                  <SelectField
                    label={t("labels.assignedLawyer")}
                    value={row.assignedToId}
                    onChange={(value) =>
                      updateTaskRow(row.id, { assignedToId: value })
                    }
                    options={[
                      { value: "", label: t("labels.unassigned") },
                      ...userOptions.filter((u) => u.value !== "")
                    ]}
                  />
                  <Field
                    label={t("labels.dueDate")}
                    type="date"
                    value={row.dueAt}
                    onChange={(value) =>
                      updateTaskRow(row.id, { dueAt: value })
                    }
                  />
                  <Field
                    label={t("labels.description")}
                    value={row.description}
                    onChange={(value) =>
                      updateTaskRow(row.id, { description: value })
                    }
                  />
                </div>
                <button
                  type="button"
                  className="text-sm text-red-600"
                  onClick={() => removeTaskRow(row.id)}
                >
                  {t("actions.delete")}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
              onClick={addTaskRow}
            >
              {t("quickIntake.addTask")}
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title={t("quickIntake.section.documents")}
          description={t("quickIntake.documentsHelp")}
        >
          <div className="space-y-3">
            <div>
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
                onClick={() => documentPickerRef.current?.click()}
              >
                {t("documents.chooseFiles")}
              </button>
              <input
                ref={documentPickerRef}
                className="hidden"
                type="file"
                multiple
                accept=".pdf,.docx,.jpg,.jpeg,.png,.tif,.tiff,.webp,.bmp,.gif"
                onChange={(event) => addDocumentFiles(event.target.files)}
              />
            </div>
            {documents.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <Field
                    label={t("labels.documentTitle")}
                    value={row.title}
                    onChange={(value) =>
                      updateDocumentRow(row.id, { title: value })
                    }
                  />
                  <SelectField
                    label={t("documents.fileType")}
                    value={row.type}
                    onChange={(value) =>
                      updateDocumentRow(row.id, { type: value })
                    }
                    options={documentTypeOptions}
                  />
                  <p className="md:col-span-2 text-sm text-slate-600">
                    {row.file?.name ?? t("documents.noFileSelected")}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-sm text-red-600"
                  onClick={() => removeDocumentRow(row.id)}
                >
                  {t("actions.delete")}
                </button>
              </div>
            ))}
          </div>
        </SectionCard>

          </div>
        ) : null}

        <SectionCard
          title={t("quickIntake.reviewTitle")}
          description={t("quickIntake.reviewHelp")}
        >
          <div className="space-y-2 text-sm text-slate-700">
            <p>
              <strong>{t("quickIntake.requiredStatus")}:</strong>{" "}
              {hasRequiredReady
                ? t("quickIntake.requiredReady")
                : t("quickIntake.requiredMissing")}
            </p>
            <p>
              {t("quickIntake.optionalSummary", {
                courts: courts.filter((row) => row.courtName && row.courtLevel)
                  .length,
                parties: parties.filter((row) => row.name && row.role).length,
                assignments: assignments.filter((row) => row.userId).length,
                hearings: hearings.filter((row) => row.sessionDatetime).length,
                tasks: tasks.filter((row) => row.title).length,
                documents: documents.filter((row) => row.file).length
              })}
            </p>
          </div>

          <div className="mt-4">
            <FormExitActions
              cancelTo="/app/cases"
              cancelLabel={t("actions.cancel")}
              submitLabel={
                retryContext
                  ? t("quickIntake.retryFailedSections", "Retry failed steps")
                  : t("quickIntake.submitAll")
              }
              savingLabel={t("labels.saving")}
              submitting={submitting}
              disabled={!retryContext && !hasRequiredReady}
            />
          </div>

          {validationMessage ? (
            <div className="mt-3">
              <FormAlert message={validationMessage} />
            </div>
          ) : null}

          {submitSummary ? (
            <div className="mt-3 space-y-2">
              <FormAlert message={submitSummary.message} variant="info" />
              <button
                type="button"
                className="rounded-xl border border-accent px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/5"
                onClick={() => {
                  if (!submitSummary.caseId) return;
                  allowNextNavigation();
                  void navigate({
                    to: "/app/cases/$caseId",
                    params: { caseId: submitSummary.caseId }
                  });
                }}
              >
                {t("quickIntake.openCreatedCase")}
              </button>
            </div>
          ) : null}
        </SectionCard>
      </form>
    </div>
  );
}
