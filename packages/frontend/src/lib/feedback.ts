import { useTranslation } from "react-i18next";
import { useToastStore, type ToastVariant } from "../store/toastStore";

export function useMutationFeedback() {
  const { t } = useTranslation("app");
  const addToast = useToastStore((state) => state.addToast);

  function show(messageKey: string, variant: ToastVariant = "success") {
    addToast(t(messageKey), variant);
  }

  return {
    success: (messageKey: string) => show(messageKey, "success"),
    info: (messageKey: string) => show(messageKey, "info"),
    error: (messageKey: string) => show(messageKey, "error")
  };
}
