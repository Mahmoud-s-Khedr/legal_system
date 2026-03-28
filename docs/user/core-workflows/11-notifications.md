# Notifications

ELMS keeps your team informed automatically by sending notifications when important events occur — upcoming hearings, overdue tasks, unpaid invoices, and more. The current frontend lets users manage the channels that are visible directly in the app.

---

## Notification Types

| Notification | When It Is Sent |
|---|---|
| **Hearing Reminder (7 days)** | Seven days before a scheduled court session |
| **Hearing Reminder (tomorrow)** | One day before a scheduled court session |
| **Hearing Reminder (today)** | On the morning of a scheduled court session |
| **Task Overdue** | When a task's due date has passed without it being completed or cancelled |
| **Invoice Overdue** | When an invoice's due date has passed without full payment (sent to firm admins) |
| **Document Indexed** | When a recently uploaded document has finished OCR processing and is fully searchable |
---

## Delivery Channels Visible In The Frontend

The current frontend exposes notification preferences for the channels below.

| Channel | Description | Available In |
|---|---|---|
| **In-App (bell icon)** | Notifications appear inside ELMS, visible by clicking the bell icon in the navigation bar | Both Desktop and Cloud |
| **Desktop OS Notification** | Your operating system's native notification popup (Windows toast, macOS Notification Center, Linux desktop notification) | Desktop App only |

> [!NOTE]
> In Arabic (RTL) mode, the bell icon for in-app notifications is in the top-left corner of the navigation bar. In English or French (LTR) mode, it appears in the top-right corner.

---

## Configuring Your Notification Preferences

You can control exactly which notifications you receive through the channels exposed in the current frontend UI.

1. Click your **profile avatar** in the navigation bar.
2. Go to **Settings → Notifications**.
3. You will see a grid with notification types listed in rows and delivery channels listed in columns.
4. Toggle each combination on or off:
   - A toggle that is **on** means ELMS will send that notification type via that channel.
   - A toggle that is **off** means you will not receive that notification type via that channel.
5. Changes are saved automatically as you make them.

For example, you may want hearing reminders shown in-app, but task overdue alerts shown only as desktop notifications on the desktop app.

---

## In-App Notifications

The bell icon in the navigation bar shows a badge with a count of unread notifications.

**To view your notifications:**
1. Click the **bell icon**.
2. A panel slides open showing your recent notifications, most recent at the top.
3. Click any notification to go directly to the relevant record (the case, task, or invoice).

**To mark notifications as read:**
- Click an individual notification to mark it as read.
- Click **Mark All as Read** at the top of the panel to clear all unread badges at once.

---

## Desktop OS Notifications

The desktop app can use your operating system's built-in notification system to alert you even when ELMS is minimized or running in the background.

| Operating System | Notification System |
|---|---|
| **Windows** | Toast notifications (appear in the bottom-right corner and in Action Center) |
| **macOS** | Notification Center (appear in the top-right corner and in the notification sidebar) |
| **Linux** | Desktop notifications (using the system's notification daemon, typically in the top-right or bottom-right corner depending on your desktop environment) |

Desktop OS notifications are only available in the ELMS desktop app. They are not available when using ELMS through a web browser.

**To enable desktop notifications:**
1. Go to **Settings → Notifications**.
2. Toggle on the **Desktop** column for the notification types you want.
3. Your operating system may ask for permission the first time — click **Allow**.

---

## Disabling Notifications

You can disable any notification type or delivery channel at any time without affecting your other settings.

1. Go to **Settings → Notifications**.
2. Toggle off the specific type/channel combination you no longer want.

You can re-enable it at any time by toggling it back on.

> [!NOTE]
> Email and SMS integrations still exist at the backend/infrastructure level, but they are not configurable from the current frontend UI and are therefore not covered in this user guide.

---

## Related Pages

- [Hearings and Calendar](./07-hearings-and-calendar.md) — hearing reminder notifications explained
- [Tasks and Deadlines](./08-tasks-and-deadlines.md) — task overdue notifications explained
- [Billing and Invoicing](./10-billing-and-invoicing.md) — invoice overdue notifications explained
- [Documents](./09-documents.md) — document indexed notifications explained

## Source of truth

- `docs/_inventory/source-of-truth.md`

