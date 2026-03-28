# Billing and Invoicing

ELMS includes a complete billing module for creating invoices, recording payments, tracking expenses, and generating financial reports. All amounts default to Egyptian Pounds (EGP) but can be configured during setup.

---

## Creating an Invoice

1. In the sidebar, click **Billing**.
2. Click **New Invoice**.
3. Select the **Client** this invoice is for.
4. Optionally, select the **Case** the invoice relates to. (You can issue an invoice at the client level without linking it to a specific case.)
5. Add line items:
   - Click **Add Line Item**.
   - Enter the **Description** (for example, "Legal representation — Court of First Instance", or "Document review and drafting").
   - Enter the **Quantity** and **Unit Price**.
   - Repeat for each billable item.
6. Set the **Tax Percentage** if applicable (for example, 14% VAT).
7. Set a **Discount** if applicable (enter as a percentage or a fixed amount).
8. Review the calculated **Total** at the bottom.
9. Set the **Due Date** by which payment is expected.
10. Click **Save as Draft**.

The invoice is saved in **DRAFT** status and is not yet sent to the client. You can continue editing it before issuing.

> [!NOTE]
> Invoices in **DRAFT** status do not appear in financial reports as issued invoices. Only **ISSUED** or later statuses are counted as billable income.

---

## Invoice Statuses

| Status | Meaning |
|---|---|
| **DRAFT** | Created but not yet finalized or sent |
| **ISSUED** | Sent to the client; payment is now expected |
| **PARTIALLY_PAID** | At least one payment has been recorded, but the balance remains outstanding |
| **PAID** | The full invoice amount has been received |
| **VOID** | The invoice has been cancelled and excluded from all reports |

---

## Issuing an Invoice

Once an invoice is ready to send, issue it to make it official.

1. Open the invoice (from **Billing → Invoices → [invoice title]**).
2. Click **Issue Invoice**.
3. ELMS sets the **Issued Date** to today and changes the status to **ISSUED**.
4. Optionally, check the **Notify Client** box to send the client an email notification with the invoice details.
5. Click **Confirm**.

> [!NOTE]
> Issuing an invoice locks most of its fields. If you need to make changes after issuing, you must void the invoice and create a new one.

---

## Recording a Payment

When a client pays — in whole or in part — record the payment against the invoice.

1. Open the invoice.
2. Click **Add Payment**.
3. Enter the payment details:
   - **Amount**: The amount received.
   - **Payment Method**: Select from **Cash**, **Bank Transfer**, or **Card**.
   - **Reference Number**: Enter the bank transfer reference, cheque number, or any other tracking identifier (optional but recommended).
   - **Payment Date**: Defaults to today; change if the payment was received on a different date.
4. Click **Save**.

ELMS updates the invoice status automatically:
- If the payment covers the full remaining balance → status becomes **PAID**.
- If a balance still remains → status becomes **PARTIALLY_PAID**.

You can add multiple payments against a single invoice. Each payment appears in the payment history section of the invoice.

---

## Voiding an Invoice

If an invoice was issued in error or needs to be cancelled:

1. Open the invoice.
2. Click **Void Invoice**.
3. Confirm the action.

The invoice status changes to **VOID** and it is excluded from all financial reports and totals. Voiding cannot be undone. If you need a corrected invoice, create a new one.

---

## Expenses

Track costs your firm has incurred on behalf of clients or for firm operations.

1. In the sidebar, click **Billing**.
2. Click **Expenses**.
3. Click **New Expense**.
4. Fill in the details:
   - **Category**: Select the expense category (for example, Court Fees, Transportation, Expert Fees, Office Supplies).
   - **Amount**: The expense amount.
   - **Description**: A brief description of what the expense was for.
   - **Date**: The date the expense was incurred.
   - **Linked Case** (optional): Associate the expense with a case.
   - **Receipt**: Click **Attach Receipt** to upload a scan or photo of the receipt document.
5. Click **Save**.

Expenses appear in the **Expenses** section of Billing reports.

---

## Overdue Invoices

An invoice is overdue when its due date has passed and its status is still **ISSUED** or **PARTIALLY_PAID** — that is, it has not been fully paid or voided.

When an invoice becomes overdue, ELMS sends an **INVOICE_OVERDUE** notification to firm administrators. This allows the relevant person to follow up with the client.

> [!NOTE]
> Clients are not automatically notified when an invoice becomes overdue. Chasing payment remains the responsibility of the assigned team member.

---

## Financial Reports

Generate a summary of your firm's financial activity over any date range.

1. In the sidebar, click **Billing**.
2. Click **Reports**.
3. Select a **Date Range** (for example, the current month, the current quarter, or a custom range).
4. The report displays:
   - Total invoices issued
   - Total payments received
   - Outstanding (unpaid) balance
   - Total expenses recorded
   - Breakdown by case or client (optional)
5. Click **Export** to download the report as a PDF or spreadsheet for use in accounting software.

---

## Related Pages

- [Managing Clients](./05-managing-clients.md) — client records used for billing
- [Managing Cases](./06-managing-cases.md) — linking invoices to cases
- [Documents](./09-documents.md) — attaching receipts and supporting documents to expenses
- [Notifications](./11-notifications.md) — configuring overdue invoice alerts

## Source of truth

- `docs/_inventory/source-of-truth.md`

