# ELMS Architecture — 06: Deployment Topologies

---

## 1. Overview

ELMS supports two fundamentally different deployment topologies that share a single codebase. This document describes each topology in detail, including service diagrams, Docker Compose configuration, environment variables, and operational considerations.

| Dimension | Cloud | Desktop |
|---|---|---|
| Packaging | Docker Compose | Tauri 2 AppImage / .deb / .rpm / NSIS / .dmg |
| External access | Public HTTPS (Nginx + certbot) | localhost only |
| Auth mode | `CLOUD` (JWT + Redis) | `LOCAL` (file-backed session, no Redis) |
| Multi-tenancy | Yes (multiple firms per deployment) | No (single firm per installation) |
| Storage | `r2` (production) or `local` (dev) | `local` |
| Extraction jobs | BullMQ + Redis + Worker process | Inline (`setImmediate`) |
| PostgreSQL port | 5432 | 5433 |
| Internet required | Yes | No (offline capable) |

---

## 2. Cloud Topology

### 2.1 Architecture Diagram

```mermaid
graph TD
    subgraph "Internet"
        Browser["User Browser"]
        DNS["DNS / Load Balancer"]
    end

    subgraph "Docker Host"
        Nginx["nginx:1.27-alpine\n:8080 (dev) / :443 (prod)\nReverse proxy + TLS"]

        subgraph "App Containers"
            Frontend["frontend container\nnode:22-alpine\nVite dev / static\n:5173"]
            Backend["backend container\nnode:22-alpine\nFastify 5\n:7854"]
            Worker["extraction-worker\nnode:22-alpine\nBullMQ Worker\nconcurrency: 3"]
        end

        subgraph "Data Containers"
            PG["postgres:16-alpine\nelms_cloud DB\n:5432"]
            Redis["redis:7-alpine\n:6379\nRefresh tokens + job queue"]
        end
    end

    subgraph "External Services"
        R2["Cloudflare R2\nObject Storage"]
        Anthropic["Anthropic Claude API"]
        Sentry["Sentry"]
    end

    Browser --> DNS --> Nginx
    Nginx -->|"static assets"| Frontend
    Nginx -->|"/api/*"| Backend
    Backend --> PG
    Backend --> Redis
    Backend -->|"enqueue job"| Redis
    Worker -->|"dequeue job"| Redis
    Worker --> PG
    Backend --> R2
    Worker --> R2
    Backend --> Anthropic
    Backend --> Sentry
    Frontend --> Sentry
```

### 2.2 Docker Compose Services (Development)

The development `docker-compose.yml` defines the following services:

| Service | Image | Port | Command |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | `5432` | Default PostgreSQL entrypoint |
| `redis` | `redis:7-alpine` | `6379` | Default Redis entrypoint |
| `backend` | `node:22-alpine` | `7854` | `pnpm dev:cloud` |
| `frontend` | `node:22-alpine` | `5173` | Vite dev server |
| `nginx` | `nginx:1.27-alpine` | `8080` | Reverse proxy config |

The backend and frontend containers mount the repository source tree as a volume and run the development servers with hot-reload. The `nginx` container forwards:
- `/*` → `frontend:5173`
- `/api/*` → `backend:7854`

### 2.3 Production Variant

`docker-compose.prod.yml` overrides the development configuration:

- **Nginx**: Adds certbot/Let's Encrypt volumes for HTTPS termination. Port 443 exposed externally, port 80 redirects to 443.
- **Frontend**: Vite build output (`dist/`) is copied into the Nginx container as static files. The `frontend` container is not deployed separately in production.
- **Backend**: Runs `node dist/server.js` (compiled TypeScript) rather than `pnpm dev:cloud`.
- **Worker**: Runs `node dist/jobs/extractionWorker.js` as a separate container.
- All containers use image tags from the GitHub Container Registry (built by CI).

### 2.4 Cloud Environment Variables

