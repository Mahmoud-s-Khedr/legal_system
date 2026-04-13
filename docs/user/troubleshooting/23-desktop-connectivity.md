# Desktop Connectivity

This page covers issues specific to the ELMS desktop application, including startup problems, offline behaviour, and data questions.

---

## App Launches but Shows "Cannot Connect to Server"

When the ELMS desktop app starts, it launches an embedded database and a local backend server. On the first launch of the day (or if the computer was idle for a while), this startup process takes a moment.

**What to do:**

1. Wait **15–30 seconds** and then refresh the page. The server is usually ready within this time.
2. If the error is still showing after 30 seconds, close the application completely (including any background processes) and reopen it.
3. Wait up to **1 minute** after relaunching before concluding there is a problem.

If the error persists beyond 2 minutes, restart your computer and try again. If the problem continues after a restart, contact your ELMS provider.

---

## "Database Not Ready" Error on Startup

This message means the embedded PostgreSQL database (which runs on port 5433) is still initialising. This is normal behaviour on the first launch of the day or after the computer has been asleep.

**What to do:**

1. Wait up to **2 minutes**. The app will automatically proceed once the database is ready.
2. If the message remains after 2 minutes, restart your computer and launch the app again.

> [!NOTE]
> The embedded database uses port 5433 on your computer. If another application is using that port, the desktop app will not start correctly. Contact your ELMS provider if you suspect a port conflict.

### Linux Diagnostic Logs

If startup keeps failing on Linux, collect these files before contacting support:

- `~/.local/share/com.elms.desktop/logs/desktop-bootstrap.log`
- `~/.local/share/com.elms.desktop/logs/postgres.log`

These logs include the exact bootstrap phase, `pg_ctl` command failures, and PostgreSQL server output.

### Linux Startup Repair (Version Mismatch / Upgrade Failures)

If startup fails after upgrading ELMS, the app may detect that the old local PostgreSQL data directory was created by a different PostgreSQL major version.

Use the **Repair startup** action in the startup error dialog. The app will:

1. Move the existing local cluster directory into `~/.local/share/com.elms.desktop/postgres-backups/`.
2. Recreate a fresh compatible local PostgreSQL cluster.
3. Restart the local runtime.

> [!WARNING]
> Repair startup does not perform an automatic in-place PostgreSQL major upgrade.  
> Always keep regular backups before upgrades so you can restore old data manually if needed.

---

## Working Without Internet Access

The desktop app is designed to work fully offline. The following features are available without an internet connection:

- All case management (cases, clients, hearings, tasks, documents)
- Invoicing and expenses
- Law Library browsing and search
- Reports

**Features that require an internet connection:**

| Feature | Requires Internet | Behaviour When Offline |
|---------|-------------------|------------------------|
| Automatic app updates | Yes | Updates are skipped; the app continues to run on the current version |

---

## Data Entered While Offline Is Not Syncing

The desktop edition stores all data locally on your computer. There is **no cloud sync** — this is by design for the offline desktop model.

- Data you enter in the desktop app stays on that computer.
- If you need to access your data from multiple devices or locations, use the **cloud edition** instead.

> [!NOTE]
> If you need to move to the cloud edition, contact your ELMS provider. They can assist with migrating data from the desktop to the cloud.

---

## App Shows Old Data After a Restore

If you have just restored a database backup and the app is still showing outdated information:

1. If you are using the app inside a browser window (some desktop configurations use an embedded browser): clear the browser cache using **Ctrl+Shift+Del** (Windows/Linux) or **Cmd+Shift+Del** (macOS), then refresh the page.
2. Close the ELMS desktop application completely and reopen it.

The app reloads all data fresh from the database on startup.

See [Backup & Restore](../admin/20-backup-and-restore.md) for the full restore procedure.

---

## Desktop App Will Not Update

The desktop app checks for updates automatically when it starts, using the update server configured by your ELMS provider.

**If auto-update fails:**

1. Note the current version number (visible in **Settings → About** or in the app title bar).
2. Download the latest installer from your ELMS provider's download page.
3. Run the new installer. Your data is preserved — the installer updates the application files without touching the database or uploaded documents.

> [!TIP]
> Before updating, it is good practice to run a manual backup: `bash scripts/backup-postgres.sh`. See [Backup & Restore](../admin/20-backup-and-restore.md).

---

## Related Topics

- [Backup & Restore](../admin/20-backup-and-restore.md) — how to protect and recover your desktop data
- [Document Upload Errors](./22-document-upload-errors.md) — if documents are stuck processing
- [FAQ](./24-faq.md) — general questions about offline use and editions

## Source of truth

- `docs/_inventory/source-of-truth.md`
