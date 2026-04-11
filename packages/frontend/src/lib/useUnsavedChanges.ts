import { useEffect } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { confirmAction } from "./dialog";

/**
 * Warns the user before leaving a page with unsaved changes.
 * Blocks both in-app navigation (via TanStack Router) and browser unload.
 *
 * Usage:
 *   useUnsavedChanges(isDirty);
 *
 * Where `isDirty` is true whenever form values differ from their initial state.
 */
export function useUnsavedChanges(isDirty: boolean): void {
  const { t } = useTranslation("app");
  const message = t("unsavedChanges.confirmLeave", "You have unsaved changes. Leave and discard them?");

  // Block in-app navigation
  useBlocker({
    shouldBlockFn: async () => {
      if (!isDirty) {
        return false;
      }

      const approved = await confirmAction({
        content: message
      });
      return approved;
    },
    enableBeforeUnload: isDirty
  });

  // Block browser unload / tab close
  useEffect(() => {
    if (!isDirty) return undefined;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}
