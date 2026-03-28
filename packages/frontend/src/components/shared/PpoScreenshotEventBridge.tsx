import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { startPpoScreenshotEventListener } from "../../lib/ppoScreenshotEvents";
import { useToastStore } from "../../store/toastStore";

export function PpoScreenshotEventBridge() {
  const { t } = useTranslation("app");
  const addToast = useToastStore((state) => state.addToast);
  const isDesktopShell = import.meta.env.VITE_DESKTOP_SHELL === "true";

  useEffect(() => {
    return startPpoScreenshotEventListener({ isDesktopShell, addToast, t });
  }, [addToast, isDesktopShell, t]);

  return null;
}
