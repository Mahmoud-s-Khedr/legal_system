import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHeader, SectionCard } from "./ui";
import { DocumentUploadForm } from "../../components/documents/DocumentUploadForm";

export function DocumentUploadPage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("documents.eyebrow")}
        title={t("documents.uploadTitle")}
        description={t("documents.uploadHelp")}
      />
      <SectionCard title={t("documents.uploadTitle")} description={t("documents.uploadHelp")}>
        <DocumentUploadForm
          invalidateKey={["documents"]}
          onSuccess={() => void navigate({ to: "/app/documents" })}
        />
      </SectionCard>
    </div>
  );
}
