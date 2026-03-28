import { useEffect, useId, useState, type PropsWithChildren, type ReactNode } from "react";
import { DatePicker, Select } from "antd";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n";
import {
  DATE_PICKER_DATETIME_FORMAT,
  DATE_PICKER_DATE_FORMAT,
  fromDatePickerValue,
  toDatePickerValue
} from "../../lib/dateInput";

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

export function TableWrapper({ children }: PropsWithChildren) {
  return <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">{children}</div>;
}

export function DataTable({ children }: PropsWithChildren) {
  return <table className="min-w-full text-sm">{children}</table>;
}

export function TableHead({ children }: PropsWithChildren) {
  return <thead className="bg-slate-50 text-slate-600">{children}</thead>;
}

export function TableHeadCell({
  children,
  align = "start"
}: PropsWithChildren<{ align?: "start" | "end" | "center" }>) {
  const alignClass = align === "end" ? "text-end" : align === "center" ? "text-center" : "text-start";
  return <th className={`px-4 py-3 font-semibold ${alignClass}`}>{children}</th>;
}

export function SortableTableHeadCell({
  label,
  sortKey,
  sortBy,
  sortDir,
  onSort,
  align = "start"
}: {
  label: string;
  sortKey: string;
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (sortKey: string) => void;
  align?: "start" | "end" | "center";
}) {
  const alignClass = align === "end" ? "text-end" : align === "center" ? "text-center" : "text-start";
  const isActive = sortBy === sortKey;
  const indicator = isActive ? (sortDir === "asc" ? "▲" : "▼") : "↕";

  return (
    <th className={`px-4 py-3 font-semibold ${alignClass}`}>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900"
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>
        <span className="text-xs text-slate-400">{indicator}</span>
      </button>
    </th>
  );
}

export function TableBody({ children }: PropsWithChildren) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function TableRow({ children }: PropsWithChildren) {
  return <tr className="hover:bg-slate-50/60">{children}</tr>;
}

export function TableCell({
  children,
  align = "start"
}: PropsWithChildren<{ align?: "start" | "end" | "center" }>) {
  const alignClass = align === "end" ? "text-end" : align === "center" ? "text-center" : "text-start";
  return <td className={`px-4 py-3 align-top ${alignClass}`}>{children}</td>;
}

export function TableToolbar({ children }: PropsWithChildren) {
  return <div className="mb-4 grid gap-3 md:grid-cols-2">{children}</div>;
}

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const { t } = useTranslation("app");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const lang = i18n.resolvedLanguage ?? "ar";
  const locale = lang === "ar" ? "ar-EG" : lang === "fr" ? "fr-FR" : "en-US";
  const numberFormatter = new Intl.NumberFormat(locale);

  const formattedFrom = numberFormatter.format(from);
  const formattedTo = numberFormatter.format(to);
  const formattedTotal = numberFormatter.format(total);
  const formattedPage = numberFormatter.format(page);
  const formattedTotalPages = numberFormatter.format(totalPages);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
      <p>
        {t("pagination.summary", { from: formattedFrom, to: formattedTo, total: formattedTotal })}
      </p>
      <div className="flex items-center gap-2">
        <Select<number>
          aria-label={t("pagination.pageSize")}
          className="elms-select elms-select-sm"
          style={{ width: 96 }}
          value={pageSize}
          onChange={(value) => onPageSizeChange(Number(value))}
          options={[10, 20, 50, 100].map((size) => ({ value: size, label: String(size) }))}
          showSearch
          filterOption={(input, option) => selectLabelFilter(input, option)}
          optionFilterProp="label"
          classNames={{ popup: { root: "elms-select-dropdown" } }}
        />
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {t("pagination.prev")}
        </button>
        <span>
          {t("pagination.pageStatus", { page: formattedPage, totalPages: formattedTotalPages })}
        </span>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-50"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t("pagination.next")}
        </button>
      </div>
    </div>
  );
}

export function selectLabelFilter(input: string, option?: { label?: ReactNode }) {
  const label = option?.label;
  const normalizedLabel = typeof label === "string" ? label : String(label ?? "");
  return normalizedLabel.toLowerCase().includes(input.toLowerCase());
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-2">{description}</p>
    </div>
  );
}

