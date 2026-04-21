import { useToastStore, type ToastVariant } from "../../store/toastStore";
import { useTranslation } from "react-i18next";

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "bg-emerald-600 text-white",
  error: "bg-red-600 text-white",
  info: "bg-slate-800 text-white"
};

const VARIANT_ICONS: Record<ToastVariant, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ"
};

export function ToastContainer() {
  const { t } = useTranslation("app");
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (!toasts.length) return null;

  return (
    <div
      className="fixed top-6 z-50 flex w-full flex-col items-center gap-2 px-4 start-0"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <div
          className={`flex items-center gap-3 rounded-2xl px-5 py-3 text-sm font-semibold shadow-elevated ${
            toast.exiting ? "animate-toast-exit" : "animate-toast-enter"
          } ${VARIANT_CLASSES[toast.variant]}`}
          key={toast.id}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="text-base">{VARIANT_ICONS[toast.variant]}</span>
          <span>{toast.message}</span>
          <button
            className="ms-2 rounded-full p-1 opacity-70 transition hover:opacity-100"
            onClick={() => removeToast(toast.id)}
            type="button"
            aria-label={t("actions.dismiss")}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
