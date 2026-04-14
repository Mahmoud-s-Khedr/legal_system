import { type RefObject, useEffect, useRef } from "react";

type OverlayMode = "modal" | "popover";

interface UseAccessibleOverlayOptions {
  open: boolean;
  mode: OverlayMode;
  contentRef: RefObject<HTMLElement>;
  triggerRef?: RefObject<HTMLElement | null>;
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
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

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

    const cleanupFns: Array<() => void> = [];
    if (mode === "modal") {
      const updatedNodes: Array<{
        element: HTMLElement;
        hadAriaHidden: boolean;
        previousAriaHidden: string | null;
        hadInert: boolean;
        previousInert: boolean;
      }> = [];
      let node: HTMLElement | null = content;
      while (node && node.parentElement) {
        const ancestorParent = node.parentElement as HTMLElement;
        for (const sibling of Array.from(ancestorParent.children)) {
          if (!(sibling instanceof HTMLElement) || sibling === node) {
            continue;
          }
          updatedNodes.push({
            element: sibling,
            hadAriaHidden: sibling.hasAttribute("aria-hidden"),
            previousAriaHidden: sibling.getAttribute("aria-hidden"),
            hadInert: "inert" in sibling,
            previousInert: Boolean((sibling as HTMLElement & { inert?: boolean }).inert)
          });
          sibling.setAttribute("aria-hidden", "true");
          (sibling as HTMLElement & { inert?: boolean }).inert = true;
        }
        if (ancestorParent === document.body) {
          break;
        }
        node = ancestorParent;
      }
      cleanupFns.push(() => {
        for (const entry of updatedNodes) {
          if (entry.hadAriaHidden) {
            entry.element.setAttribute("aria-hidden", entry.previousAriaHidden ?? "true");
          } else {
            entry.element.removeAttribute("aria-hidden");
          }
          if (entry.hadInert) {
            (entry.element as HTMLElement & { inert?: boolean }).inert = entry.previousInert;
          } else {
            (entry.element as HTMLElement & { inert?: boolean }).inert = false;
          }
        }
      });
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
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
      triggerRef?.current?.focus();
      for (const cleanupFn of cleanupFns) {
        cleanupFn();
      }
    };
  }, [contentRef, mode, open, triggerRef]);
}
