# Managing Cases

Cases are the central unit of work in ELMS. Every matter your firm handles — whether it is litigation, a corporate transaction, or a regulatory proceeding — lives in a case record. From a single case, you can track court stages, team assignments, hearings, documents, tasks, and billing.

---

## Opening a New Case

1. In the sidebar, click **Cases**.
2. Click **New Case**.
3. Fill in the required fields:
   - **Client**: Select the client this case belongs to. If the client does not yet exist, create them first in [Managing Clients](./05-managing-clients.md).
   - **Case Number**: Enter the official court-assigned case number.
   - **Case Title**: A short descriptive title for internal reference (for example, "Al-Masri vs. Cairo Real Estate Co.").
   - **Judicial Year**: The year the case was filed.
   - **Case Type**: Select from the available case types in your firm's system (for example, Civil, Criminal, Commercial, Family, Administrative).
4. Click **Save**.

The case record opens immediately. You can now add court stages, assign team members, schedule hearings, and upload documents.

---

## Case Statuses

Every case has a status that reflects where it currently stands. You can update a case's status at any time.

| Status | Meaning |
|---|---|
| **ACTIVE** | The case is ongoing and actively worked on |
| **SUSPENDED** | Work is paused (for example, pending client instructions) |
| **CLOSED** | The matter has concluded |
| **WON** | The case was decided in the client's favour |
| **LOST** | The case was decided against the client |
| **SETTLED** | The parties reached an out-of-court settlement |
| **ARCHIVED** | The case is no longer active and has been moved to archive |

**To change a case status:**
1. Open the case record by clicking the case title in the Cases list.
2. Click the **Status** dropdown near the top of the case detail.
3. Select the new status.
4. The change is saved immediately and logged in the case history.

---

## Court Assignment — Managing Court Stages

A case in Egypt may progress through multiple court levels. ELMS tracks each stage separately.

**Court stages available:**
- **Ibtidaei** (Court of First Instance)
- **Istinaf** (Court of Appeal)
- **Naqd** (Court of Cassation)

**To add a court stage:**
1. Open the case record.
2. Click the **Courts** tab.
3. Click **Add Court Stage**.
4. Select the **Court Level** (Ibtidaei, Istinaf, or Naqd).
5. Select the specific **Court Name** and **Circuit** if applicable.
6. Enter the **Filing Date**.
7. Click **Save**.

Each court stage can have its own hearing sessions scheduled against it. See [Hearings and Calendar](./07-hearings-and-calendar.md) for details.

---

## Team Assignment

Each case can have multiple team members assigned, each with a defined role.

| Assignment Role | Meaning |
|---|---|
| **LEAD** | The primary lawyer responsible for the case |
| **SUPPORTING** | A supporting lawyer assisting on the matter |
| **PARALEGAL** | A paralegal supporting with research and documents |
| **CONSULTANT** | An external or internal consultant providing specialist advice |

**To assign a team member:**
1. Open the case record.
2. Click the **Assignments** tab.
3. Click **Add Assignment**.
4. Select the **Team Member** from the dropdown (shows all active members in your firm).
5. Select their **Role** on this case.
6. Click **Save**.

Team members assigned to a case will see it listed in their personal dashboard and will receive case-related notifications.

---

## Case Parties

Record the parties involved in the litigation.

**To add a party:**
1. Open the case record.
2. Click the **Parties** tab.
3. Click **Add Party**.
4. Select the **Party Type**:
   - **Plaintiff** (المدعي)
   - **Defendant** (المدعى عليه)
   - **Opposing Counsel** (محامي الخصم)
5. Enter the party's name and contact details.
6. Click **Save**.

Parties are displayed on case detail screens and can be referenced in documents and reports.

---

## Status History

ELMS automatically records every status change, who made it, and when.

1. Open the case record.
2. Click the **History** tab.
3. A chronological list appears showing all status changes with the date, previous status, new status, and the name of the team member who made the change.

This audit trail is useful for compliance, supervision, and resolving any disputes about when a case's status changed.

---

## Tabs in the Case Detail View

Within an open case record, all related information is organized in tabs:

| Tab | What It Contains |
|---|---|
| **Overview** | Case summary, status, judicial year, and basic details |
| **Courts** | Court stages and their details |
| **Assignments** | Team members assigned to the case |
| **Parties** | Plaintiffs, defendants, and opposing counsel |
| **Sessions** | Scheduled court hearings |
| **Documents** | Files uploaded and linked to this case |
| **Tasks** | Tasks linked to this case |
| **Billing** | Invoices issued for this case |
| **History** | Full audit trail of status changes |

---

## Searching and Filtering Cases

The **Cases** list supports several ways to find cases quickly:

- **Free-text search**: Type a case number, client name, or title in the search bar at the top of the list.
- **Filter by status**: Use the **Status** filter to show only Active, Closed, Won cases, and so on.
- **Filter by assigned lawyer**: Use the **Assigned To** filter to see only the cases assigned to a specific team member.
- **Filter by date**: Narrow results by filing date or last activity date.

You can combine multiple filters at once.

---

## Related Pages

- [Managing Clients](./05-managing-clients.md) — create a client before opening a case
- [Hearings and Calendar](./07-hearings-and-calendar.md) — schedule court sessions for a case
- [Tasks and Deadlines](./08-tasks-and-deadlines.md) — create tasks linked to a case
- [Documents](./09-documents.md) — upload and manage case documents
- [Billing and Invoicing](./10-billing-and-invoicing.md) — issue invoices for a case
