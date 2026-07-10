import { create } from "zustand";
import { apiFetch, ApiError } from "../lib/api";

export interface OperatorSessionUser {
  id: string;
  email: string;
  displayName: string;
  status: "ACTIVE" | "SUSPENDED";
}

interface OperatorAuthState {
  operator: OperatorSessionUser | null;
  isBootstrapped: boolean;
  bootstrap: () => Promise<void>;
  login: (payload: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

let bootstrapPromise: Promise<void> | null = null;

export const useOperatorAuthStore = create<OperatorAuthState>((set, get) => ({
  operator: null,
  isBootstrapped: false,
  async bootstrap() {
    if (get().isBootstrapped) return;
    if (bootstrapPromise) return bootstrapPromise;
    bootstrapPromise = (async () => {
      try {
        const response = await apiFetch<{ operator: OperatorSessionUser }>(
          "/api/operator/auth/me"
        );
        set({ operator: response.operator, isBootstrapped: true });
      } catch (error) {
        if (error instanceof ApiError && error.status !== 401) {
          throw error;
        }
        set({ operator: null, isBootstrapped: true });
      } finally {
        bootstrapPromise = null;
      }
    })();
    return bootstrapPromise;
  },
  async login(payload) {
    const response = await apiFetch<{ operator: OperatorSessionUser }>(
      "/api/operator/auth/login",
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    );
    set({ operator: response.operator, isBootstrapped: true });
  },
  async logout() {
    await apiFetch("/api/operator/auth/logout", { method: "POST" });
    set({ operator: null });
  }
}));
