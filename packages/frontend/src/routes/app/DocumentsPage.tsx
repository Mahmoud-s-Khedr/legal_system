import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHeader, SectionCard, SelectField } from "./ui";
import { DocumentList } from "../../components/documents/DocumentList";
import { getEnumLabel } from "../../lib/enumLabel";
import { useLookupOptions } from "../../lib/lookups";

export function DocumentsPage() {
  const { t } = useTranslation("app");
  const [typeFilter, setTypeFilter] = useState("");
  const docTypesQuery = useLookupOptions("DocumentType");

  const queryKey = ["documents", typeFilter];

  const typeOptions = [
    { value: "", label: t("labels.all") },
    ...(docTypesQuery.data?.items ?? []).map((o) => ({
      value: o.key,
      label: getEnumLabel(t, "DocumentType", o.key)
    }))
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Link
            className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white"
            to="/app/documents/new"
          >
            {t("actions.uploadNew")}
          </Link>
        }
        description={t("documents.description")}
        eyebrow={t("documents.eyebrow")}
        title={t("documents.title")}
      />
      <SectionCard description={t("documents.listHelp")} title={t("documents.list")}>
        <div className="mb-4 max-w-xs">
          <SelectField
            label={t("documents.fileType")}
            onChange={setTypeFilter}
            options={typeOptions}
            value={typeFilter}
          />
        </div>
        <DocumentList queryKey={queryKey} />
      </SectionCard>
    </div>
  );
}
