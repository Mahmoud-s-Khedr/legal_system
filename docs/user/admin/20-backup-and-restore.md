# Backup and Restore (Desktop)

The desktop edition stores your firm data on your machine. You must keep backups to prevent permanent data loss.

> [!WARNING]
> If your computer fails and you do not have backups, your data cannot be recovered.

---

## How Desktop Backup Works

ELMS desktop includes built-in backup and restore in **Settings**.

- Backup files use the `.elmsbk` format.
- Each backup includes:
  - Database data
  - `uploads/` files (documents and attachments)
  - Backup metadata (`manifest.json`)
- Automated backups run from your configured policy (daily or weekly).
- Retention deletes older backups automatically once the configured count is exceeded.

---

## Configure Backup Policy

1. Open ELMS desktop.
2. Go to **Settings**.
3. In the **Backup** section:
   - Turn backup on/off.
   - Choose **Daily** or **Weekly**.
   - Set backup time.
   - If weekly, choose weekday.
   - Set retention count (number of backup files to keep).
4. Click **Save backup policy**.

You can also:

- **Choose backup folder** to set a custom location.
- **Reset backup folder** to return to the default location.

Default backup location:

- Linux/macOS: `~/elms-backups/`
- Windows: `C:\Users\YourName\elms-backups\`

---

## Run Manual Backup

1. Open **Settings**.
2. In the **Backup** section, click **Run backup now**.
3. Wait for the success message.

The new `.elmsbk` file appears in the backup folder and in the restore source list.

---

## Restore from Backup

> [!WARNING]
> Restore replaces current database and uploads data with the selected backup.

1. Open **Settings**.
2. In the **Backup** section, choose a file in **Restore source**.
3. Confirm both restore acknowledgements.
4. Click **Restore now**.
5. Wait for completion; desktop services restart automatically.

After restore, verify key records (for example a recent case and related documents).

### Admin Password Behavior After Restore

- ELMS preserves current machine **firm-admin** passwords during restore.
- Matching is by admin email within the same firm.
- If a current firm-admin email does not exist in the restored snapshot, ELMS recreates that admin account and keeps its current password.

### Schema Upgrade Behavior After Restore

- After every successful restore, ELMS forces a real migration check on next startup.
- ELMS does **not** trust cached local migration markers after restore.
- If pending migrations exist, ELMS runs them before normal runtime startup continues.
- If migration fails, startup stays in failed state and retries on next launch after issue resolution.

This behavior is designed to support restoring older backups into newer desktop releases.

### Direct Upgrade Compatibility Window

- Supported direct upgrades: backups whose schema version is covered by migration directories bundled with the current desktop release.
- Operational policy: preserve direct upgrades across all bundled migrations.
- If a backup is older than the bundled migration history, use a staged upgrade path (restore in an intermediate version, then upgrade forward).

---

## Recommended Routine

| Action | Frequency |
|--------|-----------|
| Automated backup policy enabled | Always |
| Manual backup before major changes | As needed |
| Copy `.elmsbk` files to external or off-device storage | Weekly |
| Test restore on a non-production copy | Monthly |

---

## Related Topics

- [Firm Settings](./18-firm-settings.md)
- [Desktop Connectivity](../troubleshooting/23-desktop-connectivity.md)

## Source of truth

- `docs/_inventory/source-of-truth.md`
