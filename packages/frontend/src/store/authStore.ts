import { create } from "zustand";
import type {
  AppAuthMode,
  AuthResponseDto,
  LoginDto,
  RegisterDto,
  SessionUser,
  SetupDto
} from "@elms/shared";
import { AuthMode } from "@elms/shared";
import { apiFetch } from "../lib/api";
import { applyUserPreferredLanguage } from "../i18n";

interface AuthState {
  user: SessionUser | null;
  mode: AppAuthMode | null;
  needsSetup: boolean;
  isBootstrapped: boolean;
  bootstrap: () => Promise<void>;
  login: (payload: LoginDto) => Promise<void>;
  register: (payload: RegisterDto) => Promise<void>;
  setup: (payload: SetupDto) => Promise<void>;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

let bootstrapPromise: Promise<void> | null = null;
const disableAuthBootstrap =
  import.meta.env.VITE_DISABLE_AUTH_BOOTSTRAP === "true";

const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  mode: null,
  needsSetup: false,
  isBootstrapped: false,
  async bootstrap() {
    if (get().isBootstrapped) return;
    if (bootstrapPromise) return bootstrapPromise;
    if (disableAuthBootstrap) {
      set({
        mode: null,
        user: null,
        needsSetup: false,
        isBootstrapped: true
      });
      return;
    }
    bootstrapPromise = (async () => {
      try {
        let response = await apiFetch<AuthResponseDto>("/api/auth/me");

        if (!response.session.user && response.session.mode === AuthMode.CLOUD) {
          try {
            response = await apiFetch<AuthResponseDto>("/api/auth/refresh", {
              method: "POST"
            });
          } catch {
            // Refresh is best-effort during bootstrap; fall back to logged-out state.
          }
        }

        let needsSetup = false;
        if (!response.session.user && response.session.mode === AuthMode.LOCAL) {
          try {
            const setupStatus = await apiFetch<{ needsSetup: boolean }>("/api/auth/setup");
            needsSetup = setupStatus.needsSetup;
          } catch {
            // setup endpoint unavailable; default to login
          }
        }
        set({
          mode: response.session.mode,
          user: response.session.user,
          needsSetup,
          isBootstrapped: true
        });
        await applyUserPreferredLanguage(response.session.user?.preferredLanguage);
      } catch {
        set({
          mode: null,
          user: null,
          needsSetup: false,
          isBootstrapped: true
        });
      } finally {
        bootstrapPromise = null;
      }
    })();
    return bootstrapPromise;
  },
  async login(payload) {
    const response = await apiFetch<AuthResponseDto>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    set({
      mode: response.session.mode,
      user: response.session.user,
      isBootstrapped: true
    });
    await applyUserPreferredLanguage(response.session.user?.preferredLanguage);
  },
  async register(payload) {
    const response = await apiFetch<AuthResponseDto>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    set({
      mode: response.session.mode,
      user: response.session.user,
      needsSetup: false,
      isBootstrapped: true
    });
    await applyUserPreferredLanguage(response.session.user?.preferredLanguage);
  },
  async setup(payload) {
    const response = await apiFetch<AuthResponseDto>("/api/auth/setup", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    set({
      mode: response.session.mode,
      user: response.session.user,
      needsSetup: false,
      isBootstrapped: true
    });
    await applyUserPreferredLanguage(response.session.user?.preferredLanguage);
  },
  async refreshSession() {
    let response = await apiFetch<AuthResponseDto>("/api/auth/me");
    if (!response.session.user && response.session.mode === AuthMode.CLOUD) {
      response = await apiFetch<AuthResponseDto>("/api/auth/refresh", {
        method: "POST"
      });
    }
    set({
      mode: response.session.mode,
      user: response.session.user,
      isBootstrapped: true
    });
    await applyUserPreferredLanguage(response.session.user?.preferredLanguage);
  },
  async logout() {
    await apiFetch<{ success: true }>("/api/auth/logout", {
      method: "POST"
    });

    set({
      mode: null,
      user: null,
      isBootstrapped: true
    });
  }
}));

export const useAuthBootstrap = useAuthStore;

/** Returns true if the current user has the given permission string. */
export const useHasPermission = (permission: string) =>
  useAuthStore((s) => s.user?.permissions.includes(permission) ?? false);

/** Returns true if the current user has at least one required permission. */
export const useHasAnyPermission = (permissions: string[]) =>
  useAuthStore((s) => permissions.some((permission) => s.user?.permissions.includes(permission)));
