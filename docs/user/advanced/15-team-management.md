# Team Management

> [!NOTE]
> The current frontend exposes user management, roles, and permissions. Invite-based team onboarding is not exposed in the current frontend UI.

---

## Team Access In The Current Frontend

The current frontend UI focuses on managing existing users:

- view the current user directory
- review an individual user's details
- change roles
- suspend or reactivate access
- manage custom roles and permissions

If your firm needs invite-based onboarding, handle that outside the current frontend UI.

---

## Roles

When a user account is provisioned for your firm, it is assigned a role that controls what the user can see and do in ELMS. There are five built-in roles:

| Role | Intended For |
|------|-------------|
| **Firm Admin** | Managing partner or office manager — full access to all settings and data |
| **Senior Lawyer** | Partner or senior associate — cases, clients, billing, and limited team management |
| **Junior Lawyer** | Associate — cases, tasks, and documents |
| **Paralegal** | Paralegal staff — tasks, documents, and limited case access |
| **Secretary** | Administrative staff — scheduling, lookups, and basic document handling |

You can also create **custom roles** tailored to your firm's specific needs. See [Custom Roles](#custom-roles) below.

For a detailed breakdown of what each role can access, see [Roles & Permissions](../admin/19-roles-and-permissions.md).

---

## Changing a User's Role

1. Go to **Users**.
2. Click the user's name.
3. Click **Change Role**.
4. Select the new role from the dropdown.
5. Click **Save**.

The change takes effect immediately — the user's permissions update the next time they load a page.

---

## Suspending a User

Suspending a user prevents them from logging in while keeping all of their work (cases, documents, tasks) intact in the firm's records. This is the correct action when a team member leaves the firm.

1. Go to **Users**.
2. Click the user's name.
3. Click **Suspend**.
4. Confirm the action.

The user's account is deactivated. Their data remains fully accessible to the rest of the team.

> [!TIP]
> Do not delete a user's data. Always use **Suspend** to preserve the historical record of their work.

---

## Reactivating a Suspended User

1. Go to **Users**.
2. Click the suspended user's name (you can filter the list by status to find suspended users).
3. Click **Reactivate**.

The user can log in again immediately with their existing password.

---

## Custom Roles

If the five built-in roles do not match your firm's structure, you can create custom roles with exactly the permissions you need.

### Creating a Custom Role

1. Go to **Settings** → **Roles**.
2. Click **New Role**.
3. Enter a name for the role.
4. Review the permission list. Each permission is listed under its category (Firm, Users, Cases, Documents, etc.).
5. Toggle each permission on or off according to the rights this role should have.
6. Click **Save**.

The new role is now available when assigning permissions to users or changing an existing user's role.

### Editing a Custom Role

1. Go to **Settings** → **Roles**.
2. Click the custom role's name.
3. Adjust the permission toggles as needed.
4. Click **Save**.

Changes take effect immediately for all users currently assigned to that role.

### Deleting a Custom Role

A custom role can only be deleted if no users are currently assigned to it. Reassign or suspend all users with that role before deleting it.

> [!NOTE]
> Built-in roles (Firm Admin, Senior Lawyer, Junior Lawyer, Paralegal, Secretary) cannot be deleted or modified.

---

## Permission Categories

When building a custom role, permissions are grouped into the following categories:

- **Firm** — view and edit firm settings
- **Users** — view and manage team members
- **Roles** — create and edit custom roles
- **Cases** — create, view, edit, and close cases
- **Clients** — create and manage clients
- **Hearings** — schedule and manage hearings
- **Tasks** — create and manage tasks
- **Dashboard** — view the main dashboard
- **Documents** — upload and manage documents
- **Reports** — run and export reports
- **Lookups** — manage dropdown values (court names, case types, etc.)
- **Invoices** — create and manage invoices
- **Expenses** — record and manage expenses
- **Templates** — create and manage document templates
- **Library** — access and manage the Law Library

---

## Related Topics

- [Roles & Permissions](../admin/19-roles-and-permissions.md) — full permission reference for each built-in role
- [Login Issues](../troubleshooting/21-login-issues.md) — what to do if a user cannot log in
- [FAQ — Team & Access](../troubleshooting/24-faq.md#team--access)
