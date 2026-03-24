import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useHasPermission } from "../store/authStore";

interface Props {
  permission: string;
  children: ReactNode;
}

/**
 * Renders children only when the current user holds the required permission.
 * Redirects to /app/dashboard otherwise.
 */
export function PermissionGate({ permission, children }: Props) {
  const allowed = useHasPermission(permission);
  const navigate = useNavigate();

  useEffect(() => {
    if (!allowed) {
      void navigate({ to: "/app/dashboard" });
    }
  }, [allowed, navigate]);

  if (!allowed) return null;
  return <>{children}</>;
}
