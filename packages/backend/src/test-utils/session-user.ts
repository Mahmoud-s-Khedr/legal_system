import { EditionKey, FirmLifecycleStatus, type SessionUser } from "@elms/shared";

export function makeSessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "user-1",
    firmId: "firm-1",
    editionKey: EditionKey.ENTERPRISE,
    pendingEditionKey: null,
    lifecycleStatus: FirmLifecycleStatus.ACTIVE,
    trialEndsAt: null,
    graceEndsAt: null,
    roleId: "role-1",
    roleKey: "firm_admin",
    email: "user@elms.test",
    fullName: "Test User",
    preferredLanguage: "ar",
    permissions: [],
    ...overrides
  };
}
