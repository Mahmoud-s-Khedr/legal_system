import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { SidebarNavSection } from "./navConfig";

const BASE_ITEM_CLASS =
  "flex min-h-11 items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors duration-fast focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sidebar-item-active)]";
const INACTIVE_ITEM_CLASS =
  "text-[var(--sidebar-item-text)] hover:bg-[var(--sidebar-item-hover)] hover:text-slate-900";
const ACTIVE_ITEM_CLASS =
  "bg-[var(--sidebar-item-active)] text-white shadow-sm";

export function isArabicLanguage(language: string): boolean {
  return language.toLowerCase().startsWith("ar");
}

export function getSidebarHeadingClassName(language: string): string {
  const typography = isArabicLanguage(language)
    ? "text-xs tracking-normal"
    : "text-[11px] uppercase tracking-[0.18em]";
  return `mb-1 px-4 font-semibold text-[var(--sidebar-heading)] ${typography}`;
}

export function getSidebarItemClassName(active: boolean): string {
  return `${BASE_ITEM_CLASS} ${active ? ACTIVE_ITEM_CLASS : INACTIVE_ITEM_CLASS}`;
}

function SidebarNavLink({
  to,
  label,
  icon: Icon,
  onClick
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
}) {
  return (
    <Link
      activeProps={{
        className: getSidebarItemClassName(true),
        "aria-current": "page"
      }}
      className={getSidebarItemClassName(false)}
      to={to}
      onClick={onClick}
    >
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

export function SidebarNav({
  ariaLabel,
  sections,
  language,
  emptyLabel,
  onItemClick
}: {
  ariaLabel: string;
  sections: SidebarNavSection[];
  language: string;
  emptyLabel: string;
  onItemClick?: () => void;
}) {
  if (sections.length === 0) {
    return (
      <nav aria-label={ariaLabel}>
        <p className="rounded-2xl bg-[var(--sidebar-item-hover)] px-4 py-3 text-sm text-[var(--sidebar-item-text)]">
          {emptyLabel}
        </p>
      </nav>
    );
  }

  return (
    <nav aria-label={ariaLabel} className="space-y-5">
      {sections.map((section) => (
        <section
          key={section.id}
          className="space-y-1.5"
          aria-label={section.label}
        >
          {section.label && (
            <p
              data-testid={`sidebar-heading-${section.id}`}
              className={getSidebarHeadingClassName(language)}
            >
              {section.label}
            </p>
          )}
          <div className="space-y-1">
            {section.items.map((item) => (
              <SidebarNavLink
                key={item.to}
                icon={item.icon}
                label={item.label}
                to={item.to}
                onClick={onItemClick}
              />
            ))}
          </div>
        </section>
      ))}
    </nav>
  );
}
