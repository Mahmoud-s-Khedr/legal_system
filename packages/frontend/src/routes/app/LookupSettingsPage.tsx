import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHeader } from "./ui";

const LOOKUP_ENTITIES = [
  "CaseType",
  "CourtLevel",
  "PartyRole",
  "DocumentType",
  "PaymentMethod",
  "FeeType",
  "ExpenseCategory",
  "LibraryDocType"
] as const;

export function LookupSettingsPage() {
  const { t } = useTranslation("app");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("settings.eyebrow")}
        title={t("lookups.title")}
        description={t("lookups.description")}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {LOOKUP_ENTITIES.map((entity) => (
          <Link
            className="block rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-accent hover:shadow-card"
            key={entity}
            to="/app/settings/lookups/$entity"
            params={{ entity }}
          >
            <p className="font-semibold">{t(`lookups.entities.${entity}`, entity)}</p>
            <p className="mt-1 text-xs text-slate-500">{t(`lookups.descriptions.${entity}`, "")}</p>
            <p className="mt-2 text-sm text-slate-400">{t("lookups.manageValues")}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
