import { type RefObject, useEffect } from "react";

type OverlayMode = "modal" | "popover";

interface UseAccessibleOverlayOptions {
  open: boolean;
  mode: OverlayMode;
  contentRef: RefObject<HTMLElement>;
  triggerRef: RefObject<HTMLElement>;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden")
  );
}

export function useAccessibleOverlay({
  open,
  mode,
  contentRef,
  triggerRef,
  onClose
}: UseAccessibleOverlayOptions) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const content = contentRef.current;
    if (!content) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const focusables = getFocusable(content);
    const initialTarget = focusables[0] ?? content;
    initialTarget.focus();

    if (mode === "modal") {
      document.body.style.overflow = "hidden";
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const currentContent = contentRef.current;
      if (!currentContent) {
        return;
      }

      const currentFocusables = getFocusable(currentContent);
      if (currentFocusables.length === 0) {
        event.preventDefault();
        currentContent.focus();
        return;
      }

      const first = currentFocusables[0];
      const last = currentFocusables[currentFocusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!active || active === first || !currentContent.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (!active || active === last || !currentContent.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [contentRef, mode, onClose, open, triggerRef]);
}
