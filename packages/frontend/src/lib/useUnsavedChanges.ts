import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { confirmAction } from "./dialog";

interface UseUnsavedChangesOptions {
  bypassBlockRef?: MutableRefObject<boolean>;
}

export function useUnsavedChangesBypass(): {
  bypassRef: MutableRefObject<boolean>;
  allowNextNavigation: () => void;
} {
  const bypassRef = useRef(false);
  const allowNextNavigation = useCallback(() => {
    bypassRef.current = true;
  }, []);

  return { bypassRef, allowNextNavigation };
}

/**
 * Warns the user before leaving a page with unsaved changes.
 * Blocks both in-app navigation (via TanStack Router) and browser unload.
 *
 * Usage:
 *   useUnsavedChanges(isDirty);
 *
 * Where `isDirty` is true whenever form values differ from their initial state.
 */
export function useUnsavedChanges(isDirty: boolean, options?: UseUnsavedChangesOptions): void {
  const { t } = useTranslation("app");
  const message = t("unsavedChanges.confirmLeave", "You have unsaved changes. Leave and discard them?");
  const leaveLabel = t("unsavedChanges.leave", "Leave");
  const stayLabel = t("unsavedChanges.stay", "Stay");

  // Block in-app navigation
  useBlocker({
    shouldBlockFn: async () => {
      if (options?.bypassBlockRef?.current) {
        options.bypassBlockRef.current = false;
        return false;
      }

      if (!isDirty) {
        return false;
      }

      const approved = await confirmAction({
        content: message,
        okText: leaveLabel,
        cancelText: stayLabel
      });
      return !approved;
    },
    enableBeforeUnload: isDirty
  });

  // Block browser unload / tab close
  useEffect(() => {
    if (!isDirty) return undefined;
    const handler = (e: BeforeUnloadEvent) => {
      if (options?.bypassBlockRef?.current) {
        return;
      }
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, options?.bypassBlockRef]);
}
