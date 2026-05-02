# Analytics Rationalization Report (Permission-Aware, Phase 1)

## Summary

This report audits the analytics currently implemented in ELMS, then recommends what to add, improve, merge, and remove using a moderate rationalization strategy.

Decision framing used:
- Optimize analytics delivery for permission-based access, not static persona-only dashboards.
- Preserve actionable analytics and remove or merge low-signal/redundant analytics.
- Prioritize a 4-6 week Phase 1 delivery.

---

## Current-State Inventory Matrix

Scoring scale used in this report:
- 1 (low) to 5 (high).
- Maintenance complexity: 1 (low complexity) to 5 (high complexity).

### A) Dashboard priority cards

| Surface | Implemented metric | Grain | Filters/scopes | Permission gate | Role impact | Export | Notes |
|---|---|---|---|---|---|---|---|
| `dueToday` | Open tasks due today | Count | Scope-aware (`my/team/office`) | `dashboard:read` | All roles with dashboard access | No | Actionable for daily operations |
| `overdue` | Open tasks overdue now | Count | Scope-aware (`my/team/office`) | `dashboard:read` | All roles with dashboard access | No | Strong risk signal |
| `hearings7d` | Hearings within next 7 days | Count | Scope-aware (`my/team/office`) | `dashboard:read` | All roles with hearing workflows | No | Strong calendar readiness signal |
| `unassigned` | Open tasks with no assignee | Count | Scope-aware (`my/team/office`) | `dashboard:read` | Managers/coordinators | No | Good delegation/load-balancing signal |

### B) Dashboard analytics charts (`/api/dashboard/analytics`)

| Chart key | Label in UI/service | Implemented metric shape | Grain | Filters/scopes | Permission gate | Export | Notes |
|---|---|---|---|---|---|---|---|
| `casesTrend` | Cases opened vs closed | Case status distribution for cases created in range | Status bucket | Scope + range (`30d/90d`) | `dashboard:read` + `cases:read` | No | Useful but label may imply open/close flow while data is status distribution |
| `tasksTrend` | Tasks completed vs overdue | Task status distribution for tasks created in range | Status bucket | Scope + range | `dashboard:read` + `tasks:read` | No | Label/metric mismatch: does not directly compute overdue by due date |
| `hearingsTrend` | Hearings scheduled | Hearing outcome distribution for sessions in range | Outcome bucket | Scope + range | `dashboard:read` + `hearings:read` | No | Works as outcome mix, not pure schedule trend |
| `pipeline` | Pipeline | Case status distribution (ACTIVE/SUSPENDED/CLOSED) | Status bucket | Scope | `dashboard:read` + `cases:read` | No | Overlaps with case-status report |
| `riskBuckets` | Risk buckets | Overdue high-priority tasks + hearings in 72h | 2 risk counters | Scope | `dashboard:read` + (`tasks:read` or `hearings:read`) | No | High actionability |
| `financeTrend` | Collections trend | Invoice status distribution in range | Status bucket | Team/office only + range | `dashboard:read` + `invoices:read` | No | Label implies collections time-series but metric is status mix |

Privacy rule in analytics charts:
- K-anonymity suppression removes points with counts `< 3` and can mark chart as suppressed.

### C) Reports module (`/api/reports/*`)

| Report type/surface | Implemented metric | Grain | Filters/scopes | Permission gate | Export | Notes |
|---|---|---|---|---|---|---|
| `case-status` | Cases grouped by status | Status bucket | `dateFrom/dateTo`, table search/sort/page | `reports:read` | Excel/PDF | Overlaps with dashboard `pipeline` and `casesTrend` |
| `hearing-outcomes` | Hearings grouped by outcome | Outcome bucket | `dateFrom/dateTo`, table search/sort/page | `reports:read` | Excel/PDF | Useful for legal outcome monitoring |
| `lawyer-workload` | Per user open cases/open tasks/upcoming hearings | User | No date filter in calculation | `reports:read` | Excel/PDF | High management value |
| `revenue` | Monthly invoiced vs paid (from invoices) | Month | `dateFrom/dateTo`, table search/sort/page | `reports:read` | Excel/PDF | Core finance trend report |
| `outstanding-balances` | Outstanding invoice list + days overdue | Invoice | Search/sort/page | `reports:read` | Excel/PDF | Strong collections action report |
| `case-profitability/:caseId` | Billed/paid/expenses/gross profit by case | Case | Path param `caseId` | `reports:read` | Excel/PDF | Highly actionable for case-level decisions |
| Litigation sheet export | Session-oriented litigation worksheet | Session/case rows | No report filters in route | `reports:read` | Excel only | Operational/legal output, less KPI analytics |
| Custom report builder | Saved configs for supported report types | Mirrors supported report row grain | Config (`dateFrom/dateTo/groupBy/columns`) | `reports:read` | Excel/PDF | Flexibility layer; relies on same core report engines |

