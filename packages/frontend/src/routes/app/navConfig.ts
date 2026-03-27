import { AuthMode, type AppAuthMode } from "@elms/shared";
import {
  BarChart2,
  Briefcase,
  CheckSquare,
  FileCode,
  FileText,
  LayoutDashboard,
  Library,
  Receipt,
  Scale,
  Settings,
  Users,
  Wallet
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavGroup = "core" | "finance" | "tools" | "administration";

export interface NavConfigItem {
  id: string;
  labelKey: string;
  to: string;
  icon: LucideIcon;
  group: NavGroup;
  order: number;
  cloudOnly?: boolean;
  requiredPermission?: string;
}

export interface SidebarNavItem {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
}

export interface SidebarNavSection {
  id: NavGroup;
  label?: string;
  items: SidebarNavItem[];
}

export const navConfig: NavConfigItem[] = [
  { id: "dashboard", labelKey: "nav.dashboard", to: "/app/dashboard", icon: LayoutDashboard, group: "core", order: 10 },
  { id: "clients", labelKey: "nav.clients", to: "/app/clients", icon: Users, group: "core", order: 20 },
  { id: "cases", labelKey: "nav.cases", to: "/app/cases", icon: Briefcase, group: "core", order: 30 },
  { id: "calendar", labelKey: "nav.calendar", to: "/app/calendar", icon: Scale, group: "core", order: 40 },
  { id: "hearings", labelKey: "nav.hearings", to: "/app/hearings", icon: Scale, group: "core", order: 50 },
  { id: "tasks", labelKey: "nav.tasks", to: "/app/tasks", icon: CheckSquare, group: "core", order: 60 },
  { id: "documents", labelKey: "nav.documents", to: "/app/documents", icon: FileText, group: "core", order: 70 },
  {
    id: "invoices",
    labelKey: "nav.invoices",
    to: "/app/invoices",
    icon: Receipt,
    group: "finance",
    order: 110,
    requiredPermission: "invoices:read"
  },
  {
    id: "expenses",
    labelKey: "nav.expenses",
    to: "/app/expenses",
    icon: Wallet,
    group: "finance",
    order: 120,
    requiredPermission: "invoices:read"
  },
  {
    id: "reports",
    labelKey: "nav.reports",
    to: "/app/reports",
    icon: BarChart2,
    group: "tools",
    order: 210,
    requiredPermission: "reports:read"
  },
  {
    id: "templates",
    labelKey: "nav.templates",
    to: "/app/templates",
    icon: FileCode,
    group: "tools",
    order: 220,
    requiredPermission: "templates:read"
  },
  {
    id: "library",
    labelKey: "nav.library",
    to: "/app/library",
    icon: Library,
    group: "tools",
    order: 230,
    requiredPermission: "library:read"
  },
  {
    id: "users",
    labelKey: "nav.users",
    to: "/app/users",
    icon: Users,
    group: "administration",
    order: 310,
    requiredPermission: "users:read"
  },
  {
    id: "settings",
    labelKey: "nav.settings",
    to: "/app/settings",
    icon: Settings,
    group: "administration",
    order: 320,
    requiredPermission: "settings:read"
  }
];

const GROUP_ORDER: NavGroup[] = ["core", "finance", "tools", "administration"];

function canAccessNavItem(item: NavConfigItem, mode: AppAuthMode | null, permissions: string[]): boolean {
  if (item.cloudOnly && mode !== AuthMode.CLOUD) return false;
  if (item.requiredPermission && !permissions.includes(item.requiredPermission)) return false;
  return true;
}

export function buildSidebarNavSections({
  t,
  mode,
  permissions
}: {
  t: (key: string) => string;
  mode: AppAuthMode | null;
  permissions: string[];
}): SidebarNavSection[] {
  const visibleItems = navConfig
    .filter((item) => canAccessNavItem(item, mode, permissions))
    .sort((a, b) => a.order - b.order);

  const sections: SidebarNavSection[] = [];

  for (const groupId of GROUP_ORDER) {
    const items = visibleItems
      .filter((item) => item.group === groupId)
      .map((item) => ({
        id: item.id,
        label: t(item.labelKey),
        to: item.to,
        icon: item.icon
      }));

    if (items.length === 0) continue;

    sections.push({
      id: groupId,
      ...(groupId === "core" ? {} : { label: t(`nav.groups.${groupId}`) }),
      items
    });
  }

  return sections;
}
