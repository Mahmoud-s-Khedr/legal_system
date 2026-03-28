# Firm Settings

This section covers the configuration options available to **Firm Admin** users. These settings apply to your entire firm — all team members are affected by changes made here.

> [!NOTE]
> All options described in this guide require the **Firm Admin** role. If you cannot access Settings, contact your firm administrator.

---

## Accessing Settings

Click your **avatar** (your initials or profile picture) in the top-right corner of the screen, then click **Settings**. Alternatively, click **Settings** directly in the left sidebar if it is visible.

---

## Firm Profile

The firm profile controls the name and regional settings that appear throughout the application.

1. Go to **Settings** → **Firm**.
2. Update any of the following fields:
   - **Firm Name** — the name displayed in the app, reports, and invoices
   - **Firm Type** — for example: Law Firm, In-House Legal, Individual Practitioner
   - **Default Language** — sets the default interface language for new users (Arabic, English, or French)
   - **Timezone** — affects how dates and times are displayed and when scheduled tasks run
   - **Currency** — the default currency used for invoices and expense records
3. Click **Save**.

> [!TIP]
> Individual users can override the language in their own profile settings (**Settings → Profile → Language**) without affecting the firm-wide default.

---

## Subscription and Edition

1. Go to **Settings** → **Subscription**.
2. View your current **edition tier** and **expiry date**.

Edition tiers and their typical use:

| Edition | Description |
|---------|-------------|
| Solo Offline | Single user, desktop app, fully offline |
| Solo Online | Single user, cloud access |
| Local Firm Offline | Multi-user, desktop app, offline |
| Local Firm Online | Multi-user, cloud access |
| Enterprise | Unlimited users, all features |

To upgrade your edition or renew your subscription, contact your ELMS provider.

---

## Firm Lifecycle Status

Your firm's account has a lifecycle status displayed in **Settings → Subscription**:

| Status | What It Means |
|--------|---------------|
| **Active** | Normal operation — all features available |
| **Grace** | Subscription has expired; all existing data is readable but new records cannot be created. Contact your provider to renew. |
| **Suspended** | Account suspended by the provider. Contact your provider immediately. |

> [!WARNING]
> During the **Grace** period, your data is safe and readable, but your team cannot create new cases, invoices, or other records until the subscription is renewed.

---

## Lookup Tables

Lookups are the dropdown lists used throughout the application — court names, case types, expense categories, and similar reference values. Managing them centrally ensures your whole team uses consistent terminology.

1. Go to **Settings** → **Lookups**.
2. Select the lookup category you want to manage (for example: **Court Names** or **Case Types**).
3. To add a new option: click **Add** → type the value → click **Save**.
4. To edit an existing option: click it → change the text → click **Save**.
5. To deactivate an option (hide it from dropdowns without deleting it): click it → toggle **Active** to off → click **Save**. Existing records that use the deactivated value are unaffected.

---

## Email Configuration

ELMS sends transactional emails (invitations, notifications, portal invites) using the email settings you provide.

Email integration exists at the backend/infrastructure level, but an email-configuration screen is not exposed in the current frontend UI.

> [!TIP]
> If your deployment relies on outbound email, manage that configuration outside the current frontend workflow.

---

## SMS Configuration

SMS notifications (for hearing reminders and client alerts) require a Twilio account.

SMS integration exists at the backend/infrastructure level, but an SMS-configuration screen is not exposed in the current frontend UI.

---

## Google Calendar Integration

Sync ELMS hearing dates and deadlines with a Google Calendar so your team can see them in their existing calendar tools.

Google Calendar integration exists at the backend level, but the connect/disconnect controls are not exposed in the current frontend UI.

> [!NOTE]
> If your deployment uses Google Calendar sync, manage it outside the current frontend workflow.

---

## Related Topics

- [Roles & Permissions](./19-roles-and-permissions.md) — who can access and modify firm settings
- [Backup & Restore](./20-backup-and-restore.md) — protecting your firm's data (desktop edition)
- [Team Management](../advanced/15-team-management.md) — managing users and roles in the current frontend

## Source of truth

- `docs/_inventory/source-of-truth.md`

