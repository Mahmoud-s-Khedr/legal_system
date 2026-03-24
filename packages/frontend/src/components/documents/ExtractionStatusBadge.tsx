import { ExtractionStatus } from "@elms/shared";
import { useTranslation } from "react-i18next";

const STATUS_COLORS: Record<ExtractionStatus, string> = {
  [ExtractionStatus.PENDING]: "bg-slate-100 text-slate-700",
  [ExtractionStatus.PROCESSING]: "bg-yellow-100 text-yellow-800",
  [ExtractionStatus.INDEXED]: "bg-emerald-100 text-emerald-800",
  [ExtractionStatus.FAILED]: "bg-red-100 text-red-800"
};

const STATUS_KEY: Record<ExtractionStatus, string> = {
  [ExtractionStatus.PENDING]: "documents.extractionPending",
  [ExtractionStatus.PROCESSING]: "documents.extractionProcessing",
  [ExtractionStatus.INDEXED]: "documents.extractionIndexed",
  [ExtractionStatus.FAILED]: "documents.extractionFailed"
};

export function ExtractionStatusBadge({ status }: { status: ExtractionStatus }) {
  const { t } = useTranslation("app");
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700"}`}
    >
      {t(STATUS_KEY[status] ?? "documents.extractionPending")}
    </span>
  );
}
