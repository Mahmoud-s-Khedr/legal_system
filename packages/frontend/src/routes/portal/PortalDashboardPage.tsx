import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Briefcase, FileText, Calendar } from "lucide-react";
import { EmptyState, PageHeader, SectionCard, StatCard, ErrorState, formatCurrency, formatDate } from "../app/ui";

interface PortalCase {
  id: string;
  title: string;
  caseNumber: string;
  status: string;
  nextHearing: string | null;
}

interface PortalInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  dueDate: string | null;
}

async function portalFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("request_failed");
  return res.json() as Promise<T>;
}

export function PortalDashboardPage() {
  const { t } = useTranslation("app");

  const casesQuery = useQuery({
    queryKey: ["portal-cases"],
    queryFn: () => portalFetch<PortalCase[]>("/api/portal/cases")
  });

  const invoicesQuery = useQuery({
    queryKey: ["portal-invoices"],
    queryFn: () => portalFetch<PortalInvoice[]>("/api/portal/invoices")
  });

  const cases = casesQuery.data ?? [];
  const invoices = invoicesQuery.data ?? [];
  const overdueInvoices = invoices.filter((inv) => inv.status === "ISSUED" && inv.dueDate && new Date(inv.dueDate) < new Date());
  const pageError = (casesQuery.error as Error | null) ?? (invoicesQuery.error as Error | null);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("portal.dashboard")}
        description={t("portal.dashboardDescription")}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="relative">
          <div className="absolute end-4 top-4 rounded-xl bg-blue-50 p-2 text-blue-600">
            <Briefcase className="size-4" />
          </div>
          <StatCard label={t("portal.activeCases")} value={cases.length} />
        </div>
        <div className="relative">
          <div className="absolute end-4 top-4 rounded-xl bg-amber-50 p-2 text-amber-600">
            <FileText className="size-4" />
          </div>
          <StatCard label={t("portal.invoices")} value={invoices.length} />
        </div>
        <div className="relative">
          <div className="absolute end-4 top-4 rounded-xl bg-red-100 p-2 text-red-600">
            <FileText className="size-4" />
          </div>
          <StatCard label={t("portal.overdueInvoices")} value={overdueInvoices.length} />
        </div>
      </div>

      {/* Cases */}
      <SectionCard title={t("portal.myCases")}>
        {casesQuery.isError ? (
          <ErrorState
            title={t("errors.title")}
            description={pageError?.message === "request_failed" ? t("errors.fallback") : (pageError?.message ?? t("errors.fallback"))}
            retryLabel={t("errors.reload")}
            onRetry={() => void casesQuery.refetch()}
          />
        ) : !cases.length ? (
          <EmptyState title={t("empty.noCases")} description={t("empty.noCasesHelp")} />
        ) : (
          <div className="space-y-2">
            {cases.map((c) => (
              <Link
                key={c.id}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:border-accent"
                to="/portal/cases/$caseId"
                params={{ caseId: c.id }}
              >
                <div className="flex-1">
                  <p className="font-semibold">{c.title}</p>
                  <p className="text-sm text-slate-500">{c.caseNumber} · {c.status}</p>
                </div>
                {c.nextHearing && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-400">
                    <Calendar className="size-4" />
                    {formatDate(c.nextHearing)}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Invoices */}
      <SectionCard title={t("portal.invoices")}>
        {invoicesQuery.isError ? (
          <ErrorState
            title={t("errors.title")}
            description={pageError?.message === "request_failed" ? t("errors.fallback") : (pageError?.message ?? t("errors.fallback"))}
            retryLabel={t("errors.reload")}
            onRetry={() => void invoicesQuery.refetch()}
          />
        ) : !invoices.length ? (
          <EmptyState title={t("empty.noInvoices")} description={t("empty.noInvoicesHelp")} />
        ) : (
          <div className="space-y-2">
            {invoices.slice(0, 5).map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex-1">
                  <p className="font-semibold">{inv.invoiceNumber}</p>
                  <p className="text-sm text-slate-500">
                    {inv.status}
                    {inv.dueDate && ` · ${t("portal.due")} ${formatDate(inv.dueDate)}`}
                  </p>
                </div>
                <p className="font-semibold">{formatCurrency(inv.totalAmount)}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
