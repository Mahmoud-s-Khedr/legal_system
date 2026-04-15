import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Search, X, Briefcase, Users, Plus, FileText } from "lucide-react";
import type {
  CaseListResponseDto,
  ClientListResponseDto,
  DocumentSearchResponseDto
} from "@elms/shared";
import { apiFetch } from "../../lib/api";
import { useAccessibleOverlay } from "../shared/useAccessibleOverlay";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  snippet?: string;
  badge?: string;
  score: number;
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
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  if (open && !wasOpenRef.current) {
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    wasOpenRef.current = true;
  } else if (!open && wasOpenRef.current) {
    wasOpenRef.current = false;
  }

  useAccessibleOverlay({
    open,
    mode: "modal",
    contentRef: panelRef,
    triggerRef: restoreFocusRef,
    onClose
  });

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

  const documentsQuery = useQuery({
    queryKey: ["palette-documents", debouncedQ],
    queryFn: () =>
      apiFetch<DocumentSearchResponseDto>(
        `/api/search/documents?q=${encodeURIComponent(debouncedQ)}&pageSize=5`
      ),
    enabled: open && debouncedQ.trim().length > 0
  });

  const quickActions: PaletteItem[] = useMemo(() => [
    {
      id: "go-dashboard",
      label: t("search.escape.dashboard"),
      score: 0,
      icon: <Plus className="h-4 w-4" />,
      action: () => { void navigate({ to: "/app/dashboard" }); onClose(); }
    },
    {
      id: "go-cases",
      label: t("search.escape.cases"),
      score: 0,
      icon: <Plus className="h-4 w-4" />,
      action: () => { void navigate({ to: "/app/cases" }); onClose(); }
    },
    {
      id: "go-clients",
      label: t("search.escape.clients"),
      score: 0,
      icon: <Plus className="h-4 w-4" />,
      action: () => { void navigate({ to: "/app/clients" }); onClose(); }
    },
    {
      id: "go-search",
      label: t("search.escape.search"),
      score: 0,
      icon: <Plus className="h-4 w-4" />,
      action: () => { void navigate({ to: "/app/search" }); onClose(); }
    },
    {
      id: "go-settings",
      label: t("search.escape.settings"),
      score: 0,
      icon: <Plus className="h-4 w-4" />,
      action: () => { void navigate({ to: "/app/settings" }); onClose(); }
    },
    {
      id: "quick-intake",
      label: t("actions.quickIntake"),
      score: 0,
      icon: <Plus className="h-4 w-4" />,
      action: () => { void navigate({ to: "/app/cases/quick-new" }); onClose(); }
    },
    {
      id: "new-case",
      label: t("actions.newCase"),
      score: 0,
      icon: <Plus className="h-4 w-4" />,
      action: () => { void navigate({ to: "/app/cases/new" }); onClose(); }
    },
    {
      id: "new-hearing",
      label: t("actions.newHearing"),
      score: 0,
      icon: <Plus className="h-4 w-4" />,
      action: () => { void navigate({ to: "/app/hearings/new" }); onClose(); }
    },
    {
      id: "new-task",
      label: t("actions.newTask"),
      score: 0,
      icon: <Plus className="h-4 w-4" />,
      action: () => { void navigate({ to: "/app/tasks/new" }); onClose(); }
    },
    {
      id: "new-invoice",
      label: t("actions.newInvoice"),
      score: 0,
      icon: <Plus className="h-4 w-4" />,
      action: () => { void navigate({ to: "/app/invoices/new" }); onClose(); }
    }
  ], [t, navigate, onClose]);

  const searchResults: PaletteItem[] = useMemo(() => {
    if (!debouncedQ.trim()) return [];
    const normalizedQuery = debouncedQ.trim().toLowerCase();
    const entityScore = (label: string) => {
      const normalizedLabel = label.toLowerCase();
      if (normalizedLabel.startsWith(normalizedQuery)) {
        return 2.5;
      }
      if (normalizedLabel.includes(normalizedQuery)) {
        return 2;
      }
      return 1;
    };

    const documentItems = (documentsQuery.data?.items ?? []).map((document) => ({
      id: `document-${document.id}`,
      label: document.title,
      description: t("search.resultTypes.document"),
      snippet: stripHeadlineMarkup(document.headline),
      badge: document.type,
      score: document.rank + 10,
      icon: <FileText className="h-4 w-4 text-slate-400" />,
      action: () => {
        void navigate({
          to: "/app/search",
          search: { q: debouncedQ.trim() }
        });
        onClose();
      }
    }));
    const caseItems = (casesQuery.data?.items ?? []).map((c) => ({
      id: `case-${c.id}`,
      label: c.title,
      description: t("nav.cases"),
      score: entityScore(c.title),
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
      score: entityScore(c.name),
      icon: <Users className="h-4 w-4 text-slate-400" />,
      action: () => {
        void navigate({ to: "/app/clients/$clientId", params: { clientId: c.id } });
        onClose();
      }
    }));
    return [...documentItems, ...caseItems, ...clientItems].sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.label.localeCompare(b.label);
    });
  }, [
    debouncedQ,
    casesQuery.data,
    clientsQuery.data,
    documentsQuery.data,
    t,
    navigate,
    onClose
  ]);

  const items = debouncedQ.trim() ? searchResults : quickActions;

  const itemsSignature = items.map((item) => item.id).join("|");

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQ, itemsSignature, q]);

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

  const isLoading =
    debouncedQ.trim() &&
    (casesQuery.isFetching || clientsQuery.isFetching || documentsQuery.isFetching);

  return (
    <div
      aria-modal="true"
      aria-labelledby="command-palette-title"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
      onClick={onClose}
      role="dialog"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2 id="command-palette-title" className="sr-only">
          {t("search.placeholder")}
        </h2>
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
                className={`flex w-full items-start gap-3 px-4 py-2.5 text-start text-sm transition ${idx === activeIndex ? "bg-accent text-white" : "hover:bg-slate-50"}`}
                onClick={item.action}
                onMouseEnter={() => setActiveIndex(idx)}
                type="button"
              >
                <span className={`mt-0.5 ${idx === activeIndex ? "text-white" : ""}`}>{item.icon}</span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate font-medium">{item.label}</span>
                  {item.snippet && (
                    <span className={`mt-0.5 block truncate text-xs ${idx === activeIndex ? "text-white/80" : "text-slate-500"}`}>
                      {item.snippet}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {item.badge && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${idx === activeIndex ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                      {item.badge}
                    </span>
                  )}
                  {item.description && (
                    <span className={`text-xs ${idx === activeIndex ? "text-white/70" : "text-slate-400"}`}>
                      {item.description}
                    </span>
                  )}
                </span>
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
            onClick={(e) => {
              e.preventDefault();
              void navigate({ to: "/app/search", search: { q: debouncedQ.trim() } });
              onClose();
            }}
          >
            {t("search.advancedSearch", "Advanced search")} →
          </a>
        </div>
      </div>
    </div>
  );
}

function stripHeadlineMarkup(value: string) {
  return value.replace(/<\/?mark>/gi, "").replace(/\s+/g, " ").trim();
}
