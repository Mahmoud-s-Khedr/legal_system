# Documents

ELMS provides a central document repository for your firm. You can upload files in any common format, and ELMS automatically extracts their text content so that every word in every document is searchable — including scanned PDFs and images.

---

## Uploading a Document

1. In the sidebar, click **Documents**.
2. Click **Upload**.
3. Add your file using one of two methods:
   - **Drag and drop**: drag the file from your computer into the upload area.
   - **Browse**: click **Choose File** and navigate to the file on your computer.
4. Fill in the document details:
   - **Title**: A clear, descriptive name for the document (for example, "Power of Attorney — Hassan Ibrahim — 2025").
   - **Linked Case** (optional): Associate this document with a specific case. You can also link it to a client without specifying a case.
   - **Linked Client** (optional): Associate with a client record directly.
   - **Document Type** (optional): Categorize the document (for example, Court Filing, Contract, Evidence, Correspondence).
5. Click **Save**.

ELMS uploads the file and immediately begins processing it for text extraction.

> [!NOTE]
> The maximum file size per upload is **50 MB**. If your file is larger, consider splitting it into sections or compressing it before uploading.

---

## Supported File Formats

ELMS accepts the following file types:

| Format | Description |
|---|---|
| **PDF** | The most common format for legal documents |
| **Word (.docx)** | Microsoft Word documents |
| **Excel (.xlsx)** | Spreadsheets and financial tables |
| **Image — JPG / JPEG** | Photographs and scanned pages |
| **Image — PNG** | Screenshots and graphic documents |
| **Image — TIFF** | High-resolution scanned documents |

---

## OCR — Automatic Text Extraction

After you upload a document, ELMS automatically reads it and extracts all of its text. This process is called OCR (Optical Character Recognition). It works on both digital documents (PDFs with selectable text) and scanned images.

**What to expect:**

- Immediately after upload, a **"Processing…"** indicator appears next to the document.
- Once the indicator disappears, the document is fully searchable.
- Processing typically takes between **1 and 5 minutes** depending on the document's size and number of pages.

> [!NOTE]
> While a document is processing, you can still view and download it. It simply will not yet appear in search results. Do not upload the same document twice if the processing indicator is still showing — wait for it to complete.

---

## Searching Documents

Full-text document search lets you find any word or phrase across all documents in your firm, even inside scanned images.

1. In the sidebar, click **Documents**.
2. Click the **Search** tab (or type in the search bar at the top of the Documents list).
3. Enter one or more keywords.
4. ELMS returns a list of matching documents. Each result shows:
   - The document title and linked case/client
   - A highlighted excerpt showing where your search term appeared in the document
5. Click a result to open the document.

> [!NOTE]
> Search works in Arabic, English, and French. For Arabic text, search is sensitive to letter forms — if a search is not returning expected results, try using a root word or fewer characters.

---

## Document Versions

If a document is updated (for example, a contract is revised or a court order is amended), you can upload the new version while keeping the history of all previous versions.

1. Click **Documents** in the sidebar and open the existing document.
2. Click the **Versions** tab.
3. Click **Upload New Version**.
4. Choose the updated file and click **Save**.

The latest version becomes the default when anyone opens the document. Previous versions remain accessible in the **Versions** tab and can be downloaded at any time.

---

## Linking Documents to Cases

A document can be linked to a case at the time of upload, or linked afterward.

**To link after upload:**
1. Open the document record.
2. Click **Edit**.
3. Use the **Linked Case** field to search for and select the relevant case.
4. Click **Save**.

Documents linked to a case also appear in the **Documents** tab within that case's record, making it easy to see all files related to a specific matter.

---

## Document Templates

Templates allow you to create reusable document structures — for example, a standard engagement letter, a standard power of attorney, or a court submission cover sheet.

**Creating a template:**
1. In the sidebar, click **Documents**.
2. Click **Templates**.
3. Click **New Template**.
4. Enter a **Template Name**.
5. In the body field, paste or type the template text. Use placeholders for information that will vary — for example, `{{client_name}}`, `{{case_number}}`, `{{date}}`.
6. Click **Save**.

**Using a template:**
1. When creating a new document from within a case, click **From Template**.
2. Select the template you want to use.
3. Fill in the variable fields.
4. ELMS generates the document with your placeholders replaced by the actual values.

> [!NOTE]
> Templates are available to all team members in your firm. Only firm administrators and senior lawyers can create or edit templates.

---

## Related Pages

- [Managing Cases](./06-managing-cases.md) — linking documents to cases
- [Managing Clients](./05-managing-clients.md) — linking documents to client records
- [Tasks and Deadlines](./08-tasks-and-deadlines.md) — assigning document preparation as a task
