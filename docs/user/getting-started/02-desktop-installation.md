# Desktop Installation

This guide walks you through installing the ELMS desktop app on your computer. The desktop app works fully offline and includes everything it needs — no separate server or database setup is required.

---

## System Requirements

Before installing, confirm your computer meets these minimum requirements:

| Requirement | Minimum |
|---|---|
| **Memory (RAM)** | 4 GB |
| **Disk Space** | 2 GB free |
| **Operating System** | Windows 10 or later, macOS 11 (Big Sur) or later, or a modern Linux distribution |

---

## Step 1 — Download the Installer

1. Go to the ELMS releases page (your firm administrator or IT contact will provide the exact link).
2. Find the latest release at the top of the list.
3. Download the installer file that matches your operating system:
   - **Windows**: a file ending in `.exe`
   - **macOS**: a file ending in `.dmg`
   - **Linux**: a file ending in `.AppImage`, `.deb`, or `.rpm`

> [!NOTE]
> Always download from the official releases page. Do not install ELMS from unofficial sources.

---

## Step 2 — Install on Your Operating System

### Windows

1. Double-click the downloaded `.exe` file.
2. Windows will show a **User Account Control (UAC)** prompt asking whether you want to allow the app to make changes. Click **Yes**.
3. The ELMS Setup Wizard will open. Click **Next** to proceed through each step.
4. Choose an installation folder or accept the default, then click **Install**.
5. When the wizard finishes, click **Finish**. ELMS will appear in your Start Menu and optionally on your Desktop.

> [!NOTE]
> If your organization uses Windows Defender SmartScreen and it warns that the publisher is unknown, click **More info** and then **Run anyway**. This message is normal for software that has not yet accumulated widespread telemetry.

### macOS

1. Double-click the downloaded `.dmg` file. A window opens showing the ELMS icon alongside your **Applications** folder.
2. Drag the ELMS icon into the **Applications** folder.
3. Close the installer window. You can now eject the `.dmg` from the sidebar in Finder.
4. Open your **Applications** folder and double-click **ELMS** to launch it for the first time.
5. macOS will show a **Gatekeeper** prompt saying the app was downloaded from the internet. Click **Open** to confirm you want to run it.

> [!NOTE]
> If macOS says it cannot verify the developer, go to **System Settings → Privacy & Security**, scroll down, and click **Open Anyway** next to the ELMS entry.

### Linux

ELMS is available in three Linux formats. Use whichever format your distribution supports.

**AppImage (works on most distributions):**

1. Right-click the downloaded `.AppImage` file and choose **Properties**.
2. Go to the **Permissions** tab and tick **Allow executing file as program** (or equivalent on your desktop environment).
3. Double-click the file to launch ELMS. No installation is required — the AppImage runs directly.

**Debian/Ubuntu (.deb package):**

1. Open a terminal in the folder where you downloaded the file.
2. Run: `sudo dpkg -i elms-*.deb`
3. ELMS will appear in your application launcher.

**Red Hat/Fedora (.rpm package):**

1. Open a terminal in the folder where you downloaded the file.
2. Run: `sudo rpm -i elms-*.rpm`
3. ELMS will appear in your application launcher.

---

## Step 3 — First Launch

1. Open ELMS from your Start Menu, Applications folder, or launcher.
2. On the very first launch, ELMS initializes its embedded database. **This may take 10 to 15 seconds.** A loading screen will be displayed during this time — please do not close the app.
3. Once initialization is complete, the ELMS setup wizard appears and guides you through creating your firm profile.

> [!NOTE]
> After the first launch, ELMS starts almost instantly. The 10–15 second wait only happens once.

---

## Update Model

Desktop releases are distributed as full installers. To upgrade ELMS, download and run the newer installer for your platform.

---

## Next Steps

- Complete your firm profile in the setup wizard — see [First-Time Setup](./03-first-time-setup.md)
- Review your users and roles after setup via **Users** and **Settings → Roles**

## Source of truth

- `docs/_inventory/source-of-truth.md`