```bash
# ── Runtime ──────────────────────────────────────────────────────────────────
NODE_ENV=production
AUTH_MODE=CLOUD
PORT=7854

# ── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://elms:<password>@postgres:5432/elms_cloud

# ── Redis ────────────────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ── JWT (RS256) ───────────────────────────────────────────────────────────────
# Must be set in production. Auto-generated in dev.
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."

# ── Cookies ───────────────────────────────────────────────────────────────────
COOKIE_DOMAIN=.elms.example.com
COOKIE_SECRET=<random-32-char-secret>

# ── CORS ──────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS=https://app.elms.example.com

# ── Storage ───────────────────────────────────────────────────────────────────
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-key-id>
R2_SECRET_ACCESS_KEY=<r2-secret>
R2_BUCKET_NAME=elms-documents
R2_PUBLIC_URL=https://documents.elms.example.com

# ── AI Research ───────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...
AI_MONTHLY_LIMIT=500

# ── OCR ───────────────────────────────────────────────────────────────────────
GOOGLE_VISION_API_KEY=<google-api-key>   # optional; falls back to Tesseract

# ── Notifications ─────────────────────────────────────────────────────────────
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@elms.example.com
SMTP_PASS=<smtp-password>
# OR use Resend:
RESEND_API_KEY=re_...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=<token>
TWILIO_FROM_NUMBER=+1234567890

# ── Monitoring ────────────────────────────────────────────────────────────────
SENTRY_DSN=https://...@sentry.io/...

# ── Rate limiting ─────────────────────────────────────────────────────────────
TRUST_PROXY=true

# ── Frontend (Vite build-time) ────────────────────────────────────────────────
VITE_APP_LOCALE=ar
VITE_API_BASE_URL=https://app.elms.example.com
VITE_SENTRY_DSN=https://...@sentry.io/...
```

---

## 3. Desktop Topology

### 3.1 Architecture Diagram

```mermaid
graph TD
    subgraph "User's Machine (OS)"
        subgraph "Tauri Application Process"
            RustShell["Tauri 2 Rust Shell\nNative window manager\nOS API access\nRuntime supervision"]
            WebView["System WebView\nReact 18 SPA\nTanStack Router\nTauri JS APIs"]
        end

        subgraph "Child Process (sidecar)"
            Sidecar["Node.js 22 sidecar\nFastify 5\ndist/server.js\n:7854"]
        end

        subgraph "Data (user home)"
            EmbPG["Embedded PostgreSQL 16\n~/.local/share/com.elms.desktop/postgres\n:5433"]
            LocalFiles["Local File Storage\n~/.local/share/com.elms.desktop/uploads"]
        end
    end

    subgraph "Optional External"
        Anthropic["Anthropic Claude API\n(online editions only)"]
    end

    WebView <-->|"Tauri IPC"| RustShell
    WebView -->|"HTTP /api/*\nlocalhost:7854"| Sidecar
    RustShell -->|"spawn + supervise"| Sidecar
    Sidecar --> EmbPG
    Sidecar --> LocalFiles
    Sidecar -->|"AI research\n(if online edition)"| Anthropic
```

### 3.2 Tauri Rust Shell Responsibilities

The Rust shell performs the following at startup:
1. Start the embedded PostgreSQL process on port 5433. Wait for it to accept connections.
2. Run Prisma migrations against the embedded PostgreSQL (`prisma migrate deploy`).
3. Spawn the Node.js sidecar (`dist/desktop/server.js`) as a supervised child process.
4. Verify backend identity with a per-launch bootstrap token echoed by `/api/health` before marking runtime ready.
5. Open the main window and load the React WebView.

On shutdown, the Rust shell sends `SIGTERM` to the Node.js sidecar, waits for graceful shutdown, then stops the embedded PostgreSQL process.

### 3.3 Node.js Sidecar Bundle

The Fastify backend is compiled into a single file using `tsup` for desktop deployment:

- **Entry**: `packages/backend/src/server.ts`
- **Output**: `packages/backend/dist/desktop/server.js`
- **Bundled**: All npm dependencies except the following, which remain external:
  - `@prisma/client` — must stay external; Prisma Client includes native binaries
  - `tesseract.js` — contains WebAssembly modules and worker scripts
  - `@napi-rs/canvas` — native Node.js addon
  - `@fastify/swagger` — large optional dependency, not needed in desktop

