import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthBootstrap, useHasPermission } from "../store/authStore";

interface Props {
  permission: string;
  children: ReactNode;
}

/**
 * Renders children only when the current user holds the required permission.
 * Redirects to /app/dashboard otherwise.
 */
export function PermissionGate({ permission, children }: Props) {
  const isBootstrapped = useAuthBootstrap().isBootstrapped;
  const allowed = useHasPermission(permission);
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
