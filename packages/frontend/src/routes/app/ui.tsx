import type { PropsWithChildren, ReactNode } from "react";
import i18n from "../../i18n";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between animate-fade-in">
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-sm uppercase tracking-[0.3em] rtl:tracking-normal text-slate-500">{eyebrow}</p>
        ) : null}
        <h1 className="font-heading text-3xl">{title}</h1>
        <p className="max-w-3xl text-sm text-slate-600">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children
}: PropsWithChildren<{ title: string; description?: string }>) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5 animate-slide-up">
      <div className="mb-4">
        <h2 className="font-heading text-lg">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-3 font-heading text-4xl">{value}</p>
    </section>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-2">{description}</p>
    </div>
  );
}

export type BadgeVariant = "green" | "blue" | "amber" | "red" | "gray" | "purple" | "default";

const BADGE_CLASSES: Record<BadgeVariant, string> = {
  green: "bg-emerald-100 text-emerald-800",
  blue: "bg-sky-100 text-sky-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  gray: "bg-slate-100 text-slate-700",
  purple: "bg-violet-100 text-violet-800",
  default: "bg-accentSoft text-emerald-900"
};

export function Badge({ children, variant = "default" }: PropsWithChildren<{ variant?: BadgeVariant }>) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${BADGE_CLASSES[variant]}`}>
      {children}
    </span>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  dir,
  required
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  dir?: "ltr" | "rtl" | "auto";
  required?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold">
        {label}
        {required && <span className="text-red-500 ms-1" aria-hidden="true">*</span>}
      </span>
      <input
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 transition focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
        dir={dir}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  dir,
  required
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  dir?: "ltr" | "rtl" | "auto";
  required?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold">
        {label}
        {required && <span className="text-red-500 ms-1" aria-hidden="true">*</span>}
      </span>
      <select
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 transition focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
        dir={dir}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  dir,
  required
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dir?: "ltr" | "rtl" | "auto";
  required?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold">
        {label}
        {required && <span className="text-red-500 ms-1" aria-hidden="true">*</span>}
      </span>
      <textarea
        className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 transition focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
        dir={dir}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

export function PrimaryButton({
  children,
  type = "button",
  disabled = false,
  onClick
}: PropsWithChildren<{ type?: "button" | "submit"; disabled?: boolean; onClick?: () => void }>) {
  return (
    <button
      className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={disabled}
      type={type}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  const lang = i18n.resolvedLanguage ?? "ar";
  const locale = lang === "ar" ? "ar-EG" : lang;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return `ج.م ${value}`;
}
