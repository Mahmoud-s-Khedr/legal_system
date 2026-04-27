import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  useUnsavedChanges,
  useUnsavedChangesBypass
} from "../../lib/useUnsavedChanges";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type DocumentDto,
  TaskPriority,
  TaskStatus,
  type CaseListResponseDto,
  type CreateTaskDto,
  type UserListResponseDto
} from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch, apiFormFetch } from "../../lib/api";
import { toCaseSelectOption } from "../../lib/caseOptions";
import { toIsoOrEmpty } from "../../lib/dateInput";
import { getEnumLabel } from "../../lib/enumLabel";
import { useMutationFeedback } from "../../lib/feedback";
import { useLookupOptions } from "../../lib/lookups";
import {
  runUploadQueue,
  type UploadQueueStatus
} from "../../lib/uploadQueue";
import {
  Field,
  FormAlert,
  FormExitActions,
  PageHeader,
  SectionCard,
  SelectField,
  TextAreaField
} from "./ui";

const ACCEPTED_TYPES = ".pdf,.docx,.jpg,.jpeg,.png,.tif,.tiff,.webp,.bmp,.gif";

type DraftDocument = {
  id: string;
  title: string;
  type: string;
  file: File;
};

type FileUploadState = {
  status: UploadQueueStatus;
  error?: string;
};

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function TaskCreatePage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { caseId?: string };
  const queryClient = useQueryClient();
  const feedback = useMutationFeedback();
  const { bypassRef, allowNextNavigation } = useUnsavedChangesBypass();

  const [form, setForm] = useState<CreateTaskDto>({
    caseId: search.caseId ?? "",
    title: "",
    description: "",
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    assignedToId: "",
    dueAt: ""
  });
  const [createdTask, setCreatedTask] = useState<{
    id: string;
    caseId: string | null;
  } | null>(null);
  const [documents, setDocuments] = useState<DraftDocument[]>([]);
  const [fileStates, setFileStates] = useState<Record<string, FileUploadState>>(
    {}
  );
  const [submitSummary, setSubmitSummary] = useState<string | null>(null);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const documentPickerRef = useRef<HTMLInputElement>(null);
  const docTypesQuery = useLookupOptions("DocumentType");

  useUnsavedChanges(
    Boolean(
      form.title.trim() ||
      form.description?.trim() ||
      form.caseId?.trim() ||
      form.assignedToId?.trim() ||
      form.dueAt?.trim() ||
      form.status !== TaskStatus.PENDING ||
      form.priority !== TaskPriority.MEDIUM ||
      documents.length > 0
    ),
    { bypassBlockRef: bypassRef }
  );

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
      { value: "", label: t("labels.generalTask") },
      ...(casesQuery.data?.items ?? []).map((caseItem) =>
        toCaseSelectOption(t, caseItem)
      )
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

  const statusOptions = useMemo(
    () =>
      Object.values(TaskStatus).map((value) => ({
        value,
        label: getEnumLabel(t, "TaskStatus", value)
      })),
    [t]
  );

  const documentTypeOptions = useMemo(
    () =>
      (docTypesQuery.data?.items ?? []).map((item) => ({
        value: item.key,
        label: getEnumLabel(t, "DocumentType", item.key)
      })),
    [docTypesQuery.data?.items, t]
  );
  if (!documentTypeOptions.length) {
    documentTypeOptions.push({
      value: "GENERAL",
      label: getEnumLabel(t, "DocumentType", "GENERAL")
    });
  }

  const hasFailedDocuments = documents.some(
    (doc) => fileStates[doc.id]?.status === "failed"
  );

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
    setFileStates((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }

  async function uploadDocuments(
    taskId: string,
    caseId: string | null,
    mode: "all" | "failed"
  ) {
    const targets =
      mode === "failed"
        ? documents.filter((doc) => fileStates[doc.id]?.status === "failed")
        : documents.filter((doc) => fileStates[doc.id]?.status !== "success");

    if (!targets.length) {
      return { successCount: 0, failedCount: 0 };
    }

    setIsUploadingDocuments(true);
    try {
      const summary = await runUploadQueue<DraftDocument, DocumentDto>({
        items: targets,
        concurrency: 3,
        upload: async (row) => {
          const formData = new FormData();
          formData.append("title", row.title.trim() || row.file.name);
          formData.append("type", row.type || "GENERAL");
          formData.append("taskId", taskId);
          if (caseId) {
            formData.append("caseId", caseId);
          }
          formData.append("file", row.file);

          return apiFormFetch<DocumentDto>("/api/documents", {
            method: "POST",
            body: formData
          });
        },
        onStatusChange: (index, status, uploadError) => {
          const target = targets[index];
          if (!target) return;
          setFileStates((prev) => ({
            ...prev,
            [target.id]: { status, error: uploadError }
          }));
        }
      });

      if (summary.successCount > 0) {
        await queryClient.invalidateQueries({
          queryKey: ["task-documents", taskId]
        });
      }

      return summary;
    } finally {
      setIsUploadingDocuments(false);
    }
  }

  const priorityOptions = useMemo(
    () =>
      Object.values(TaskPriority).map((value) => ({
        value,
        label: getEnumLabel(t, "TaskPriority", value)
      })),
    [t]
  );

  const updateField = useCallback(
    <K extends keyof CreateTaskDto>(key: K, value: CreateTaskDto[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
    },
    []
  );

  const createMutation = useMutation({
    mutationFn: (payload: CreateTaskDto) =>
      apiFetch<{ id: string; caseId: string | null }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          caseId: payload.caseId?.trim() ? payload.caseId : null,
          assignedToId: payload.assignedToId?.trim()
            ? payload.assignedToId
            : null,
          dueAt: toIsoOrEmpty(payload.dueAt) || null,
          description: payload.description?.trim() ? payload.description : null
        } satisfies CreateTaskDto)
      }),
    onSuccess: async (task) => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setCreatedTask({ id: task.id, caseId: task.caseId });
    }
  });

  const submitLabel = createdTask
    ? t("documents.retryFailed")
    : t("actions.createTask");

  const disableSubmit =
    Boolean(createdTask) && (!hasFailedDocuments || isUploadingDocuments);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("tasks.eyebrow")}
        title={t("tasks.createTitle")}
        description={t("tasks.createHelp")}
      />
      <SectionCard
        title={t("tasks.createTitle")}
        description={t("tasks.createHelp")}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void (async () => {
              setSubmitSummary(null);
              try {
                const task =
                  createdTask ?? (await createMutation.mutateAsync(form));
                if (!createdTask) {
                  setCreatedTask({ id: task.id, caseId: task.caseId });
                }

                const uploadSummary = await uploadDocuments(
                  task.id,
                  task.caseId,
                  createdTask ? "failed" : "all"
                );

                if (uploadSummary.failedCount > 0) {
                  setSubmitSummary(
                    t("quickIntake.savedWithIssues", {
                      sections: t("quickIntake.section.documents")
                    })
                  );
                  return;
                }

                feedback.success("messages.taskCreated");
                allowNextNavigation();
                void navigate({ to: "/app/tasks" });
              } catch (error) {
                setSubmitSummary((error as Error)?.message ?? t("errors.fallback"));
              }
            })();
          }}
        >
          <Field
            label={t("labels.taskTitle")}
            onChange={(value) => updateField("title", value)}
            required
            value={form.title}
          />
          <TextAreaField
            label={t("labels.description")}
            onChange={(value) => updateField("description", value)}
            value={form.description ?? ""}
          />
          <SelectField
            label={t("labels.case")}
            onChange={(value) => updateField("caseId", value)}
            options={caseOptions}
            value={form.caseId ?? ""}
          />
          <SelectField
            label={t("labels.assignedLawyer")}
            onChange={(value) => updateField("assignedToId", value)}
            options={assigneeOptions}
            value={form.assignedToId ?? ""}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label={t("labels.status")}
              onChange={(value) => updateField("status", value as TaskStatus)}
              options={statusOptions}
              value={form.status ?? TaskStatus.PENDING}
            />
            <SelectField
              label={t("labels.priority")}
              onChange={(value) => updateField("priority", value as TaskPriority)}
              options={priorityOptions}
              value={form.priority ?? TaskPriority.MEDIUM}
            />
          </div>
          <Field
            dir="ltr"
            label={t("labels.dueDate")}
            onChange={(value) => updateField("dueAt", value)}
            type="datetime-local"
            commitMode="blur"
            value={form.dueAt ?? ""}
          />

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold">{t("quickIntake.section.documents")}</p>
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
              accept={ACCEPTED_TYPES}
              onChange={(event) => addDocumentFiles(event.target.files)}
            />
            {documents.map((row) => {
              const state = fileStates[row.id];
              return (
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
                      {row.file.name}
                      {state ? (
                        <span className="ms-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs">
                          {state.status}
                        </span>
                      ) : null}
                    </p>
                    {state?.error ? (
                      <p className="md:col-span-2 text-xs text-red-600">
                        {state.error}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="text-sm text-red-600"
                    onClick={() => removeDocumentRow(row.id)}
                    disabled={isUploadingDocuments && state?.status === "uploading"}
                  >
                    {t("actions.delete")}
                  </button>
                </div>
              );
            })}
          </div>

          <FormExitActions
            cancelTo="/app/tasks"
            cancelLabel={t("actions.cancel")}
            submitLabel={submitLabel}
            savingLabel={t("labels.saving")}
            submitting={createMutation.isPending || isUploadingDocuments}
            disabled={disableSubmit || form.title.trim().length < 2}
          />
          {createMutation.error ? (
            <FormAlert message={(createMutation.error as Error).message} />
          ) : null}
          {submitSummary ? (
            <FormAlert
              message={submitSummary}
              variant={hasFailedDocuments ? "info" : "error"}
            />
          ) : null}
        </form>
      </SectionCard>
    </div>
  );
}