### D) Overlap map (same decision answered multiple places)

| Decision question | Current surfaces |
|---|---|
| What is our case mix/pipeline? | Dashboard `pipeline`, dashboard `casesTrend`, report `case-status` |
| Where are urgent operations risks? | Dashboard `overdue`, dashboard `riskBuckets`, report `lawyer-workload` |
| How is finance health evolving? | Dashboard `financeTrend`, report `revenue`, report `outstanding-balances` |

---

## Evaluation Rubric and Classification

Rubric dimensions:
- Decision usefulness
- Actionability
- Interpretability
- Freshness
- Role relevance
- Permission fit
- Maintenance complexity (inverse priority)

### Scored assessment

| Surface | Usefulness | Actionability | Interpretability | Freshness | Role relevance | Permission fit | Maint. complexity | Classification |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Dashboard `dueToday` | 5 | 5 | 5 | 5 | 5 | 5 | 2 | Keep |
| Dashboard `overdue` | 5 | 5 | 5 | 5 | 5 | 5 | 2 | Keep |
| Dashboard `hearings7d` | 5 | 5 | 5 | 5 | 5 | 5 | 2 | Keep |
| Dashboard `unassigned` | 4 | 5 | 5 | 5 | 4 | 5 | 2 | Keep |
| Dashboard `casesTrend` | 3 | 3 | 2 | 4 | 4 | 5 | 3 | Improve |
| Dashboard `tasksTrend` | 2 | 2 | 2 | 4 | 4 | 5 | 3 | Improve (high priority) |
| Dashboard `hearingsTrend` | 3 | 3 | 3 | 4 | 4 | 5 | 3 | Improve |
| Dashboard `pipeline` | 3 | 3 | 4 | 4 | 4 | 5 | 2 | Merge candidate |
| Dashboard `riskBuckets` | 5 | 5 | 5 | 5 | 5 | 5 | 2 | Keep |
| Dashboard `financeTrend` | 3 | 3 | 2 | 4 | 4 | 5 | 3 | Improve |
| Report `case-status` | 4 | 4 | 5 | 4 | 4 | 5 | 2 | Keep (shared with merge) |
| Report `hearing-outcomes` | 4 | 4 | 5 | 4 | 4 | 5 | 2 | Keep |
| Report `lawyer-workload` | 5 | 5 | 5 | 5 | 5 | 5 | 3 | Keep |
| Report `revenue` | 5 | 5 | 5 | 4 | 5 | 5 | 3 | Keep |
| Report `outstanding-balances` | 5 | 5 | 5 | 5 | 5 | 5 | 3 | Keep |
| Report `case-profitability` | 5 | 5 | 5 | 4 | 5 | 5 | 3 | Keep |
| Litigation sheet export | 3 | 4 | 3 | 4 | 4 | 5 | 3 | Keep (reposition) |
| Custom report builder | 5 | 5 | 4 | 4 | 5 | 5 | 4 | Keep |

---

## Add Recommendations (Phase 1 Feasible)

Each recommendation includes metric contract and permission mapping.

### 1) Case operations analytics

1. Case cycle time (opened -> closed)
- Formula: `median(closedAt - openedAt)` by month and case type/court.
- Grain: case, aggregated by month.
- Permissions: `dashboard:read` + `cases:read`.
- Scopes: `my/team/office`.
- Primary users: managers, senior lawyers, firm admins.

