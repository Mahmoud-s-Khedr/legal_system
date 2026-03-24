# ELMS — Deployment Models

---

## Overview

ELMS is available in two deployment configurations that share the same underlying codebase and feature set. The choice between them is driven by a firm's internet access, data sovereignty requirements, IT capabilities, and budget preference — not by the features they need.

---

## Side-by-Side Comparison

| Aspect | Cloud SaaS | Desktop Perpetual License |
|---|---|---|
| **How it is accessed** | Browser on any device (Windows, macOS, Linux, tablet) | Installed application on Windows or macOS |
| **Internet required** | Yes — for all features | No — fully functional offline |
| **Where data is stored** | Vendor-managed cloud infrastructure | On the firm's own computer or local server |
| **Data sovereignty** | Data handled by vendor per Terms of Service | Complete — data never leaves the firm's premises |
| **Pricing model** | Monthly or annual subscription per firm | One-time perpetual license payment |
| **Optional support plan** | Included in subscription | Optional annual plan for updates and support |
| **Multi-user support** | Yes — all team members access via browser | Yes — multiple users on the same local network |
| **Maximum users** | Determined by subscription tier | Determined by license tier |
| **Installation** | None — open browser and log in | One-click installer (database and runtime bundled) |
| **IT department required** | No | No |
| **Database** | Managed cloud PostgreSQL | PostgreSQL bundled in the installer |
| **Runtime dependencies** | None on client side | Node.js runtime bundled in the installer |
| **Software updates** | Automatic — applied by vendor | Over-the-air updater (firm approves and applies) |
| **Backups** | Managed by vendor | Firm's responsibility (backup tools provided) |
| **Disaster recovery** | Vendor-managed | Firm's responsibility |
| **Email notifications** | Vendor-configured (SMTP or Resend) | Firm configures own SMTP server |
| **SMS notifications** | Included (via Twilio) | Available (requires Twilio credentials and internet) |
| **Desktop OS push notifications** | Not applicable | Yes — native Windows and macOS notifications |
| **AI Research Assistant** | Full (Claude API key required) | Full (Claude API key required; only AI queries need internet) |
| **OCR document extraction** | Offline OCR + cloud Google Vision option | Offline OCR (Tesseract.js) — no cloud needed |
| **Google Calendar sync** | Yes | Yes (requires internet for sync) |
| **Egyptian payment gateways** | Yes (Connect Misr, Paymob) | Yes (Connect Misr, Paymob) |
| **Client portal access** | Yes — clients log in via browser | Yes — clients access over local network |
| **Audit log** | Yes | Yes |
| **Uptime responsibility** | Vendor | Firm |
| **Suitable firm size** | 2 to 200+ lawyers | Solo practitioners to ~50 lawyers |
| **Best for** | Firms with reliable internet and no data sovereignty concerns | Firms with data sovereignty requirements, unreliable internet, or preference for a one-time purchase |

---

## Cloud SaaS — Detailed Profile

### How It Works

The law firm subscribes to ELMS and immediately accesses the platform through a web browser. No software is installed. New team members are invited by the firm administrator and receive access within minutes. All data is stored on ELMS-managed infrastructure with automatic backups and redundancy.

### Who It Is For

Cloud SaaS is the right choice for:

- Firms with more than one office location, where team members need remote access
- Firms that want automatic software updates and vendor-managed infrastructure
- Firms that are comfortable with data hosted off-premises under a contractual data processing agreement
- Firms that prefer a predictable monthly or annual subscription expense over a capital expenditure

### Pricing Approach

Subscription tiers are structured by firm size (number of active user accounts). All tiers include the full feature set. Higher tiers provide higher monthly AI query allowances and priority support.

### What the Vendor Handles

On Cloud SaaS, ELMS manages: server infrastructure, database maintenance, automated backups, disaster recovery, software updates, security patches, SSL certificates, and uptime monitoring. The firm's team focuses entirely on legal work.

---

## Desktop Perpetual License — Detailed Profile

### How It Works

The firm purchases a license and downloads a platform-specific installer (Windows or macOS). The installer bundles everything the software needs: a PostgreSQL database engine and a Node.js runtime. No additional software needs to be installed or configured by the firm. The installer runs, and within minutes the full ELMS platform is available on the local machine.

For multi-user setups, the desktop application can be configured to run as a local server accessible to other machines on the same office network.

### Who It Is For

Desktop is the right choice for:

- Solo practitioners and small firms who prefer a one-time purchase over a subscription
- Firms in locations with unreliable or expensive internet connectivity
- Firms with data sovereignty requirements (government contractors, firms handling highly sensitive matters) who cannot place client data on third-party servers
- Firms whose principals are simply more comfortable owning their software outright

### What "Zero IT Dependencies" Means in Practice

The phrase "zero IT dependencies" is a concrete technical claim. The installer contains:

1. The ELMS application (frontend and backend)
2. A PostgreSQL database engine configured and initialized automatically
3. A Node.js runtime — the execution environment for the backend

When the installer finishes, the firm's staff open ELMS from the desktop shortcut. There is no configuration step, no server to provision, no database administrator required. If the computer is reformatted, the installer is run again and data is restored from the firm's backup.

### Updates on Desktop

Desktop users receive update notifications within the application. Updates are reviewed and applied by the firm administrator at a time of their choosing — a feature that appeals to firms who do not want vendor-initiated changes to their workflow tools.

### Data Ownership

On the Desktop product, the firm's data is stored in a local PostgreSQL database on their own hardware. ELMS, as a vendor, has no access to this data at any time. No telemetry, no remote access, no data transmission — unless the firm explicitly uses internet-dependent optional features (AI queries, Google Calendar sync, SMS notifications).

---

## Feature Parity: A Strategic Decision

ELMS made a deliberate architectural decision to build both products from the same codebase. This means:

- Every feature released in the cloud product is available to desktop users
- There is no "lite" desktop version with features removed to drive cloud upgrades
- Maintenance and development costs are contained — one product to build and test

This is unusual in the software industry, where vendors typically restrict desktop products to force cloud migration. For ELMS, parity is a selling point: desktop customers are not second-class users.

---

## Choosing the Right Deployment Model

**Choose Cloud SaaS if:**
- The firm has reliable broadband internet
- The firm has multiple practice groups or remote users
- The firm values zero infrastructure management
- The firm prefers operational (subscription) expenses over capital expenses

**Choose Desktop Perpetual License if:**
- The firm requires all data to remain on-premises
- The firm is in a location with unreliable internet
- The firm prefers a one-time payment
- The firm has a solo practitioner or small team comfortable with self-managed backups

**Both options can coexist:** A firm can begin on Desktop and migrate to Cloud (or vice versa) — the data model is identical, and ELMS provides migration tooling.
