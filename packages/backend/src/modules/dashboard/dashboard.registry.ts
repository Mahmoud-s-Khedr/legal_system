import type { DashboardChartKind, DashboardScope, DashboardWidgetKey, SessionUser } from "@elms/shared";

interface DashboardWidgetRule {
  key: DashboardWidgetKey;
  title: string;
  description?: string;
  allowedScopes: DashboardScope[];
  requiredAnyPermissions?: string[];
  roleDefaults: string[];
}

interface DashboardChartRule {
  key: DashboardChartKind;
  title: string;
  description?: string;
  allowedScopes: DashboardScope[];
  requiredAnyPermissions?: string[];
}

export const DASHBOARD_WIDGET_RULES: DashboardWidgetRule[] = [
  {
    key: "priority_strip",
    title: "Priority",
    description: "Urgent workload indicators",
    allowedScopes: ["my", "team", "office"],
    roleDefaults: ["*"]
  },
  {
    key: "my_work",
    title: "My work",
    description: "Tasks and hearings requiring attention",
    allowedScopes: ["my", "team", "office"],
    roleDefaults: ["*"]
  },
  {
    key: "recent_activity",
    title: "Recent activity",
    description: "Permission-safe recent updates",
    allowedScopes: ["my", "team", "office"],
    roleDefaults: ["*"]
  },
  {
    key: "admin_kpis",
    title: "Admin KPIs",
    description: "Organization level indicators",
    allowedScopes: ["office"],
    requiredAnyPermissions: ["users:read", "settings:read"],
    roleDefaults: ["firm_admin"]
  },
  {
    key: "lawyer_deadlines",
    title: "Lawyer deadlines",
    description: "Open legal workload and deadlines",
    allowedScopes: ["my", "team", "office"],
    requiredAnyPermissions: ["cases:read", "hearings:read", "tasks:read"],
    roleDefaults: ["senior_lawyer", "junior_lawyer"]
  },
  {
    key: "finance_review",
    title: "Finance review",
    description: "Invoices and expense pressure",
    allowedScopes: ["team", "office"],
    requiredAnyPermissions: ["invoices:read", "expenses:read"],
    roleDefaults: ["firm_admin", "senior_lawyer"]
  },
  {
    key: "assistant_intake",
    title: "Intake queue",
    description: "Assistant-oriented intake and follow-up",
    allowedScopes: ["my", "team"],
    requiredAnyPermissions: ["clients:read", "tasks:read"],
    roleDefaults: ["paralegal", "secretary"]
  },
  {
    key: "analytics",
    title: "Analytics",
    description: "Trends and risk indicators",
    allowedScopes: ["my", "team", "office"],
    requiredAnyPermissions: ["dashboard:read"],
    roleDefaults: ["*"]
  }
];

export const DASHBOARD_CHART_RULES: DashboardChartRule[] = [
  {
    key: "casesTrend",
    title: "Cases opened vs closed",
    allowedScopes: ["my", "team", "office"],
    requiredAnyPermissions: ["cases:read"]
  },
  {
    key: "tasksTrend",
    title: "Tasks completed vs overdue",
    allowedScopes: ["my", "team", "office"],
    requiredAnyPermissions: ["tasks:read"]
  },
  {
    key: "hearingsTrend",
    title: "Hearings scheduled",
    allowedScopes: ["my", "team", "office"],
    requiredAnyPermissions: ["hearings:read"]
  },
  {
    key: "pipeline",
    title: "Case pipeline",
    allowedScopes: ["my", "team", "office"],
    requiredAnyPermissions: ["cases:read"]
  },
  {
    key: "riskBuckets",
    title: "Risk buckets",
    allowedScopes: ["my", "team", "office"],
    requiredAnyPermissions: ["tasks:read", "hearings:read"]
  },
  {
    key: "financeTrend",
    title: "Collections trend",
    allowedScopes: ["team", "office"],
    requiredAnyPermissions: ["invoices:read"]
  }
];

export function resolveDashboardWidgets(actor: SessionUser, scope: DashboardScope) {
  const perms = new Set(actor.permissions);
  return DASHBOARD_WIDGET_RULES.filter((widget) => {
    if (!widget.allowedScopes.includes(scope)) {
      return false;
    }

    const roleAllowed =
      widget.roleDefaults.includes("*") ||
      widget.roleDefaults.includes(actor.roleKey);

    if (!roleAllowed && widget.requiredAnyPermissions?.length) {
      return widget.requiredAnyPermissions.some((p) => perms.has(p));
    }

    if (widget.requiredAnyPermissions?.length) {
      return widget.requiredAnyPermissions.some((p) => perms.has(p));
    }

    return roleAllowed;
  }).map(({ key, title, description }) => ({ key, title, description }));
}

export function resolveDashboardChartRules(actor: SessionUser, scope: DashboardScope) {
  const perms = new Set(actor.permissions);
  return DASHBOARD_CHART_RULES.filter((chart) => {
    if (!chart.allowedScopes.includes(scope)) {
      return false;
    }

    if (!chart.requiredAnyPermissions?.length) {
      return true;
    }

    return chart.requiredAnyPermissions.some((p) => perms.has(p));
  });
}
