import { NotificationChannel, NotificationType } from "@elms/shared";

export const INTERNET_RESTRICTED_PATHS = {
  appInvitations: "/app/invitations",
  appInvitationCreate: "/app/invitations/new",
  research: "/app/research",
  researchSession: "/app/research/$sessionId"
} as const;

export const VISIBLE_NOTIFICATION_CHANNELS = [
  NotificationChannel.IN_APP,
  NotificationChannel.DESKTOP_OS
] as const;

export const VISIBLE_NOTIFICATION_TYPES = Object.values(NotificationType).filter(
  (type) => type !== NotificationType.RESEARCH_COMPLETE
);

export function isInternetRestrictedPath(pathname: string): boolean {
  return pathname === INTERNET_RESTRICTED_PATHS.appInvitations ||
    pathname === INTERNET_RESTRICTED_PATHS.appInvitationCreate ||
    pathname === INTERNET_RESTRICTED_PATHS.research ||
    pathname.startsWith("/app/research/");
}