2. Case aging buckets (open cases)
- Formula: count open cases in age buckets (`0-30`, `31-60`, `61-90`, `90+` days).
- Grain: case bucket distribution.
- Permissions: `dashboard:read` + `cases:read`.
- Scopes: `my/team/office`.

3. Reopen rate
- Formula: `reopened_cases / closed_cases` in period.
- Grain: period ratio.
- Permissions: `dashboard:read` + `cases:read`.
- Scopes: `team/office` default.

### 2) Hearings analytics

1. Adjournment rate
- Formula: `adjourned_sessions / total_sessions` by court/lawyer/month.
- Grain: outcome ratio by dimension.
- Permissions: `dashboard:read` + `hearings:read`.
- Scopes: `my/team/office`.

2. Hearing prep lead-time
- Formula: median days between latest task completion and hearing datetime.
- Grain: session aggregated by period.
- Permissions: `dashboard:read` + `hearings:read` + `tasks:read`.
- Scopes: `my/team/office`.

### 3) Workload analytics

1. Assignment balance index
- Formula: coefficient of variation for open work per assignee.
- Grain: user distribution summary.
- Permissions: `dashboard:read` + `tasks:read` + `cases:read`.
- Scopes: `team/office`.

2. Overdue trajectory
- Formula: daily overdue open tasks time-series.
- Grain: day.
- Permissions: `dashboard:read` + `tasks:read`.
- Scopes: `my/team/office`.

### 4) Finance analytics

1. DSO / collection lag
- Formula: average days from `issuedAt` to full paid state.
- Grain: invoice aggregated by period.
- Permissions: `dashboard:read` + `invoices:read`.
- Scopes: `team/office`.

2. Void/write-off trend
- Formula: count and value of invoices moved to `VOID` by period.
- Grain: month.
- Permissions: `dashboard:read` + `invoices:read`.
- Scopes: `team/office`.

3. Directional cash forecast
- Formula: rolling baseline of expected collections from current outstanding aging profile.
- Grain: week/month directional projection.
- Permissions: `dashboard:read` + `invoices:read`.
- Scopes: `office`.
- Labeling: must be explicitly marked directional/non-accounting forecast.

### 5) Client/firm health analytics

1. Active client trend
- Formula: distinct clients with active case(s) by month.
- Grain: month.
- Permissions: `dashboard:read` + `clients:read` + `cases:read`.
- Scopes: `team/office`.

2. Client concentration risk
- Formula: share of billed revenue from top N clients in period.
- Grain: period concentration ratio.
- Permissions: `dashboard:read` + `clients:read` + `invoices:read`.
- Scopes: `office`.

3. Intake-to-open conversion
- Formula: `% of newly created client records that become linked to a case in X days`.
- Grain: cohort by client create month.
- Permissions: `dashboard:read` + `clients:read` + `cases:read`.
- Scopes: `team/office`.

---

## Remove / Merge Recommendations (Moderate Strategy)

### Remove

1. Remove standalone dashboard `pipeline` chart as a distinct analytics concept.
- Reason: overlaps materially with `casesTrend` + `case-status` report.
- Replacement mapping: case mix and status analysis remains via improved `casesTrend` and report `case-status`.

### Merge

1. Merge case-mix analytics surfaces
- Merge strategy: treat dashboard case chart as "quick trend" and `case-status` report as drilldown/export view.
- UI copy: consistent naming and definitions across both.

2. Merge operations risk storytelling
- Merge strategy: keep priority cards (`overdue`, `dueToday`, `hearings7d`) and enrich risk context through improved trend views.
- Replacement mapping: no unique risk signal lost.

### Improve (not remove)

1. `tasksTrend`
- Current label says "completed vs overdue" while implementation is status distribution by created date.
- Action: either rename chart to "Task status mix" or change computation to true completed-vs-overdue trajectory.

2. `financeTrend`
- Current label says "Collections trend" while implementation is invoice status distribution.
- Action: either rename to "Invoice status mix" or compute true collections trend (cash in over time, with lag metrics).

