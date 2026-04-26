import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  useUnsavedChanges,
  useUnsavedChangesBypass
} from "../../lib/useUnsavedChanges";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClientType,
  type DocumentDto,
  Language,
  type ClientListResponseDto,
  type CreateClientDto
} from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch, apiFormFetch } from "../../lib/api";
import { getEgyptGovernorateOptions } from "../../lib/egyptGovernorates";
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
  PrimaryButton,
  PageHeader,
  SectionCard,
  SelectField
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

type ClientFormState = Omit<CreateClientDto, "type"> & {
  type: ClientType | "";
};

function toNullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isIdentityType(type: ClientType | "") {
  return type === ClientType.INDIVIDUAL || type === ClientType.GOVERNMENT;
}

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizePayload(form: ClientFormState): CreateClientDto {
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
    poaNumber: toNullable(form.poaNumber),
    contacts: []
  };
}

export function ClientCreatePage() {
  const { t, i18n } = useTranslation("app");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const feedback = useMutationFeedback();
  const { bypassRef, allowNextNavigation } = useUnsavedChangesBypass();

  const clientTypeOptions = Object.values(ClientType).map((v) => ({
    value: v,
    label: getEnumLabel(t, "ClientType", v)
  }));
  const languageOptions = Object.values(Language).map((v) => ({
    value: v,
    label: getEnumLabel(t, "Language", v)
  }));
  const governorateOptions = getEgyptGovernorateOptions(
    i18n.resolvedLanguage ?? i18n.language ?? "en"
  );

  const [form, setForm] = useState<ClientFormState>({
    name: "",
    type: "",
    phone: "",
    email: "",
    governorate: "",
    preferredLanguage: Language.AR,
    nationalId: "",
    commercialRegister: "",
    taxNumber: "",
    poaNumber: "",
    contacts: []
  });
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null
  );
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DraftDocument[]>([]);
  const [fileStates, setFileStates] = useState<Record<string, FileUploadState>>(
    {}
  );
  const [submitSummary, setSubmitSummary] = useState<string | null>(null);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const documentPickerRef = useRef<HTMLInputElement>(null);
  const docTypesQuery = useLookupOptions("DocumentType");

  useUnsavedChanges(
    form.name !== "" || form.type !== "" || documents.length > 0,
    {
      bypassBlockRef: bypassRef
    }
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
    clientId: string,
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
          formData.append("clientId", clientId);
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
          queryKey: ["client-documents", clientId]
        });
      }

      return summary;
    } finally {
      setIsUploadingDocuments(false);
    }
  }

  const submitLabel = createdClientId
    ? t("documents.retryFailed")
    : t("actions.createClient");

  const disableSubmit =
    Boolean(createdClientId) && (!hasFailedDocuments || isUploadingDocuments);

  const dupCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dupCheckSeq = useRef(0);

  const checkDuplicate = useCallback(
    async (q: string, seq: number) => {
      if (!q.trim()) return;
      const result = await apiFetch<ClientListResponseDto>(
        `/api/clients?q=${encodeURIComponent(q.trim())}&limit=1`
      );
      if (seq !== dupCheckSeq.current) {
        return;
      }
      if (result.items.length > 0) {
        setDuplicateWarning(
          t("clients.duplicateWarning", { name: result.items[0].name })
        );
      } else {
        setDuplicateWarning(null);
      }
    },
    [t]
  );

  function scheduleCheck(q: string) {
    if (dupCheckTimer.current) clearTimeout(dupCheckTimer.current);
    setDuplicateWarning(null);
    dupCheckSeq.current += 1;
    const seq = dupCheckSeq.current;
    dupCheckTimer.current = setTimeout(() => {
      void checkDuplicate(q, seq);
    }, 500);
  }

  useEffect(() => {
    return () => {
      if (dupCheckTimer.current) {
        clearTimeout(dupCheckTimer.current);
      }
      dupCheckSeq.current += 1;
    };
  }, []);

  const createMutation = useMutation({
    mutationFn: (payload: CreateClientDto) =>
      apiFetch<{ id: string }>("/api/clients", {
        method: "POST",
        body: JSON.stringify(payload)
      })
  });

  function finishAndReturn() {
    allowNextNavigation();
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    void navigate({ to: "/app/clients" });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("clients.eyebrow")}
        title={t("clients.createTitle")}
        description={t("clients.createHelp")}
      />
      <SectionCard
        title={t("clients.createTitle")}
        description={t("clients.createHelp")}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void (async () => {
              if (!form.name.trim() || !form.type) {
                setValidationMessage(t("errors.requiredNameAndType"));
                return;
              }

              setValidationMessage(null);
              setSubmitSummary(null);

              try {
                const targetClientId =
                  createdClientId ??
                  (
                    await createMutation.mutateAsync(normalizePayload(form))
                  ).id;

                setCreatedClientId(targetClientId);
                await queryClient.invalidateQueries({ queryKey: ["clients"] });

                const uploadSummary = await uploadDocuments(
                  targetClientId,
                  createdClientId ? "failed" : "all"
                );

                if (uploadSummary.failedCount > 0) {
                  setSubmitSummary(
                    t("quickIntake.savedWithIssues", {
                      sections: t("quickIntake.section.documents")
                    })
                  );
                  return;
                }

                feedback.success("messages.clientCreated");
                allowNextNavigation();
                void navigate({
                  to: "/app/clients/$clientId",
                  params: { clientId: targetClientId }
                });
              } catch (error) {
                setValidationMessage(
                  (error as Error)?.message ?? t("errors.fallback")
                );
              }
            })();
          }}
        >
          <Field
            label={t("labels.name")}
            onChange={(value) => {
              setForm({ ...form, name: value });
              scheduleCheck(value);
            }}
            required
            value={form.name}
          />
          <SelectField
            label={t("labels.type")}
            onChange={(value) =>
              setForm({ ...form, type: value as ClientType | "" })
            }
            options={[
              { value: "", label: t("labels.selectType") },
              ...clientTypeOptions
            ]}
            required
            value={form.type}
          />
          {form.type ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  dir="ltr"
                  label={t("labels.email")}
                  onChange={(value) => {
                    setForm({ ...form, email: value });
                    scheduleCheck(value);
                  }}
                  type="email"
                  value={form.email ?? ""}
                />
                <Field
                  dir="ltr"
                  label={t("labels.phone")}
                  onChange={(value) => setForm({ ...form, phone: value })}
                  value={form.phone ?? ""}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  label={t("labels.governorate")}
                  onChange={(value) =>
                    setForm({ ...form, governorate: value })
                  }
                  options={[{ value: "", label: "-" }, ...governorateOptions]}
                  value={form.governorate ?? ""}
                />
                <SelectField
                  label={t("labels.language")}
                  onChange={(value) =>
                    setForm({ ...form, preferredLanguage: value as Language })
                  }
                  options={languageOptions}
                  value={form.preferredLanguage ?? Language.AR}
                />
              </div>
              {isIdentityType(form.type) ? (
                <Field
                  dir="ltr"
                  label={t("labels.nationalId")}
                  onChange={(value) => {
                    setForm({ ...form, nationalId: value });
                  }}
                  value={form.nationalId ?? ""}
                />
              ) : null}
              {form.type === ClientType.COMPANY ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    dir="ltr"
                    label={t("labels.commercialRegister")}
                    onChange={(value) =>
                      setForm({ ...form, commercialRegister: value })
                    }
                    value={form.commercialRegister ?? ""}
                  />
                  <Field
                    dir="ltr"
                    label={t("labels.taxNumber")}
                    onChange={(value) =>
                      setForm({ ...form, taxNumber: value })
                    }
                    value={form.taxNumber ?? ""}
                  />
                </div>
              ) : null}
              <Field
                dir="ltr"
                label={t("labels.poaNumber")}
                onChange={(value) => setForm({ ...form, poaNumber: value })}
                value={form.poaNumber ?? ""}
              />
            </>
          ) : null}

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

          {duplicateWarning ? (
            <div className="flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span>{duplicateWarning}</span>
              <button
                type="button"
                className="shrink-0 text-amber-500 hover:text-amber-700"
                onClick={() => setDuplicateWarning(null)}
                aria-label={t("actions.dismiss")}
              >
                ✕
              </button>
            </div>
          ) : null}
          <FormExitActions
            cancelTo="/app/clients"
            cancelLabel={t("actions.cancel")}
            submitLabel={submitLabel}
            savingLabel={t("labels.saving")}
            submitting={createMutation.isPending || isUploadingDocuments}
            disabled={disableSubmit}
          />
          {createdClientId && hasFailedDocuments ? (
            <div className="flex justify-end">
              <PrimaryButton type="button" onClick={finishAndReturn}>
                {t("actions.back")}
              </PrimaryButton>
            </div>
          ) : null}
          {validationMessage ? <FormAlert message={validationMessage} /> : null}
          {createMutation.error ? (
            <FormAlert message={(createMutation.error as Error).message} />
          ) : null}
          {submitSummary ? (
            <div className="space-y-2">
              <FormAlert message={submitSummary} variant="info" />
              {createdClientId ? (
                <button
                  type="button"
                  className="rounded-xl border border-accent px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/5"
                  onClick={() => {
                    void navigate({
                      to: "/app/clients/$clientId",
                      params: { clientId: createdClientId }
                    });
                  }}
                >
                  {t("quickIntake.openCreatedCase")}
                </button>
              ) : null}
            </div>
          ) : null}
        </form>
      </SectionCard>
    </div>
  );
}
