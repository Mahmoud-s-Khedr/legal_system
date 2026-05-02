import type { DashboardChartKind, DashboardRange, DashboardScope } from "@elms/shared";
import type { TFunction } from "i18next";

function normalizeToken(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "_").replace(/-/g, "_");
}

function titleFallback(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function localizeScopeLabel(t: TFunction, scope: DashboardScope) {
  return t(`dashboard.analytics.scope.${scope}`);
}

export function localizeRangeLabel(t: TFunction, range: DashboardRange) {
  return t(`dashboard.analytics.range.${range}`);
}

export function localizePriorityCardLabel(
  t: TFunction,
  key: "dueToday" | "overdue" | "hearings7d" | "unassigned"
) {
  return t(`dashboard.analytics.priority.${key}`);
}

export function localizeChartTitle(t: TFunction, chartKey: DashboardChartKind) {
  return t(`dashboard.analytics.charts.${chartKey}.title`);
}

export function localizeChartDescription(t: TFunction, chartKey: DashboardChartKind) {
  return t(`dashboard.analytics.charts.${chartKey}.description`);
}

export function localizeDashboardChartLabel(
  t: TFunction,
  chartKey: DashboardChartKind,
  rawLabel: string
) {
  const token = normalizeToken(rawLabel);

  const mapByChart: Record<DashboardChartKind, string> = {
    casesTrend: `dashboard.analytics.enums.caseStatus.${token}`,
    tasksTrend: `dashboard.analytics.enums.taskStatus.${token}`,
    hearingsTrend: `dashboard.analytics.enums.hearingOutcome.${token}`,
    pipeline: `dashboard.analytics.enums.caseStatus.${token}`,
    riskBuckets: `dashboard.analytics.enums.riskBucket.${token}`,
    financeTrend: `dashboard.analytics.enums.invoiceStatus.${token}`
  };

  const key = mapByChart[chartKey];
  const translated = t(key, { defaultValue: "" });
  if (translated && translated !== key) {
    return translated;
  }

  return titleFallback(token);
}