export function ErrorState({
  title,
  description,
  retryLabel,
  onRetry
}: {
  title: string;
  description: string;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
      <p className="font-semibold text-red-900">{title}</p>
      <p className="mt-2">{description}</p>
      {onRetry ? (
        <button
          type="button"
          className="mt-4 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
          onClick={onRetry}
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

export function FormAlert({
  message,
  variant = "error"
}: {
  message: string;
  variant?: "error" | "info";
}) {
  const classes =
    variant === "error"
      ? "bg-red-50 text-red-700 border-red-100"
      : "bg-sky-50 text-sky-700 border-sky-100";

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${classes}`}
      role={variant === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {message}
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
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
  minLength,
  maxLength,
  dir,
  required,
  error,
  hint,
  ariaDescribedBy,
  commitMode = "immediate"
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
  dir?: "ltr" | "rtl" | "auto";
  required?: boolean;
  error?: string;
  hint?: string;
  ariaDescribedBy?: string;
  commitMode?: "immediate" | "blur";
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = error ? `${fieldId}-error` : undefined;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const describedBy = [hintId, errorId, ariaDescribedBy].filter(Boolean).join(" ") || undefined;
  const [draftValue, setDraftValue] = useState(value);
  const isBlurCommit = commitMode === "blur";
  const isDateField = type === "date" || type === "datetime-local";

  useEffect(() => {
    if (isBlurCommit) {
      setDraftValue(value);
    }
  }, [isBlurCommit, value]);

  return (
    <div className="block space-y-2">
      <label className="text-sm font-semibold" htmlFor={fieldId}>
        {label}
        {required && <span className="text-red-500 ms-1" aria-hidden="true">*</span>}
      </label>
      {isDateField ? (
        <DatePicker
          id={fieldId}
          className="elms-date-picker"
          classNames={{ popup: { root: "elms-date-picker-dropdown" } }}
          format={type === "date" ? DATE_PICKER_DATE_FORMAT : DATE_PICKER_DATETIME_FORMAT}
          value={toDatePickerValue(isBlurCommit ? draftValue : value, type)}
          onChange={(nextValue) => {
            const normalized = fromDatePickerValue(nextValue, type);
            if (isBlurCommit) {
              setDraftValue(normalized);
              return;
            }
            onChange(normalized);
          }}
          onBlur={() => {
            if (isBlurCommit && draftValue !== value) {
              onChange(draftValue);
            }
          }}
          placeholder={placeholder}
          showTime={type === "datetime-local" ? { format: "HH:mm" } : false}
          needConfirm={false}
          style={dir && dir !== "auto" ? { direction: dir } : undefined}
          aria-required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
        />
      ) : (
        <input
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 transition focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
          id={fieldId}
          dir={dir}
          onChange={(event) => {
            if (isBlurCommit) {
              setDraftValue(event.target.value);
              return;
            }
            onChange(event.target.value);
          }}
          onBlur={() => {
            if (isBlurCommit && draftValue !== value) {
              onChange(draftValue);
            }
          }}
          placeholder={placeholder}
          type={type}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={maxLength}
          value={isBlurCommit ? draftValue : value}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          required={required}
        />
      )}
      {isDateField ? (
        <input
          className="sr-only"
          id={`${fieldId}-required-proxy`}
          tabIndex={-1}
          readOnly
          value={isBlurCommit ? draftValue : value}
          required={required}
          aria-hidden="true"
        />
      ) : null}
      {hint ? (
        <p className="text-xs text-slate-500" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-600" id={errorId} role="status" aria-live="polite">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  dir,
  required,
  error,
  hint,
  ariaDescribedBy
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  dir?: "ltr" | "rtl" | "auto";
  required?: boolean;
  error?: string;
  hint?: string;
  ariaDescribedBy?: string;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const labelId = `${fieldId}-label`;
  const errorId = error ? `${fieldId}-error` : undefined;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const describedBy = [hintId, errorId, ariaDescribedBy].filter(Boolean).join(" ") || undefined;
  const selectStyle = dir && dir !== "auto" ? { direction: dir } : undefined;

  return (
    <div className="block space-y-2">
      <label className="text-sm font-semibold" htmlFor={fieldId} id={labelId}>
        {label}
        {required && <span className="text-red-500 ms-1" aria-hidden="true">*</span>}
      </label>
      <Select<string>
        id={fieldId}
        className="elms-select"
        classNames={{ popup: { root: "elms-select-dropdown" } }}
        options={options}
        showSearch
        filterOption={(input, option) => selectLabelFilter(input, option)}
        optionFilterProp="label"
        value={value}
        onChange={(nextValue) => onChange(nextValue)}
        style={selectStyle}
        aria-labelledby={labelId}
        aria-required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
      />
      <input
        className="sr-only"
        id={`${fieldId}-required-proxy`}
        tabIndex={-1}
        readOnly
        value={value}
        required={required}
        aria-hidden="true"
      />
      {hint ? (
        <p className="text-xs text-slate-500" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-600" id={errorId} role="status" aria-live="polite">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  dir,
  required,
  error,
  hint,
  ariaDescribedBy
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  dir?: "ltr" | "rtl" | "auto";
  required?: boolean;
  error?: string;
  hint?: string;
  ariaDescribedBy?: string;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = error ? `${fieldId}-error` : undefined;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const describedBy = [hintId, errorId, ariaDescribedBy].filter(Boolean).join(" ") || undefined;

  return (
    <div className="block space-y-2">
      <label className="text-sm font-semibold" htmlFor={fieldId}>
        {label}
        {required && <span className="text-red-500 ms-1" aria-hidden="true">*</span>}
      </label>
      <textarea
        className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 transition focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
        id={fieldId}
        dir={dir}
        onChange={(event) => onChange(event.target.value)}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        required={required}
      />
      {hint ? (
        <p className="text-xs text-slate-500" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-600" id={errorId} role="status" aria-live="polite">
          {error}
        </p>
      ) : null}
    </div>
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
  const locale = lang === "ar" ? "ar-EG" : lang === "fr" ? "fr-FR" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const lang = i18n.resolvedLanguage ?? "ar";
  const locale = lang === "ar" ? "ar-EG" : lang === "fr" ? "fr-FR" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium"
  }).format(new Date(value));
}

export function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return "—";
  }

  const lang = i18n.resolvedLanguage ?? "ar";
  const locale = lang === "ar" ? "ar-EG" : lang === "fr" ? "fr-FR" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2
  }).format(numeric);
}
