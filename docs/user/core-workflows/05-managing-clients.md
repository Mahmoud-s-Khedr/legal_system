# Managing Clients

ELMS keeps a central record of all your firm's clients. Each client record holds their contact information, linked cases, documents, invoices, and any powers of attorney your firm holds on their behalf.

---

## Client Types

ELMS supports three types of clients:

| Type | Description | Key Identifier |
|---|---|---|
| **Individual** | A natural person | National ID number |
| **Company** | A private sector legal entity | Commercial registration number and tax number |
| **Government** | A government authority or public body | Official reference number |

The client type you choose determines which fields appear on the client form.

---

## Adding a New Client

1. In the sidebar, click **Clients**.
   - In Arabic (RTL) mode, the sidebar is on the right side of the screen.
2. Click **New Client** (top-right of the list in LTR mode; top-left in RTL mode).
3. Select the **Client Type** (Individual, Company, or Government).
4. Fill in the required fields:
   - **Full Name / Company Name**
   - **National ID** (Individual) or **Commercial Register Number** and **Tax Number** (Company)
   - **Phone Number**
   - **Email Address** (optional but recommended for portal invitations)
   - **Governorate** — select the relevant Egyptian governorate
   - **Address** (optional)
5. Add any notes in the **Notes** field.
6. Click **Save**.

The new client now appears in your client list and is ready to be linked to cases.

> [!NOTE]
> For company clients, both the commercial registration number and the tax number are required to generate legally compliant invoices. Make sure these are entered accurately.

---

## Adding Client Contacts

A single client record can have multiple contact persons — for example, a company client may have a legal affairs manager, a finance contact, and an executive contact.

1. Open the client record by clicking the client's name in the list.
2. Click the **Contacts** tab.
3. Click **Add Contact**.
4. Enter the contact's **Name**, **Phone Number**, and their **Role** within the organization (for example, "Legal Director" or "Authorized Signatory").
5. Click **Save**.

You can add as many contacts as needed. The primary client record (name, email) is separate from these additional contacts.

---

## Editing a Client Record

1. In the **Clients** list, click the client's name to open their record.
2. Click the **Edit** button.
3. Update any fields as needed.
4. Click **Save**.

All changes are saved immediately. ELMS keeps an internal record of when the client was last updated.

---

## Searching for a Client

The **Clients** list includes a search bar at the top of the page.

1. Click **Clients** in the sidebar.
2. Type the client's name, national ID, commercial register number, or any part of their contact information into the search bar.
3. The list filters in real time to show matching clients.

> [!NOTE]
> Search is case-insensitive and works in Arabic, English, and French. You do not need to type the exact name; partial matches are returned.

---

## Archiving a Client

Archiving removes a client from the active list without permanently deleting their record. All linked cases, documents, and invoices are preserved.

1. Open the client's record.
2. Click the **Actions** menu (the three-dot icon).
3. Select **Archive Client**.
4. Confirm the action.

Archived clients are hidden from the default client list. A firm administrator can view and restore archived clients by enabling the **Show Archived** filter in the Clients list.

---

## Inviting a Client to the Client Portal

The Client Portal allows your clients to log in themselves and view the status of their cases, upcoming hearing dates, and shared documents.

Portal invite onboarding is not currently exposed in the frontend UI. If your firm uses the client portal, coordinate client portal access outside the current frontend workflow.

> [!NOTE]
> The client can only see cases they are linked to — they cannot view other clients' matters. See [Client Portal](../advanced/14-client-portal.md) for the current portal-access notes.

---

## Power of Attorney

If your firm holds a power of attorney (PoA) on behalf of a client, you can record it in ELMS and optionally link it to specific cases.

1. Open the client's record.
2. Click the **Power of Attorney** tab.
3. Click **Add PoA**.
4. Select the **PoA Type**:
   - **General** — broad authority to act on behalf of the client
   - **Special** — authority limited to a specific matter or act
   - **Litigation** — authority to represent the client in court proceedings
5. Enter the PoA number, issue date, and issuing authority.
6. Optionally, link the PoA to one or more cases using the **Linked Cases** field.
7. Click **Save**.

---

## Related Pages

- [Managing Cases](./06-managing-cases.md) — opening a case and linking it to a client
- [Billing and Invoicing](./10-billing-and-invoicing.md) — creating invoices for clients
- [Client Portal](../advanced/14-client-portal.md) — current portal-access behavior and limitations

## Source of truth

- `docs/_inventory/source-of-truth.md`

