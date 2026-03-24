import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function GlobalSearchBar() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    void navigate({ to: "/app/search", search: { q: trimmed } });
  };

  return (
    <form className="flex items-center gap-2" onSubmit={handleSubmit} role="search">
      <label htmlFor="global-search" className="sr-only">{t("search.placeholder")}</label>
      <input
        id="global-search"
        className="w-56 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("search.placeholder")}
        type="search"
        value={q}
        aria-label={t("search.placeholder")}
      />
    </form>
  );
}
