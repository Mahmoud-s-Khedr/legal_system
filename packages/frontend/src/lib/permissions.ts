import { useAuthBootstrap } from "../store/authStore";

const EMPTY_PERMISSIONS: readonly string[] = [];

export const PERMISSIONS = {
  casesRead: "cases:read",
  casesCreate: "cases:create",
  clientsRead: "clients:read",
  clientsCreate: "clients:create",
  documentsRead: "documents:read",
  firmsRead: "firms:read",
  hearingsRead: "hearings:read",
  invoicesRead: "invoices:read",
  settingsRead: "settings:read",
  tasksRead: "tasks:read",
  usersRead: "users:read"
} as const;

export function hasPermission(
  permissions: readonly string[] | null | undefined,
  permission: string
) {
  return permissions?.includes(permission) ?? false;
}

export function hasAnyPermission(
  permissions: readonly string[] | null | undefined,
  requiredPermissions: readonly string[]
) {
  return requiredPermissions.some((permission) =>
    hasPermission(permissions, permission)
  );
}

export function usePermission(permission: string) {
  const permissions = useAuthBootstrap().user?.permissions ?? EMPTY_PERMISSIONS;
  return hasPermission(permissions, permission);
}

export function useAnyPermission(requiredPermissions: readonly string[]) {
  const permissions = useAuthBootstrap().user?.permissions ?? EMPTY_PERMISSIONS;
  return hasAnyPermission(permissions, requiredPermissions);
}

export function usePermissionQueryEnabled(
  requiredPermissions: string | readonly string[],
  enabled = true
) {
  const permissions = useAuthBootstrap().user?.permissions ?? EMPTY_PERMISSIONS;
  const allowed =
    typeof requiredPermissions === "string"
      ? hasPermission(permissions, requiredPermissions)
      : hasAnyPermission(permissions, requiredPermissions);

  return enabled && allowed;
}
