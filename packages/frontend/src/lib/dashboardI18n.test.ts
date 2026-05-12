import { describe, expect, it } from "vitest";
import i18n from "../i18n";
import {
  localizeDashboardChartLabel,
  localizeDashboardSeriesLabel,
  localizeRangeLabel,
  localizeScopeLabel
} from "./dashboardI18n";

describe("dashboardI18n", () => {
  it("localizes known enum labels in English", async () => {
    await i18n.changeLanguage("en");
    const t = i18n.getFixedT("en", "app");

    expect(localizeDashboardChartLabel(t, "casesTrend", "ACTIVE")).toBe("Active");
    expect(localizeDashboardChartLabel(t, "tasksTrend", "IN_PROGRESS")).toBe("In Progress");
    expect(localizeDashboardChartLabel(t, "hearingsTrend", "PARTIAL_RULING")).toBe("Partial Ruling");
  });

  it("localizes known enum labels in Arabic", async () => {
    await i18n.changeLanguage("ar");
    const t = i18n.getFixedT("ar", "app");

    expect(localizeDashboardChartLabel(t, "casesTrend", "ACTIVE")).toBe("نشطة");
    expect(localizeScopeLabel(t, "office")).toBe("المكتب");
    expect(localizeRangeLabel(t, "90d")).toBe("90 يومًا");
  });

  it("falls back to normalized title-case text for unknown labels", async () => {
    await i18n.changeLanguage("en");
    const t = i18n.getFixedT("en", "app");

    expect(localizeDashboardChartLabel(t, "casesTrend", "VERY_CUSTOM_STATUS")).toBe("Very Custom Status");
  });

  it("localizes finance series labels", async () => {
    await i18n.changeLanguage("en");
    const t = i18n.getFixedT("en", "app");

    expect(localizeDashboardSeriesLabel(t, "financeTrend", "revenue")).toBe("Revenue");
    expect(localizeDashboardSeriesLabel(t, "financeTrend", "profit")).toBe("Profit");
  });
});
