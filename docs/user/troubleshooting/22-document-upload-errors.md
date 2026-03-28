# Document Upload Errors

This page covers common problems when uploading documents to ELMS and how to resolve them.

---

## "File Too Large" Error

The maximum file size per document is **50 MB**.

**To upload a document that exceeds this limit:**

- **Split the document**: use a PDF tool (such as Adobe Acrobat, PDF24, or iLovePDF) to divide the file into smaller sections of 50 MB or less. Upload each section separately.
- **Compress the document**: use a PDF compression tool to reduce the file size before uploading. This works best for documents with many scanned images.

---

## "Unsupported File Type" Error

ELMS accepts the following file formats:

| Format | Extension |
|--------|-----------|
| PDF | .pdf |
| Word (modern) | .docx |
| Excel | .xlsx |
| JPEG image | .jpg, .jpeg |
| PNG image | .png |
| TIFF image | .tif, .tiff |

**Common causes and fixes:**

- **Old Word format (.doc)**: the old `.doc` format is not supported. Open the file in Microsoft Word or LibreOffice Writer and use **File → Save As → Word Document (.docx)** to convert it, then upload the `.docx` file.
- **Password-protected PDF**: ELMS cannot process password-protected files. Open the PDF in Adobe Acrobat or another PDF tool, remove the password (usually under **File → Properties → Security**), save the file, and then upload it.
- **Other formats** (images like .bmp, .gif, or document formats like .odt): convert to PDF before uploading. Most operating systems and office applications can export to PDF.

---

## Document Stuck at "Processing…" for More Than 10 Minutes

After a document is uploaded, ELMS extracts the text (using OCR for scanned documents) so it can be searched. Most documents complete this within 1–5 minutes.

**If a document has shown "Processing…" for more than 10 minutes:**

**Cloud edition:**
- The background extraction worker may not be running. Contact your system administrator or ELMS provider to restart it.

**Desktop edition:**
- Close the ELMS desktop application completely and reopen it. The extraction process resumes automatically on startup.

**Large documents (100 or more pages):**
- Scanned PDFs with many pages can take 5–15 minutes to process. This is normal behaviour. Wait a bit longer before concluding there is a problem.

> [!NOTE]
> Documents can be browsed and opened by title while still in "Processing" status. Full-text search results will not include the document until extraction is complete and the status shows **Indexed**.

---

## OCR Text Is Inaccurate

OCR (Optical Character Recognition) converts scanned images into searchable text. The quality of the output depends on the quality of the scanned image.

**Common causes and improvements:**

| Cause | Fix |
|-------|-----|
| Low scan resolution | Re-scan at 300 DPI or higher |
| Skewed or rotated pages | Re-scan with the document flat and properly aligned |
| Faded or low-contrast ink | Re-scan with higher contrast settings |
| Handwritten text | Handwriting cannot be accurately recognised by the OCR system; type the content manually if needed |

**Better OCR for Arabic documents:**

If your firm has a **Google Vision API** key configured, it generally produces more accurate results for Arabic text than the default Tesseract OCR engine. Contact your firm administrator to check which OCR engine is currently active (**Settings → Firm → OCR Settings**).

---

## Document Appears in the List but Cannot Be Found by Search

If you uploaded a document and can find it by its title but keyword search does not return it:

1. Check the document's status. Open the document and look at the status indicator:
   - **Processing** — extraction is still in progress. Wait for it to complete.
   - **Indexed** — extraction is complete; the document should appear in search results.
   - **Failed** — extraction encountered an error. Try re-uploading the document.
2. If the status is **Indexed** but the document still does not appear in search, try clearing your browser cache and refreshing the page.

> [!TIP]
> While waiting for a document to finish processing, you can always find it by title in the document list view.

---

## Related Topics

- [Desktop Connectivity](./23-desktop-connectivity.md) — if the desktop app is not responding
- [Law Library](../advanced/12-law-library.md) — uploading documents to the firm library
- [FAQ — Documents](./24-faq.md#documents)

## Source of truth

- `docs/_inventory/source-of-truth.md`

