# Data Import

The Data Import tool lets you migrate existing client and case records into ELMS from spreadsheets, another legal software, or paper records that have been digitised. This is typically used once during initial setup, but can also be used to add large batches of records at any time.

> [!NOTE]
> Data import requires the **Firm Admin** role. If you do not have access to the import tool, contact your firm administrator.

---

## What Can Be Imported

| Data Type | Notes |
|-----------|-------|
| Clients | Contact information, client type, and notes |
| Cases | Case title, type, status, dates, assigned lawyer, and linked client |
| Contacts | Third-party contacts (opposing counsel, witnesses, etc.) |

Document files (PDFs, scanned papers) cannot be imported in bulk through this tool. Upload documents individually through each case after the import is complete.

---

## Import Process

### Step 1: Download the Template

1. Go to **Settings** → **Import**.
2. Select the data type you want to import (Clients, Cases, or Contacts).
3. Click **Download Template**.

The template is an Excel (.xlsx) file. The first row contains column headers; the second row shows example values to guide you.

### Step 2: Fill in the Template

Open the template in Excel or any compatible spreadsheet application (LibreOffice Calc, Google Sheets).

- Fill in one record per row starting from row 3.
- Required columns are marked in the header row. Leave optional columns blank if you do not have the information.
- Do not change the column headers or add new columns — the importer expects the exact layout of the template.
- Save the file in Excel format (.xlsx) when you are done.

> [!TIP]
> Prepare your data in batches by type (all clients first, then cases). Cases reference clients by name, so import clients before cases to avoid broken links.

### Step 3: Upload the File

1. Return to **Settings** → **Import**.
2. Select the same data type as your template.
3. Click **Upload** and select your completed Excel file.
4. ELMS validates the file and shows a preview of the first rows.

### Step 4: Review the Preview

The preview screen shows:
- **Valid rows** — records ready to import (shown in green)
- **Error rows** — rows with missing required data or invalid values (shown in red with a description of each error)
- **Duplicate flags** — rows where a matching record may already exist

Review the preview carefully before continuing.

### Step 5: Confirm the Import

Click **Confirm Import** to begin processing.

- Small imports (under 1,000 records) complete within a minute. A success message is shown when done.
- Large imports (over 1,000 records) are processed in the background. You will receive an in-app notification when the import is complete.

---

## Handling Duplicates

If the importer detects a client with the same name as an existing record, it flags that row for your decision. For each flagged row, you choose one of three actions:

| Action | Result |
|--------|--------|
| **Skip** | Do not import this row — keep the existing record unchanged |
| **Merge** | Add the imported data to the existing record (fills in any blank fields) |
| **Create as New** | Import as a separate new record even though the name matches |

---

## Handling Errors

Rows with invalid data (for example, a missing required field or an unrecognised date format) appear in the error report after the preview step.

1. Download the error report by clicking **Download Error Rows**.
2. Open the downloaded file — it contains only the rows that failed, with an additional column explaining each error.
3. Fix the errors in the spreadsheet.
4. Re-upload only the corrected rows (do not include the previously successful rows again — they have already been imported).

Common error causes:
- Date columns not in the expected format (use YYYY-MM-DD)
- Required fields left blank
- A referenced lawyer name does not match any team member in your firm

---

## After the Import

1. Go to **Clients** to review the imported client records.
2. Go to **Cases** to review the imported cases and verify that they are linked to the correct clients.
3. If something looks incorrect, contact your ELMS provider's support team. Imports can be rolled back within 24 hours of completion.

> [!WARNING]
> Importing the same file twice will create duplicate records. If you need to fix errors, use the error-row re-upload process rather than re-uploading the entire file.

---

## Related Topics

- [Firm Settings](../admin/18-firm-settings.md) — set up your firm profile before importing
- [Team Management](./15-team-management.md) — ensure all lawyers referenced in case data are already in the system before importing

## Source of truth

- `docs/_inventory/source-of-truth.md`

