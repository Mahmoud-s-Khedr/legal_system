# Cloud Access

This guide explains how to access a cloud-hosted ELMS instance through your web browser.

---

## Supported Browsers

ELMS works with any modern web browser. The following are recommended:

- Google Chrome
- Mozilla Firefox
- Apple Safari
- Microsoft Edge

> [!NOTE]
> Internet Explorer is not supported. If your organization uses Internet Explorer, please switch to Microsoft Edge, which is built into modern versions of Windows.

---

## Logging In

1. Open your browser and go to your firm's ELMS address. Your firm administrator will provide this — it typically looks like `https://yourfirmname.elms.app`.
2. The ELMS login screen appears. Enter your **Email Address** and **Password**.
3. Click **Sign In**.
4. You will be taken to the ELMS dashboard.

> [!NOTE]
> In Arabic mode, all form fields and the navigation sidebar appear on the right side of the screen, following the right-to-left layout. The login experience is otherwise identical.

---

## First-Time Users

The current frontend does not expose invite-acceptance screens. If this is your first time using a cloud ELMS deployment, obtain your account credentials and onboarding instructions directly from your firm administrator or ELMS provider, then sign in from the standard login screen.

---

## Staying Logged In

ELMS uses a secure session system. Your login session refreshes automatically while your browser tab is open — you will not be interrupted or asked to log in again during a working session.

If you close the browser and return later, you may be asked to log in again depending on how long you were away.

> [!NOTE]
> For security, ELMS access tokens expire after 15 minutes of inactivity, but they are renewed silently and automatically as long as the browser tab remains open. You will only see the login screen again if you deliberately sign out or close the browser for an extended period.

---

## Logging Out

1. Click your **profile avatar** (your initials or photo) in the top corner of the screen.
   - In Arabic (RTL) mode, the avatar is in the top-left corner.
   - In English or French (LTR) mode, the avatar is in the top-right corner.
2. Click **Sign Out** from the dropdown menu.
3. You are returned to the login screen.

---

## Forgot Your Password?

ELMS does not currently offer a self-service password reset link on the login screen. If you cannot log in:

1. Contact your firm administrator.
2. The administrator can reset your password through the user-management workflow available to them.
3. You will receive replacement login details directly from your administrator.

---

## Installing ELMS as an App (PWA)

If you use ELMS frequently, you can install it on your computer or phone as an app — without visiting the browser address bar each time. This is called a Progressive Web App (PWA).

**On Chrome or Edge (desktop):**

1. Look for the **install icon** (a small computer screen with a plus sign) in the browser's address bar.
2. Click it, then click **Install**.
3. ELMS opens in its own window and appears in your taskbar and Start Menu / Dock like a regular app.

**On Safari (iPhone / iPad):**

1. Tap the **Share** button (the box with an upward arrow) at the bottom of the screen.
2. Scroll down and tap **Add to Home Screen**.
3. Give it a name and tap **Add**.
4. ELMS now appears on your home screen.

**On Chrome (Android):**

1. Tap the browser menu (three dots in the top-right corner).
2. Tap **Add to Home Screen**.
3. Confirm, and ELMS appears on your home screen.

> [!NOTE]
> The PWA version of ELMS looks and behaves exactly like the browser version. It is simply a shortcut that opens ELMS in a dedicated window without the browser toolbar.

---

## Related Pages

- [First-Time Setup](./03-first-time-setup.md) — setting up your firm for the first time
- [Desktop Installation](./02-desktop-installation.md) — if you prefer the offline desktop app
- [Notifications](../core-workflows/11-notifications.md) — configuring the notification channels visible in the current frontend

## Source of truth

- `docs/_inventory/source-of-truth.md`

