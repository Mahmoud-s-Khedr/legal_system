import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function OfflineBanner() {
  const { t } = useTranslation("app");
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    function onOnline() {
      setIsOffline(false);
    }
    function onOffline() {
      setIsOffline(true);
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div
      role="alert"
      className="fixed bottom-4 start-1/2 z-50 -translate-x-1/2 rounded-2xl bg-slate-800 px-5 py-3 text-sm font-medium text-white shadow-elevated"
    >
      {t("pwa.offline")}
    </div>
  );
}
