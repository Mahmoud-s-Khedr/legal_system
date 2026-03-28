# Reports

ELMS includes a set of built-in reports covering the most common firm analytics needs, as well as a custom report builder for creating your own views of firm data.

> [!NOTE]
> Access to Reports requires the Reports permission. If you cannot see the **Reports** section in the sidebar, contact your firm administrator. See [Roles & Permissions](../admin/19-roles-and-permissions.md).

---

## Running a Built-In Report

1. Click **Reports** in the left sidebar.
2. Select a report type from the list (see [Available Reports](#available-built-in-reports) below).
3. Set the date range using the **From** and **To** date pickers.
4. Click **Run**.
5. Results appear in a table or chart below.

---

## Available Built-In Reports

| Report Name | What It Shows |
|-------------|---------------|
| Cases by Status | Count of cases grouped by their current status (Active, Closed, etc.) |
| Cases by Assigned Lawyer | Workload distribution across team members |
| Invoices by Status | Invoices grouped by Paid, Unpaid, Overdue, and Draft |
| Payments Received | All payments collected within the selected date range |
| Expenses by Category | Total spending broken down by expense category |
| Overdue Invoices | Invoices past their due date with amounts outstanding |
| Hearing Schedule | Upcoming hearings within the selected date range |

---

## Exporting Reports

Most reports can be exported after running them.

1. Run the report as described above.
2. Click **Export to PDF** to download a print-ready PDF copy.
3. Click **Export to Excel** to download the data as a spreadsheet for further analysis.

> [!TIP]
> The Excel export includes all rows regardless of any visible pagination. Use it when you need the complete dataset.

---

## Custom Reports

The custom report builder lets you create, save, and rerun your own reports with specific filters and column selections.

### Creating a Custom Report

1. Click **Reports** in the sidebar.
2. Click **Custom Reports**.
3. Click **New Report**.
4. Choose the **Report Type** (for example: Cases, Invoices, or Clients).
5. Set your **Filters** — narrow the data by date range, assigned lawyer, status, or other available fields depending on the report type.
6. Choose the **Columns** you want to include in the output.
7. Click **Save** to name and save the report configuration.
8. Click **Run** to generate the report.

### Running a Saved Custom Report

1. Go to **Reports** → **Custom Reports**.
2. Click the saved report name.
3. Click **Run**.

Saved custom reports can be edited at any time by clicking the report name and adjusting the settings.

---

## Dashboard Widgets

The main dashboard gives you a live summary of key firm metrics without needing to run a full report:

- **Open Cases** — total number of currently active cases
- **Upcoming Hearings** — hearings scheduled in the next 7 days
- **Outstanding Invoices** — total value of unpaid and overdue invoices
- **Recent Activity** — a feed of recent changes across cases, tasks, and documents

Dashboard widgets update in real time as your team works.

---

## Scheduled Reports

> [!NOTE]
> Automated report scheduling (emailing a report on a set schedule) is planned for a future release and is not available in the current version.

---

## Related Topics

- [Firm Settings](../admin/18-firm-settings.md) — configure currency and firm details that appear in reports
- [Roles & Permissions](../admin/19-roles-and-permissions.md) — who can access reports

## Source of truth

- `docs/_inventory/source-of-truth.md`

