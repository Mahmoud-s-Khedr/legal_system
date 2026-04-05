import { Link } from "@tanstack/react-router";

export interface ShellFooterLink {
  id: string;
  label: string;
  to: string;
}

export function ShellFooter({
  ariaLabel,
  links
}: {
  ariaLabel: string;
  links: ShellFooterLink[];
}) {
  return (
    <footer className="border-t border-slate-200 bg-white/90 py-4">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 lg:px-6">
        <span className="text-xs font-semibold text-slate-500">{ariaLabel}</span>
        <nav className="flex flex-wrap items-center gap-2" aria-label={ariaLabel}>
          {links.map((link) => (
            <Link
              key={link.id}
              to={link.to}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-accent hover:text-accent"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