3. `casesTrend` and `hearingsTrend`
- Align labels with actual measures or adjust measures to match current labels.

---

## Phase 1 Prioritized Rollout (4-6 Weeks)

Priority formula:
- Priority score = Impact x Permission-fit / Effort.

### Recommended Phase 1 shortlist

1. Fix metric-definition drift in existing charts (Week 1-2)
- Scope: `tasksTrend`, `financeTrend`, `casesTrend`, `hearingsTrend` naming/logic alignment.
- Why first: highest trust recovery, low-to-medium engineering effort.
- Backend: adjust group-by logic and labels in dashboard analytics service.
- Frontend: update chart titles/descriptions and i18n keys.

2. Add overdue trajectory + case aging buckets (Week 2-4)
- Scope: two high-actionability operational analytics with broad role value.
- Backend: new chart keys and queries.
- Frontend: chart rendering + table labels.
- Permissions: existing `tasks:read`, `cases:read` gates.

3. Add DSO/collection lag + void trend (Week 3-5)
- Scope: finance decision quality improvement with minimal new entities.
- Backend: invoice lifecycle aggregations.
- Frontend: finance chart cards in team/office scopes.
- Permissions: `invoices:read`.

4. Consolidate case-mix surfaces (Week 5-6)
- Scope: remove standalone `pipeline` concept; route users to unified case trend + report drilldown.
- Backend: drop/deprecate `pipeline` rule key after UI migration.
- Frontend: update analytics panel and links.

### Implementation notes by subsystem

- Backend APIs/interfaces/types:
  - Extend `DashboardChartKind` and analytics payload shape for added charts.
  - Add any new `/api/reports/<type>` endpoints only where exportable deep-dive is needed.
  - Keep permission checks explicit at route and chart-rule layers.

- Frontend:
  - Update report type selectors only for net-new built-in reports (do not bloat defaults).
  - Keep custom report builder as fallback for niche filters/slices.
  - Add i18n entries for new metric names, descriptions, and suppression/empty states.

- Exports:
  - Only add export templates for analytics promoted to built-in reports.
  - Do not add export formats for dashboard-only quick indicators unless a decision workflow requires it.

---

## Validation Test Scenarios

### Permission visibility

1. Verify each new analytic appears only when required permissions are present.
2. Verify no finance analytics are exposed without `invoices:read`.
3. Verify `my/team/office` scope behavior aligns with each metric contract.

### Metric integrity

1. Validate numerator/denominator and grain for every new KPI.
2. Validate date boundary behavior (`30d`, `90d`, month cutoffs).
3. Validate no join fanout and stable totals across filtered/unfiltered variants.

### Usability and decision support

1. Each kept/added analytic must map to at least one explicit decision and next action.
2. Merge/remove actions must preserve all unique decisions currently supported.
3. Validate chart labels match actual computation logic.

### Feasibility

1. Estimate backend query complexity per item (low/medium/high).
2. Estimate frontend UI/i18n impact per item.
3. Confirm selected Phase 1 items fit 4-6 weeks with current modules and permissions.

---

## Assumptions

- Permission-aware delivery is primary: analytics should follow granted capabilities, including custom roles.
- Moderate rationalization is in scope: remove only low-value/redundant analytics and consolidate overlaps.
- Custom report builder remains a strategic flexibility surface for non-core analytics needs.

## Source of truth

- `packages/backend/src/modules/dashboard/dashboard.routes.ts`
- `packages/backend/src/modules/dashboard/dashboard.registry.ts`
- `packages/backend/src/modules/dashboard/dashboard.service.ts`
- `packages/backend/src/modules/reports/reports.routes.ts`
- `packages/backend/src/modules/reports/reports.service.ts`
- `packages/backend/src/modules/reports/custom-reports.service.ts`
- `packages/frontend/src/routes/app/DashboardPage.tsx`
- `packages/frontend/src/routes/app/ReportsPage.tsx`
- `packages/shared/src/dtos/dashboard.ts`
- `packages/shared/src/dtos/reports.ts`
- `packages/frontend/src/components/shared/PermissionChecklist.tsx`
