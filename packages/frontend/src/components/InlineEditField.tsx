import { useState } from "react";
import { Check, X, Pencil } from "lucide-react";

interface SelectOption {
  label: string;
  value: string;
}

interface Props {
  /** Current display value */
  value: string | null | undefined;
  /** Called with the new value when the user confirms */
  onSave: (value: string) => Promise<void>;
  /** Input type: text or select */
  type?: "text" | "select" | "textarea";
  /** Options for select type */
  options?: SelectOption[];
  /** Placeholder text */
  placeholder?: string;
  /** Extra classes on the wrapper */
  className?: string;
}

/**
 * Click-to-edit inline field.
 * Renders as plain text with a pencil icon on hover.
 * On click: switches to an input/select with confirm (✓) and cancel (✕) buttons.
 */
export function InlineEditField({ value, onSave, type = "text", options, placeholder, className }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setDraft(value ?? "");
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  async function confirmEdit() {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <span
        className={`group inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-1 py-0.5 hover:bg-slate-100 ${className ?? ""}`}
        onClick={startEdit}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") startEdit(); }}
      >
        <span className={value ? "" : "italic text-slate-400"}>{value || placeholder || "—"}</span>
        <Pencil className="hidden h-3 w-3 shrink-0 text-slate-400 group-hover:inline" />
      </span>
    );
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className ?? ""}`}>
      {type === "select" && options ? (
        <select
          autoFocus
          className="rounded-lg border border-accent px-2 py-1 text-sm focus:outline-none"
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          value={draft}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          autoFocus
          className="rounded-lg border border-accent px-2 py-1 text-sm focus:outline-none"
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          value={draft}
        />
      ) : (
        <input
          autoFocus
          className="rounded-lg border border-accent px-2 py-1 text-sm focus:outline-none"
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void confirmEdit();
            if (e.key === "Escape") cancelEdit();
          }}
          type="text"
          value={draft}
        />
      )}
      <button
        aria-label="Confirm"
        className="rounded-lg p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
        disabled={saving}
        onClick={() => void confirmEdit()}
        type="button"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        aria-label="Cancel"
        className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
        onClick={cancelEdit}
        type="button"
      >
        <X className="h-4 w-4" />
      </button>
      {error && <span className="w-full text-xs text-red-500">{error}</span>}
    </span>
  );
}
