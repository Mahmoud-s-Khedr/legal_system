import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { DocumentDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFormFetch } from "../../lib/api";
import { useLookupOptions } from "../../lib/lookups";
import { Field, PrimaryButton, SelectField } from "../../routes/app/ui";
import { getEnumLabel } from "../../lib/enumLabel";

const ACCEPTED_TYPES = ".pdf,.docx,.jpg,.jpeg,.png,.tif,.tiff";

interface DocumentUploadFormProps {
  caseId?: string;
  clientId?: string;
  onSuccess: () => void;
  invalidateKey: string[];
}

export function DocumentUploadForm({ caseId, clientId, onSuccess, invalidateKey }: DocumentUploadFormProps) {
  const { t } = useTranslation("app");
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const docTypesQuery = useLookupOptions("DocumentType");
  const [type, setType] = useState<string>("GENERAL");
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error(t("documents.noFileSelected"));

      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title || file.name);
      formData.append("type", type);
      if (caseId) formData.append("caseId", caseId);
      if (clientId) formData.append("clientId", clientId);

      return apiFormFetch<DocumentDto>("/api/documents", { method: "POST", body: formData });
    },
    onSuccess: async () => {
      setTitle("");
      setType("GENERAL");
      setError(null);
      setSelectedFileName("");
      if (fileRef.current) fileRef.current.value = "";
      await queryClient.invalidateQueries({ queryKey: invalidateKey });
      onSuccess();
    },
    onError: (err: Error) => setError(err.message)
  });

  const typeOptions = (docTypesQuery.data?.items ?? []).map((o) => ({
    value: o.key,
    label: getEnumLabel(t, "DocumentType", o.key)
  }));
  if (!typeOptions.length) {
    typeOptions.push({ value: "GENERAL", label: getEnumLabel(t, "DocumentType", "GENERAL") });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void uploadMutation.mutateAsync();
      }}
    >
      <div className="space-y-2">
        <p className="text-sm font-semibold">
          {t("documents.fileTitle")}<span className="text-red-500 ms-1" aria-hidden="true">*</span>
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            {t("documents.chooseFile")}
          </button>
          <span className="text-sm text-slate-500">
            {selectedFileName || t("documents.noFileSelected")}
          </span>
        </div>
        <input
          accept={ACCEPTED_TYPES}
          className="hidden"
          ref={fileRef}
          required
          type="file"
          onChange={(e) => setSelectedFileName(e.target.files?.[0]?.name ?? "")}
        />
      </div>
      <Field
        label={t("labels.title")}
        onChange={setTitle}
        placeholder={t("documents.fileTitle")}
        value={title}
      />
      <SelectField
        label={t("documents.fileType")}
        onChange={setType}
        options={typeOptions}
        value={type}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <PrimaryButton type="submit">
        {uploadMutation.isPending ? "..." : t("actions.uploadDocument")}
      </PrimaryButton>
    </form>
  );
}
