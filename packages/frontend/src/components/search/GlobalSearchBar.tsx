import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";

interface Props {
  onOpenPalette: () => void;
}

export function GlobalSearchBar({ onOpenPalette }: Props) {
  const { t } = useTranslation("app");
  const isMacPlatform =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
  const shortcutLabel = isMacPlatform ? "⌘K" : "Ctrl+K";

  return (
    <button
      aria-keyshortcuts="Control+K Meta+K"
      aria-label={t("search.placeholder")}
      className="flex w-48 lg:w-56 xl:w-64 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 transition hover:border-accent hover:bg-white"
      onClick={onOpenPalette}
      type="button"
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-start">{t("search.placeholder")}</span>
      <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 text-xs text-slate-400 sm:inline">
        {shortcutLabel}
      </kbd>
    </button>
  );
}
