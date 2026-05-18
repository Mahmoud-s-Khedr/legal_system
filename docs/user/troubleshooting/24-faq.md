# Frequently Asked Questions

## Status

- `Implemented`: Answers below describe active desktop/local behavior and currently reachable UI-backed behavior.
- `Archived Reference`: Cloud-only operational claims are marked explicitly.
- `Planned`: Future cloud capabilities are labeled as planned.

---

## General

**Q: Can I use ELMS on my phone?**

A: `Archived Reference` — previous cloud/PWA guidance exists, but cloud runtime is currently non-operational. A future cloud rollout is planned; this FAQ will be updated when that runtime is active.

---

**Q: Does ELMS work without internet?**

A: Yes for desktop/local. The desktop edition works fully offline for case management, documents, invoicing, and law library workflows. AI Research requires internet access because it calls the external AI provider.

---

**Q: What languages does ELMS support?**

A: Arabic (right-to-left, default), English, and French. Language switching is available from user profile settings in the current frontend.

---

**Q: Is my data backed up?**

A: Desktop/local data protection is your responsibility. Use the documented backup and restore flow: [Backup & Restore](../admin/20-backup-and-restore.md).

---

## Cases and Clients

**Q: Can a case have multiple clients?**

A: Each case has one primary client. Related parties can be modeled through case-party workflows.

---

**Q: Can I reopen a closed case?**

A: Yes. Change the case status back to active in the case workflow.

---

**Q: Can two lawyers share the same case?**

A: Yes. Use case assignments to add multiple team members.

---

## Documents

**Q: How long does OCR processing take?**

A: Processing time varies by file type/size and whether OCR is required. Monitor document indexing status in the document workflow.

---

**Q: Can I search inside Arabic documents?**

A: Yes. Arabic-aware search is implemented in the document and library search flows.

---

**Q: What is the maximum file size I can upload?**

A: 50 MB per document by default (`MAX_UPLOAD_BYTES` default in backend env schema).

---

## Billing

**Q: Can I issue an invoice in a currency other than EGP?**

A: Firm-level currency settings apply. Per-invoice currency override depends on current frontend/backend behavior and your deployment configuration.

---

**Q: Can clients pay online through ELMS?**

A: `Archived Reference` — cloud-specific payment gateway claims are not part of the active desktop/local runtime.

---

## Team and Access

**Q: How do I remove a user who has left the firm?**

A: Suspend the user account so login is blocked while audit history and records are preserved.

---

**Q: Can I give a user access to only specific cases?**

A: Not currently; authorization is role/permission-based rather than per-case ACL.

---

**Q: What happens if the Firm Admin leaves the firm?**

A: Promote another admin first. If all admin access is lost, recover through your ELMS operator support path.

---

## AI Research

**Q: How accurate is the AI research assistant?**

A: It is a research aid grounded in your library content. Always verify outputs against primary legal sources before formal use.

---

**Q: What happens when the monthly AI usage limit is reached?**

A: New research requests are blocked until limit reset or policy change.

---

**Q: Are my research questions and library content shared with other firms?**

A: Firm data is tenant-scoped in application logic. External AI calls include only required prompt/context payload for the request.

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
- `packages/backend/src/config/env.ts`
- `packages/backend/src/modules/**/*.routes.ts`
- `packages/frontend/src/router.tsx`
