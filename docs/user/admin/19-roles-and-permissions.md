# Roles and Permissions

ELMS controls what each team member can see and do through a role-based permission system. Every user is assigned one role. Roles can be one of the five built-in system roles, or a custom role created by your firm.

> [!NOTE]
> Managing roles and permissions requires the **Firm Admin** role.

---

## Built-In Roles

The five built-in roles cover the most common positions in a law firm. They cannot be deleted or modified.

| Role | Typical User | Key Permissions |
|------|-------------|----------------|
| **Firm Admin** | Managing partner, office manager | All permissions — full access to settings, data, and team management |
| **Senior Lawyer** | Partner, senior associate | Cases, clients, billing, documents, reports, limited team management |
| **Junior Lawyer** | Associate | Cases, tasks, documents, research |
| **Paralegal** | Paralegal | Tasks, documents, limited case access |
| **Secretary** | Administrative staff | Scheduling (hearings), lookups, basic document handling |

---

## Permission Categories

Permissions are grouped into the following categories. Each category can be individually granted or restricted when creating a custom role.

| Category | Controls Access To |
|----------|--------------------|
| **Firm** | View and edit firm profile and settings |
| **Users** | View and manage team members |
| **Roles** | Create and edit custom roles |
| **Invitations** | Send and manage team invitations |
| **Cases** | Create, view, edit, and close cases |
| **Clients** | Create and manage client records |
| **Hearings** | Schedule and manage hearings |
| **Tasks** | Create and manage tasks |
| **Dashboard** | View the main dashboard |
| **Documents** | Upload, view, and manage documents |
| **Reports** | Run built-in and custom reports |
| **Research** | Use the AI Research assistant |
| **Lookups** | Manage dropdown reference values |
| **Invoices** | Create and manage invoices |
| **Expenses** | Record and manage expenses |
| **Templates** | Create and manage document templates |
| **Library** | Access and manage the Law Library |

---

## Creating a Custom Role

Custom roles let you define exactly the permissions a particular position in your firm requires.

1. Go to **Settings** → **Roles**.
2. Click **New Role**.
3. Enter a descriptive name for the role (for example: "Billing Manager" or "Trainee Lawyer").
4. Review each permission category and toggle individual permissions **on** or **off**.
5. Click **Save**.

The new role is immediately available when inviting users or changing an existing user's role.

> [!TIP]
> Start with the built-in role closest to what you need, note its permissions, and then build your custom role with adjustments. The built-in role descriptions above give a good starting point.

---

## Assigning a Role to a User

1. Go to **Settings** → **Team**.
2. Click the user's name.
3. Click **Change Role**.
4. Select the desired role (built-in or custom) from the dropdown.
5. Click **Save**.

The change takes effect immediately.

---

## Editing a Custom Role

1. Go to **Settings** → **Roles**.
2. Click the custom role's name.
3. Adjust the permission toggles as needed.
4. Click **Save**.

> [!WARNING]
> Changes to a custom role take effect immediately for **all users** currently assigned to that role. If you are making a significant change, consider creating a new role and migrating users to it rather than editing the existing one.

---

## Deleting a Custom Role

A custom role can only be deleted when no users are currently assigned to it.

1. Reassign or suspend all users currently holding the role (see [Team Management](../advanced/15-team-management.md)).
2. Go to **Settings** → **Roles**.
3. Click the custom role's name.
4. Click **Delete Role**.
5. Confirm the deletion.

> [!NOTE]
> Built-in roles cannot be deleted.

---

## Related Topics

- [Team Management](../advanced/15-team-management.md) — inviting users and changing their roles
- [Firm Settings](./18-firm-settings.md) — other administrator configuration options
- [FAQ — Team & Access](../troubleshooting/24-faq.md#team-and-access)

## Source of truth

- `docs/_inventory/source-of-truth.md`
