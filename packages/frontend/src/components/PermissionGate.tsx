import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthBootstrap } from "../store/authStore";

interface Props {
  permission?: string;
  permissions?: string[];
  children: ReactNode;
}

/**
 * Renders children only when the current user holds the required permission.
 * Redirects to /app/dashboard otherwise.
 */
export function PermissionGate({ permission, permissions, children }: Props) {
  const isBootstrapped = useAuthBootstrap().isBootstrapped;
  const userPermissions = useAuthBootstrap((state) => state.user?.permissions ?? []);
  const allowed = permission
    ? userPermissions.includes(permission)
    : (permissions?.some((item) => userPermissions.includes(item)) ?? false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isBootstrapped || allowed) {
      return;
    }
    void navigate({ to: "/app/dashboard", replace: true });
  }, [allowed, isBootstrapped, navigate]);

  if (!isBootstrapped || !allowed) return null;
  return <>{children}</>;
}
