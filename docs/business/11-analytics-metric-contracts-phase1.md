# Phase 1 Analytics Metric Contracts

## Dashboard analytics

### tasksTrend (completed vs overdue)
- Formula: daily `completed_tasks_count` and `overdue_open_tasks_count`.
- Numerator(s):
  - `completed_tasks_count`: tasks with `status = DONE` grouped by `updatedAt` day.
  - `overdue_open_tasks_count`: tasks with `dueAt < now` and `status NOT IN (DONE, CANCELLED)` grouped by `dueAt` day.
- Denominator: not applicable (count series).
- Grain: day.
- Filters/scopes: dashboard range (`30d/90d`), `my/team/office` scope rules.
- Permissions: `tasks:read`.

### caseAgingBuckets
- Formula: count of open cases by age buckets (`0-30`, `31-60`, `61-90`, `90+`) where age = `now - createdAt` days.
- Grain: bucket.
- Filters/scopes: `my/team/office` scope rules.
- Permissions: `cases:read`.

### overdueTrajectory
- Formula: daily count of overdue open tasks by due date.
- Grain: day.
- Filters/scopes: dashboard range (`30d/90d`), `my/team/office` scope rules.
- Permissions: `tasks:read`.

### dsoCollectionLag
- Formula: average `days(paid_at - issued_at)` for invoices with `status = PAID`, grouped by month of final payment date.
- Numerator: sum of invoice-level collection days.
- Denominator: count of paid invoices in month.
- Grain: month.
- Filters/scopes: dashboard range (`30d/90d`), `team/office` scope.
- Permissions: `invoices:read`.

### invoiceVoidTrend
- Formula: monthly `void_count` and `void_amount` from invoices where `status = VOID`.
- Grain: month.
- Filters/scopes: dashboard range (`30d/90d`), `team/office` scope.
- Permissions: `invoices:read`.

## Reports

### dso-collection-lag
- Same contract as dashboard `dsoCollectionLag`.
- Permissions: `reports:read` + `invoices:read`.

### invoice-void-trend
- Same contract as dashboard `invoiceVoidTrend`.
- Permissions: `reports:read` + `invoices:read`.

### cashflow-monthly
- Formula: `net_cash = cash_in - cash_out` by month.
- Numerators:
  - `cash_in`: payments total by payment month.
  - `cash_out`: expenses total by expense creation month.
- Grain: month.
- Filters: `dateFrom/dateTo`.
- Permissions: `reports:read` + `invoices:read` + `expenses:read`.

### ar-aging
- Formula: invoice-level `balance_due = total_amount - paid_amount`, with aging bucket by days overdue.
- Buckets: `CURRENT`, `1_30`, `31_60`, `61_90`, `90_PLUS`.
- Grain: invoice.
- Filters: report table search/sort/page.
- Permissions: `reports:read` + `invoices:read`.

## Data quality checks performed in implementation
- Freshness: all aggregates are computed from live transactional tables (`Invoice`, `Payment`, `Expense`, `Task`, `Case`).
- Null handling: monetary aggregates use `COALESCE` defaults.
- Join fanout: finance report SQL aggregates by invoice/month before final projection.
- Time basis: all period slicing uses persisted timestamps in UTC-compatible `timestamptz` operations.
