import { create } from "zustand";

export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  exiting?: boolean;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, variant?: ToastVariant) => void;
  removeToast: (id: string) => void;
}

let nextId = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  addToast(message, variant = "info") {
    const id = `toast-${++nextId}`;
    set({ toasts: [...get().toasts, { id, message, variant }] });

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      set({
        toasts: get().toasts.map((t) =>
          t.id === id ? { ...t, exiting: true } : t
        )
      });
      // Remove from DOM after exit animation
      setTimeout(() => {
        set({ toasts: get().toasts.filter((t) => t.id !== id) });
      }, 250);
    }, 4000);
  },
  removeToast(id) {
    set({
      toasts: get().toasts.map((t) =>
        t.id === id ? { ...t, exiting: true } : t
      )
    });
    setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    }, 250);
  }
}));
