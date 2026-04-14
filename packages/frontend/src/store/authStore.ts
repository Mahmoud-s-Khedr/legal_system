import { create } from "zustand";
import type {
  AppAuthMode,
  AuthResponseDto,
  LoginDto,
  SessionUser,
  SetupDto
} from "@elms/shared";
import { AuthMode } from "@elms/shared";
import { apiFetch, clearDesktopLocalSessionToken, persistDesktopLocalSessionToken } from "../lib/api";
import { applyUserPreferredLanguage } from "../i18n";

interface AuthState {
  user: SessionUser | null;
  mode: AppAuthMode | null;
  needsSetup: boolean;
  isBootstrapped: boolean;
  bootstrap: () => Promise<void>;
  login: (payload: LoginDto) => Promise<void>;
  setup: (payload: SetupDto) => Promise<void>;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

let bootstrapPromise: Promise<void> | null = null;

const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  mode: null,
  needsSetup: false,
  isBootstrapped: false,
  async bootstrap() {
    if (get().isBootstrapped) return;
    if (bootstrapPromise) return bootstrapPromise;
    bootstrapPromise = (async () => {
      try {
        const response = await apiFetch<AuthResponseDto>("/api/auth/me");
        if (!response.session.user) {
          clearDesktopLocalSessionToken();
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

    persistDesktopLocalSessionToken(response.localSessionToken);

    set({
      mode: response.session.mode,
      user: response.session.user,
      isBootstrapped: true
    });
    await applyUserPreferredLanguage(response.session.user?.preferredLanguage);
  },
  async setup(payload) {
    const response = await apiFetch<AuthResponseDto>("/api/auth/setup", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    persistDesktopLocalSessionToken(response.localSessionToken);

    set({
      mode: response.session.mode,
      user: response.session.user,
      needsSetup: false,
      isBootstrapped: true
    });
    await applyUserPreferredLanguage(response.session.user?.preferredLanguage);
  },
  async refreshSession() {
    const response = await apiFetch<AuthResponseDto>("/api/auth/me");
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

    clearDesktopLocalSessionToken();

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
