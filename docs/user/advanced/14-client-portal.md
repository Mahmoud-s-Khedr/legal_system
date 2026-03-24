# Client Portal

> [!NOTE]
> The portal browsing and login UI still exists, but portal invite onboarding is not exposed in the current frontend UI.

The Client Portal gives your clients a secure, read-only window into their own cases. Clients can see their case status, shared documents, and upcoming hearing dates without needing to call or email the firm for routine updates.

---

## What Clients Can See

Once a client has been invited to the portal, they can view:

- Their own cases (status, key dates, assigned lawyer)
- Documents that your firm has explicitly shared with them
- Upcoming hearing dates for their cases

Clients **cannot** create, edit, or delete anything. They see only data that belongs to them and only documents you have chosen to share.

---

## Inviting a Client to the Portal

Portal invite onboarding is not currently exposed in the frontend UI. If your firm uses the client portal, coordinate portal access provisioning outside the current frontend workflow.

---

## Sharing Documents with the Portal

By default, documents are not visible to the client. You must explicitly share each document.

1. Open the document you want to share (either from **Documents** or from within the case).
2. Find the **Share with Portal** toggle in the document details panel.
3. Switch the toggle to **On**.

The document immediately becomes visible to the linked client when they next log in to the portal.

To stop sharing a document, switch the same toggle back to **Off**.

---

## Revoking Portal Access

If a client should no longer have access to the portal (for example, after a matter is concluded):

1. Go to **Clients** → click the client's name → **Portal** tab.
2. Click **Revoke Access**.
3. Confirm the action.

The client can no longer log in. Their portal account is deactivated, but all firm records about the client remain intact.

---

## Resending Portal Access

Because portal invite onboarding is not exposed in the current frontend UI, expired or failed portal access should be handled through your administrator or ELMS provider's provisioning process.

---

## The Client Login Experience

The client portal is accessed at a separate URL from the firm's main ELMS application. Your ELMS provider will supply this URL.

When the client logs in:
- They enter their email address and the portal password they were given during onboarding.
- They see only their own cases and any documents you have shared.
- If they forget their password, they can use the **Forgot Password** link on the portal login page to receive a reset email.

> [!NOTE]
> If a client is locked out and cannot complete access through the current portal login flow, direct them to your administrator or ELMS provider for assistance.

---

## Related Topics

- [Team Management](./15-team-management.md) — managing firm users and their access
- [FAQ — Cases & Clients](../troubleshooting/24-faq.md#cases--clients)
