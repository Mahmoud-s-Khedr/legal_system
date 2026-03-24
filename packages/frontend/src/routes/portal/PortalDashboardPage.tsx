import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Briefcase, FileText, Calendar } from "lucide-react";
import { SectionCard } from "../app/ui";

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
  if (!res.ok) throw new Error("Request failed");
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{t("portal.dashboard")}</h1>
        <p className="mt-1 text-slate-500">{t("portal.dashboardDescription")}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50">
            <Briefcase className="size-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{cases.length}</p>
            <p className="text-sm text-slate-500">{t("portal.activeCases")}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-50">
            <FileText className="size-5 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{invoices.length}</p>
            <p className="text-sm text-slate-500">{t("portal.invoices")}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-red-100 bg-red-50 px-5 py-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-red-100">
            <FileText className="size-5 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{overdueInvoices.length}</p>
            <p className="text-sm text-red-500">{t("portal.overdueInvoices")}</p>
          </div>
        </div>
      </div>

      {/* Cases */}
      <SectionCard title={t("portal.myCases")}>
        {!cases.length ? (
          <p className="text-sm text-slate-400">{t("empty.noCases")}</p>
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
                    {new Date(c.nextHearing).toLocaleDateString()}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Invoices */}
      <SectionCard title={t("portal.invoices")}>
        {!invoices.length ? (
          <p className="text-sm text-slate-400">{t("empty.noInvoices")}</p>
        ) : (
          <div className="space-y-2">
            {invoices.slice(0, 5).map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex-1">
                  <p className="font-semibold">{inv.invoiceNumber}</p>
                  <p className="text-sm text-slate-500">{inv.status}{inv.dueDate && ` · ${t("portal.due")} ${new Date(inv.dueDate).toLocaleDateString()}`}</p>
                </div>
                <p className="font-semibold">{inv.totalAmount.toLocaleString()} EGP</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
