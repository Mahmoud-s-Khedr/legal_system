# Tasks and Deadlines

The Tasks module in ELMS helps your firm track work items, assign them to team members, and ensure nothing falls through the cracks. Tasks can be standalone or linked to a specific case.

---

## Creating a Task

1. In the sidebar, click **Tasks**.
2. Click **New Task**.
3. Fill in the task details:
   - **Title**: A short, clear description of what needs to be done (for example, "Prepare witness statement for Al-Masri hearing").
   - **Description** (optional): Additional details, instructions, or background information.
   - **Priority**: Select the urgency level:
     - **LOW** — Can be done when time allows
     - **MEDIUM** — Should be completed within the normal working schedule
     - **HIGH** — Needs prompt attention
     - **URGENT** — Must be done immediately
   - **Due Date**: Select the date by which the task must be completed.
   - **Assigned To**: Select the team member responsible for completing the task.
   - **Linked Case** (optional): Associate the task with a specific case so it appears in that case's task list.
4. Click **Save**.

The task is now visible to the assigned team member in their **My Tasks** dashboard widget and in the Tasks list.

---

## Task Statuses

Every task moves through a defined set of statuses from creation to completion:

| Status | Meaning |
|---|---|
| **PENDING** | The task has been created but work has not started |
| **IN_PROGRESS** | The assigned person is actively working on it |
| **REVIEW** | Work is done and the task is awaiting review or approval |
| **DONE** | The task is complete |
| **CANCELLED** | The task is no longer needed |

---

## Updating a Task Status

You can update a task's status in two ways:

**Kanban view (drag and drop):**
1. In the Tasks list, click the **Board** view button to switch to Kanban layout.
2. Each column represents a status (Pending, In Progress, Review, Done).
3. Drag a task card from one column to another to update its status.

**Status dropdown (list or detail view):**
1. Open the task by clicking its title.
2. Click the **Status** dropdown.
3. Select the new status.
4. The change is saved immediately.

> [!NOTE]
> In Arabic (RTL) mode, the Kanban board columns run from right to left, matching the reading direction. The workflow is the same — drag tasks to the right to move them forward in the process.

---

## Filtering Tasks

The Tasks list can be filtered to help you focus on what matters most:

| Filter | What It Shows |
|---|---|
| **Assigned To** | Tasks assigned to a specific team member |
| **Priority** | Tasks of a specific priority level (Low, Medium, High, Urgent) |
| **Case** | Tasks linked to a specific case |
| **Status** | Tasks in a specific status (Pending, In Progress, etc.) |

You can combine multiple filters at the same time. Use the **Clear Filters** button to reset to the full list.

---

## Overdue Tasks

A task is considered overdue when its due date has passed and its status is still **PENDING**, **IN_PROGRESS**, or **REVIEW** — that is, it has not been completed or cancelled.

When a task becomes overdue, ELMS sends a **TASK_OVERDUE** notification to the assigned team member. This notification is delivered through whichever channels the user has enabled (in-app, email, or SMS).

> [!NOTE]
> To avoid overdue notifications, either complete the task (mark it as **DONE**) or cancel it (**CANCELLED**) before the due date if it is no longer needed.

---

## My Tasks — Dashboard Widget

The dashboard includes a **My Tasks** widget that shows tasks assigned specifically to you.

- Tasks are sorted by due date, with the most urgent appearing first.
- Overdue tasks are highlighted so you can identify them at a glance.
- Click any task in the widget to open it directly.

---

## Bulk Operations

You can act on multiple tasks at once from the Tasks list:

1. Tick the checkbox to the left of each task you want to act on (or tick the checkbox in the column header to select all visible tasks).
2. A bulk action toolbar appears at the top of the list.
3. Choose one of the available actions:
   - **Mark as Done** — closes all selected tasks
   - **Reassign** — opens a dialog to choose a new assignee for all selected tasks
4. Confirm the action.

> [!NOTE]
> Bulk operations affect all selected tasks at once. Double-check your selection before confirming, especially when using **Mark as Done**.

---

## Related Pages

- [Managing Cases](./06-managing-cases.md) — linking tasks to a case
- [Hearings and Calendar](./07-hearings-and-calendar.md) — scheduling court sessions (a related type of deadline)
- [Notifications](./11-notifications.md) — configuring how overdue task alerts are delivered