External dependencies are bundled into the Tauri application package by the Cargo build scripts.

### 3.4 Release Distribution

Desktop releases are distributed as full platform installers (`.AppImage`, `.deb`, `.rpm`, `.exe`, `.dmg`). The current release flow does not use the Tauri updater plugin or an OTA manifest service.

### 3.5 Desktop Environment Variables

Desktop environment variables are embedded at build time and/or read from a `.env` file co-located with the sidecar binary. They are not user-configurable in production builds.

```bash
# ── Runtime ──────────────────────────────────────────────────────────────────
NODE_ENV=production
AUTH_MODE=LOCAL
PORT=7854

# ── Database ─────────────────────────────────────────────────────────────────
# Port 5433 to avoid conflict with any system PostgreSQL on 5432
DATABASE_URL=postgresql://elms@localhost:5433/elms_desktop

# ── Storage ───────────────────────────────────────────────────────────────────
STORAGE_DRIVER=local
LOCAL_STORAGE_PATH=/home/<user>/.local/share/com.elms.desktop/uploads
LOCAL_SESSION_STORE_PATH=/home/<user>/.local/share/com.elms.desktop/sessions/local-session-store.json

# ── No Redis — LOCAL auth mode uses file-backed sessions ──────────────────────
# REDIS_URL is not set

# ── AI Research (optional, online editions only) ──────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...   # absent for offline editions
AI_MONTHLY_LIMIT=200

# ── Monitoring (optional — disabled for offline builds) ──────────────────────
VITE_SENTRY_DSN=               # empty disables Sentry

```

Release workflows build installer artifacts directly and verify bundled runtime resources before publishing those artifacts.

---

## 4. CI/CD Build Matrix

ELMS uses GitHub Actions with three platform-specific build workflows for desktop artifacts:

| Workflow | Platform | Output |
|---|---|---|
| `build-linux.yml` | Ubuntu (GitHub-hosted) | AppImage, `.deb`, `.rpm` |
| `build-windows.yml` | Windows (GitHub-hosted) | NSIS installer (`.exe`) |
| `build-macos.yml` | macOS (GitHub-hosted) | Native arm64 `.dmg` and native x86_64 `.dmg` |

Each workflow:
1. Installs Rust toolchain (with target triples for cross-compilation on macOS)
2. Installs Node.js 22 + pnpm 10
3. Bundles the system PostgreSQL 16 and Node.js 22 runtime for the target platform into the Tauri sidecar directory
4. Runs `pnpm turbo build` to compile TypeScript packages
5. Runs `cargo tauri build` to produce the final installer

The cloud `ci.yml` workflow runs: `lint → typecheck → test → coverage → build → Lighthouse audit`.

---

## 5. Side-by-Side Comparison

| Configuration | Cloud (Dev) | Cloud (Prod) | Desktop |
|---|---|---|---|
| Nginx port | 8080 | 443 (HTTPS) | N/A |
| Backend port | 7854 | 7854 (internal) | 7854 (localhost) |
| Frontend | Vite dev :5173 | Nginx static | Tauri WebView |
| PostgreSQL | docker postgres:5432 | docker postgres:5432 | embedded :5433 |
| Redis | docker redis:6379 | docker redis:6379 | not present |
| Auth mode | CLOUD | CLOUD | LOCAL |
| Storage | local (./uploads) | r2 (Cloudflare) | local (~/.local/share) |
| Extraction | BullMQ queue + worker | BullMQ queue + worker | `setImmediate` inline |
| TLS | No | Yes (certbot) | No |
| Multi-tenant | Yes | Yes | No |
| License check | No | No | RSA-signed file |

---

## Related Documents

- [01-system-overview.md](./01-system-overview.md) — C4 container diagrams for both topologies
- [04-auth-and-security.md](./04-auth-and-security.md) — JWT keys, cookie domain, CORS per environment
- [07-document-pipeline.md](./07-document-pipeline.md) — Storage adapter selection and extraction dispatch differences
