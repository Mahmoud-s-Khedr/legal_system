import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Search, X, Briefcase, Users, Plus } from "lucide-react";
import type { CaseListResponseDto, ClientListResponseDto } from "@elms/shared";
import { apiFetch } from "../../lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
}

export function CommandPalette({ open, onClose }: Props) {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 200);
    return () => clearTimeout(timer);
  }, [q]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQ("");
      setDebouncedQ("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const casesQuery = useQuery({
    queryKey: ["palette-cases", debouncedQ],
    queryFn: () =>
      apiFetch<CaseListResponseDto>(`/api/cases?q=${encodeURIComponent(debouncedQ)}&limit=5`),
    enabled: open && debouncedQ.trim().length > 0
  });

  const clientsQuery = useQuery({
    queryKey: ["palette-clients", debouncedQ],
    queryFn: () =>
      apiFetch<ClientListResponseDto>(`/api/clients?q=${encodeURIComponent(debouncedQ)}&limit=5`),
    enabled: open && debouncedQ.trim().length > 0
  });

  const quickActions: PaletteItem[] = useMemo(() => [
    {
      id: "quick-intake",
      label: t("actions.quickIntake"),
      icon: <Plus className="h-4 w-4" />,
      action: () => { void navigate({ to: "/app/cases/quick-new" }); onClose(); }
    },
    {
      id: "new-case",
      label: t("actions.newCase"),
      icon: <Plus className="h-4 w-4" />,
      action: () => { void navigate({ to: "/app/cases/new" }); onClose(); }
    },
    {
      id: "new-hearing",
      label: t("actions.newHearing"),
      icon: <Plus className="h-4 w-4" />,
      action: () => { void navigate({ to: "/app/hearings/new" }); onClose(); }
    },
    {
      id: "new-task",
      label: t("actions.newTask"),
      icon: <Plus className="h-4 w-4" />,
      action: () => { void navigate({ to: "/app/tasks/new" }); onClose(); }
    },
    {
      id: "new-invoice",
      label: t("actions.newInvoice"),
      icon: <Plus className="h-4 w-4" />,
      action: () => { void navigate({ to: "/app/invoices/new" }); onClose(); }
    }
  ], [t, navigate, onClose]);

  const searchResults: PaletteItem[] = useMemo(() => {
    if (!debouncedQ.trim()) return [];
    const caseItems = (casesQuery.data?.items ?? []).map((c) => ({
      id: `case-${c.id}`,
      label: c.title,
      description: t("nav.cases"),
      icon: <Briefcase className="h-4 w-4 text-slate-400" />,
      action: () => {
        void navigate({ to: "/app/cases/$caseId", params: { caseId: c.id } });
        onClose();
      }
    }));
    const clientItems = (clientsQuery.data?.items ?? []).map((c) => ({
      id: `client-${c.id}`,
      label: c.name,
      description: t("nav.clients"),
      icon: <Users className="h-4 w-4 text-slate-400" />,
      action: () => {
        void navigate({ to: "/app/clients/$clientId", params: { clientId: c.id } });
        onClose();
      }
    }));
    return [...caseItems, ...clientItems];
  }, [debouncedQ, casesQuery.data, clientsQuery.data, t, navigate, onClose]);

  const items = debouncedQ.trim() ? searchResults : quickActions;

  useEffect(() => {
    setActiveIndex(0);
  }, [items.length]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" && items[activeIndex]) {
      items[activeIndex].action();
    }
  }

  if (!open) return null;

  const isLoading = debouncedQ.trim() && (casesQuery.isFetching || clientsQuery.isFetching);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            aria-label={t("search.placeholder")}
            className="flex-1 bg-transparent text-sm focus:outline-none"
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search.commandPlaceholder", "Search or type a command…")}
            type="search"
            value={q}
          />
          {isLoading && <span className="text-xs text-slate-400">{t("labels.loading")}</span>}
          <button
            aria-label={t("actions.close")}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <ul className="max-h-80 overflow-y-auto py-2" role="listbox">
          {!debouncedQ.trim() && (
            <li className="px-4 pb-1 text-xs font-medium text-slate-400">{t("search.quickActions", "Quick actions")}</li>
          )}
          {debouncedQ.trim() && !isLoading && !searchResults.length && (
            <li className="px-4 py-3 text-sm text-slate-500">{t("search.noResults")}</li>
          )}
          {items.map((item, idx) => (
            <li key={item.id} role="option" aria-selected={idx === activeIndex}>
              <button
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm transition ${idx === activeIndex ? "bg-accent text-white" : "hover:bg-slate-50"}`}
                onClick={item.action}
                onMouseEnter={() => setActiveIndex(idx)}
                type="button"
              >
                <span className={idx === activeIndex ? "text-white" : ""}>{item.icon}</span>
                <span className="flex-1 font-medium">{item.label}</span>
                {item.description && (
                  <span className={`text-xs ${idx === activeIndex ? "text-white/70" : "text-slate-400"}`}>
                    {item.description}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
          <span>↑↓ {t("search.navigate", "navigate")} · Enter {t("search.select", "select")} · Esc {t("search.dismiss", "dismiss")}</span>
          <a
            className="hover:text-accent"
            href="/app/search"
            onClick={(e) => { e.preventDefault(); void navigate({ to: "/app/search" }); onClose(); }}
          >
            {t("search.advancedSearch", "Advanced search")} →
          </a>
        </div>
      </div>
    </div>
  );
}
