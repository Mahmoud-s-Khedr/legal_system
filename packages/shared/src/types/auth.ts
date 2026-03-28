import {
  AuthMode,
  EditionKey,
  FirmLifecycleStatus,
  NotificationChannel
} from "../enums/index";

export type AppAuthMode = `${AuthMode}`;

export interface SessionUser {
  id: string;
  firmId: string;
  editionKey: EditionKey;
  pendingEditionKey: EditionKey | null;
  lifecycleStatus: FirmLifecycleStatus;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  roleId: string;
  roleKey: string;
  email: string;
  fullName: string;
  preferredLanguage: string;
  permissions: string[];
}

export interface AppSession {
  mode: AppAuthMode;
  user: SessionUser | null;
}

export interface AuthCookies {
  accessToken?: string;
  refreshToken?: string;
  localSessionId?: string;
}

export interface NotificationPreferenceState {
  type: string;
  channel: NotificationChannel;
  enabled: boolean;
}

export interface AccessTokenClaims {
  sub: string;
  firmId: string;
  editionKey: EditionKey;
  pendingEditionKey: EditionKey | null;
  lifecycleStatus: FirmLifecycleStatus;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  roleId: string;
  roleKey: string;
  email: string;
  permissions: string[];
}
