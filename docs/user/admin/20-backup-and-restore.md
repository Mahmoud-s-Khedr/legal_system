# Backup and Restore

Protecting your firm's data is critical. The approach to backup depends on which edition of ELMS you are using.

---

## Cloud Edition

In the cloud edition, your data is stored and managed by your ELMS provider. Backups are handled on the server side.

- Contact your ELMS provider to request a data export or restore.
- Your provider can supply backup copies of your data if needed.

You do not need to perform any backup steps yourself for the cloud edition.

---

## Desktop Edition

In the desktop edition, your data is stored locally on your computer. **You are responsible for backing it up.** Without a backup, hardware failure or accidental deletion could result in permanent data loss.

> [!WARNING]
> The desktop edition stores all data locally. If your computer fails and you have no backup, your data cannot be recovered. Set up automated backups as described below.

---

### What Is Backed Up by the Backup Script

The backup script saves all firm data stored in the embedded database:

- Clients, cases, hearings, tasks
- Invoices and expenses
- Library documents and annotations
- Audit logs and system settings

**Document files** (PDFs, scanned images) are stored separately in the `uploads/` folder inside the ELMS installation directory. Back up this folder independently (copy it to an external drive or cloud storage) alongside the database backups.

---

### Backup Location

By default, backup files are saved to the `elms-backups` folder in your home directory:

- **Linux / macOS**: `~/elms-backups/`
- **Windows**: `C:\Users\YourName\elms-backups\`

Each backup file is named with a timestamp, for example: `elms-backup-2026-03-23T020000.sql.gz`

To change the backup location, open `scripts/backup-postgres.sh` in a text editor and update the backup directory path near the top of the file.

---

### Running a Manual Backup

1. Open a terminal (on Windows: Command Prompt or PowerShell).
2. Navigate to your ELMS installation directory. For example:
   ```
   cd /home/yourname/elms
   ```
3. Run the backup script:
   ```
   bash scripts/backup-postgres.sh
   ```
4. A timestamped `.sql.gz` file is created in the backup directory. Note the file name for your records.

---

### Setting Up Automated Daily Backups (Linux / macOS)

Running a backup manually every day is easy to forget. Set up a scheduled task to run it automatically.

**On Linux or macOS**, use cron:

1. Open a terminal and run:
   ```
   crontab -e
   ```
2. Add the following line (adjust the path to match your ELMS installation directory):
   ```
   0 2 * * * /path/to/elms/scripts/backup-postgres.sh
   ```
3. Save and close the editor.

This runs the backup every day at 2:00 AM. You will find a new backup file in `~/elms-backups/` each morning.

> [!TIP]
> Also copy your backup files to an external drive or cloud storage service (such as Google Drive or a USB drive) regularly. A backup stored only on the same computer as the original data does not protect against hardware failure or theft.

---

### Restoring from a Backup

Use this procedure to restore your data from a backup file — for example, after hardware replacement or to recover from accidental data loss.

> [!WARNING]
> **Restoring a backup overwrites all current data in the database. This cannot be undone.** Ensure you are restoring the correct backup file and that you have considered whether any data created after that backup will be lost.

**Steps:**

1. Stop the ELMS desktop application completely (close the app window and ensure background processes have stopped).
2. Open a terminal and navigate to your ELMS installation directory.
3. Run the restore script, providing the path to your backup file:
   ```
   bash scripts/restore-postgres.sh /path/to/elms-backup-2026-03-23T020000.sql.gz
   ```
4. Wait for the restore to complete. A confirmation message is displayed when done.
5. Restart the ELMS desktop application.
6. Verify your data by opening a recent case and confirming the information looks correct.

---

### Recommended Backup Routine

| Action | Frequency |
|--------|-----------|
| Automated database backup (backup script) | Daily |
| Copy `uploads/` folder to external storage | Weekly |
| Copy backup files to off-site or cloud storage | Weekly |
| Test a restore in a separate environment | Monthly |

---

## Related Topics

- [Firm Settings](./18-firm-settings.md) — other administrator options
- [Desktop Connectivity](../troubleshooting/23-desktop-connectivity.md) — if the desktop app is not starting correctly
