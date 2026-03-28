# Login Issues

This page covers the most common problems with logging in and accessing your ELMS account.

---

## Cannot Log In — Wrong Password

- Passwords are **case-sensitive**. Check that Caps Lock is not active.
- Make sure you are entering the email address you used when you registered.
- If you have forgotten your password, ask your **firm administrator** to reset it for you through the available user-management workflow. They can then give you replacement login details directly.

> [!NOTE]
> Only firm administrators can reset passwords. There is no self-service "Forgot Password" option for firm user accounts in v1.0.

---

## Cannot Log In — Account Suspended

If you see a message indicating your account is suspended:

- Contact your firm administrator. They can reactivate your account from the user-management workflow in the current frontend.
- If you are the firm administrator and your own account has been suspended, contact your ELMS provider.

---

## Onboarding Link Or Access Problem

The current frontend does not expose invite-acceptance or invitation-resend screens.

If you cannot complete first-time access:

1. Contact your firm administrator or ELMS provider.
2. Ask them to confirm how your account was provisioned.
3. If needed, ask them to issue replacement login details through their onboarding process.

---

## Automatically Logged Out

ELMS keeps you logged in automatically as long as your browser tab remains open. Here is how the session works:

- Your access is refreshed automatically every 15 minutes while the browser tab is open.
- If you close the browser tab and return **within 30 days**, you are logged back in automatically.
- If you close the browser and do not return for **more than 30 days**, your session expires and you need to log in again manually.

If you are being logged out unexpectedly on a shorter timescale, check whether your browser is configured to clear cookies when it closes.

> [!TIP]
> On shared or public computers, always click **Sign Out** when you are finished to prevent the next person from accessing your account automatically.

---

## "Setup Is Already Complete" Error

This message appears on the first-time setup screen if you visit the setup URL after the firm already has an administrator account.

- The setup screen is available only once — when the firm's account is brand new and no administrator has been created yet.
- If someone else has already completed setup, contact that person (the first administrator) and ask them to provision access for you through the current onboarding process.

---

## Forgot Which Email Address Was Used

If you cannot remember the email address associated with your account:

- Ask your firm administrator. They can see team member account details in the user-management area.

---

## Two-Factor Authentication

> [!NOTE]
> Two-factor authentication (2FA) is planned for a future release and is not yet available in v1.0.

---

## Related Topics

- [Team Management](../advanced/15-team-management.md) — how administrators manage users and roles
- [FAQ — Team & Access](./24-faq.md#team-and-access)

## Source of truth

- `docs/_inventory/source-of-truth.md`
