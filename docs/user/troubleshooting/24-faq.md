# Frequently Asked Questions

---

## General

**Q: Can I use ELMS on my phone?**

A: The cloud edition is a Progressive Web App (PWA). Open it in your mobile browser and look for the browser prompt to "Add to Home Screen" — this installs an app-like shortcut that opens in full screen. A native mobile app is planned for a future release.

---

**Q: Does ELMS work without internet?**

A: The desktop edition works fully offline — all case management, documents, invoicing, and the Law Library are available without an internet connection. The cloud edition requires internet access to function. The AI Research feature requires internet in both editions (it calls the AI service to generate answers).

---

**Q: What languages does ELMS support?**

A: Arabic (right-to-left, the default), English, and French. To change your language, go to **Settings → Profile → Language** and select your preference. The firm administrator can set the default language for new users in **Settings → Firm**.

---

**Q: Is my data backed up?**

A: Cloud edition: your ELMS provider handles backups. Desktop edition: you are responsible for backing up your own data. Set up automated daily backups using the built-in backup script. See [Backup & Restore](../admin/20-backup-and-restore.md) for step-by-step instructions.

---

## Cases and Clients

**Q: Can a case have multiple clients?**

A: Each case has one primary client. To represent multiple parties, use the **Parties** tab inside the case to add plaintiffs, defendants, and other parties. If you are representing multiple clients on entirely separate but related matters, create a separate case for each client.

---

**Q: Can I reopen a closed case?**

A: Yes. Open the case, click on the **Status** field, and change it back to **Active**. All case history — documents, hearings, notes, invoices — is fully preserved and accessible.

---

**Q: Can two lawyers share the same case?**

A: Yes. Open the case, go to the **Assignments** tab, and click **Add Assignment**. Select the second lawyer and choose their role on the case: **Lead**, **Supporting**, **Paralegal**, or **Consultant**. Multiple team members can be assigned to the same case at once.

---

## Documents

**Q: How long does OCR processing take?**

A: For a typical text-based PDF, extraction completes within 1–2 minutes. For scanned documents (images of paper), OCR typically takes 3–5 minutes. Large scanned PDFs with 100 or more pages can take up to 15 minutes. The document is viewable by title at any time; full-text search works once the status shows **Indexed**.

---

**Q: Can I search inside Arabic documents?**

A: Yes. ELMS includes Arabic-aware full-text search. Search terms are automatically normalised — you do not need to worry about diacritics (tashkeel) or different alef variants (أ، إ، آ، ا). The search engine matches all relevant forms of your search term.

---

**Q: What is the maximum file size I can upload?**

A: 50 MB per document. If your document exceeds this limit, split it into sections using a PDF tool before uploading. See [Document Upload Errors](./22-document-upload-errors.md) for more options.

---

## Billing

**Q: Can I issue an invoice in a currency other than EGP?**

A: The default currency is EGP and it is configured at the firm level in **Settings → Firm**. The currency setting applies to all invoices for the entire firm. Per-invoice currency selection is not available in v1.0.

---

**Q: Can clients pay online through ELMS?**

A: Online payment via Connect Misr or Paymob is supported for cloud deployments. Contact your ELMS provider to configure a payment gateway for your firm.

---

## Team and Access

**Q: How do I remove a user who has left the firm?**

A: Go to **Users**, click the user's name, and click **Suspend**. This prevents the user from logging in while preserving all of their work records — cases, documents, tasks, and audit history — for the firm's permanent records. Do not delete user data; suspending is the correct action.

---

**Q: Can I give a user access to only specific cases?**

A: Not in v1.0. Permissions are role-based — a user either has access to all cases or no cases, depending on their role. Case-level access control (limiting a user to specific cases) is planned for a future release.

---

**Q: What happens if the Firm Admin leaves the firm?**

A: Before the admin leaves, they should promote at least one other team member to the **Firm Admin** role from the current user-management workflow. If the administrator account becomes inaccessible and no one else has admin access, contact your ELMS provider — they can help restore administrative access.

---

## AI Research

**Q: How accurate is the AI research assistant?**

A: The assistant generates answers based on the content of your firm's law library. It cannot answer questions about legislation or rulings that are not in your library. Always verify AI responses against the authoritative source text before using them in court filings or formal legal advice. The citations provided with each answer make it easy to check the source directly. The current frontend does not expose the AI Research screens, so access depends on your deployment workflow.

---

**Q: What happens when the monthly AI usage limit is reached?**

A: The Research feature displays a "Usage limit reached" message and no new queries can be submitted. The limit resets automatically at the start of the next calendar month. If your firm regularly reaches the limit, contact your firm administrator to request an increase from your ELMS provider.

---

**Q: Are my research questions and library content shared with other firms?**

A: No. Each firm's data — including library content, research sessions, and client information — is fully isolated from other firms. Anthropic (the provider of the underlying AI) receives only the text of your specific query and the relevant library excerpts needed to generate an answer. No other firm data is included in that communication.

---

## Related Topics

- [Login Issues](./21-login-issues.md)
- [Document Upload Errors](./22-document-upload-errors.md)
- [Desktop Connectivity](./23-desktop-connectivity.md)
- [Team Management](../advanced/15-team-management.md)
- [AI Research Assistant](../advanced/13-ai-research.md)
- [Backup & Restore](../admin/20-backup-and-restore.md)

## Source of truth

- `docs/_inventory/source-of-truth.md`

