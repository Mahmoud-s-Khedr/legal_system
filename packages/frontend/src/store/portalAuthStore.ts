import { create } from "zustand";
import { resolveApiUrl } from "../lib/api";

interface PortalUser {
  clientId: string;
  firmId: string;
  name: string;
}

interface PortalAuthState {
  user: PortalUser | null;
  isBootstrapped: boolean;
  bootstrap: () => Promise<void>;
  login: (email: string, firmId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const usePortalAuthStore = create<PortalAuthState>((set) => ({
  user: null,
  isBootstrapped: false,

  bootstrap: async () => {
    try {
      const res = await fetch(resolveApiUrl("/api/portal/auth/me"), { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as PortalUser;
        set({ user: data, isBootstrapped: true });
      } else {
        set({ user: null, isBootstrapped: true });
      }
    } catch {
      set({ user: null, isBootstrapped: true });
    }
  },

  login: async (email: string, firmId: string, password: string) => {
    const res = await fetch(resolveApiUrl("/api/portal/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, firmId, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Login failed" }));
      throw new Error((err as { message?: string }).message ?? "Login failed");
    }
    const data = await res.json() as PortalUser;
    set({ user: data });
  },

  logout: async () => {
    await fetch(resolveApiUrl("/api/portal/auth/logout"), { method: "POST", credentials: "include" }).catch(() => {});
    set({ user: null });
  }
}));
