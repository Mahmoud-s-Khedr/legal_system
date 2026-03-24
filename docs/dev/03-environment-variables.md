# Environment Variables

All backend environment variables are validated at startup via a [Zod](https://zod.dev/) schema located at `packages/backend/src/config/env.ts`. Any variable marked **Required in prod** will cause the server to refuse to start if absent in a `NODE_ENV=production` build.

Copy `.env.example` to `.env` and fill in the values relevant to your deployment target.

> **JWT keys in development** — When `NODE_ENV=development`, RSA-2048 key pairs are auto-generated at startup. `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` are only required in production.

---

## Core

| Variable | Type | Default | Required (prod) | Description |
|---|---|---|---|---|
| `NODE_ENV` | `development` \| `test` \| `production` | `development` | Yes | Controls logging verbosity, Swagger availability, and secure cookie flag |
| `AUTH_MODE` | `CLOUD` \| `LOCAL` | `CLOUD` | Yes | `CLOUD` uses JWT cookies with refresh tokens; `LOCAL` uses an in-memory session store for the single-tenant desktop edition |
| `HOST` | string | `0.0.0.0` | No | IP address the Fastify HTTP server binds to |
| `BACKEND_PORT` | number | `7854` | No | Port the backend listens on |
| `FRONTEND_PORT` | number | `5173` | No | Expected frontend port; used to construct CORS defaults |

---

## Database

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `DATABASE_URL` | string | — | Always | PostgreSQL connection string passed to Prisma. Example: `postgresql://elms:elms@127.0.0.1:5432/elms_cloud?schema=public` |
| `REDIS_URL` | string | `redis://127.0.0.1:6379` | No | Redis connection string for BullMQ queue and rate-limit state |

---

## Auth & Tokens

| Variable | Type | Default | Required (prod) | Description |
|---|---|---|---|---|
| `COOKIE_DOMAIN` | string | `localhost` | Yes | Domain written to `Set-Cookie` headers and used as the JWT issuer claim |
| `ACCESS_TOKEN_TTL_MINUTES` | number | `15` | No | Lifetime of the access token JWT cookie |
| `REFRESH_TOKEN_TTL_DAYS` | number | `30` | No | Lifetime of the refresh token cookie (cloud mode only) |
| `LOCAL_SESSION_TTL_HOURS` | number | `12` | No | Lifetime of in-memory sessions (local/desktop mode only) |

---

## JWT Keys

| Variable | Type | Default | Required (prod) | Description |
|---|---|---|---|---|
| `JWT_PRIVATE_KEY` | string | auto-generated in dev | Yes | PEM-encoded RSA-2048 private key. Generate with: `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048` |
| `JWT_PUBLIC_KEY` | string | auto-generated in dev | Yes | PEM-encoded RSA-2048 public key. Derive from private key with: `openssl rsa -pubout` |

---

## Storage

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `STORAGE_DRIVER` | string | `local` | No | Set to `r2` to use Cloudflare R2 for document storage |
| `MAX_UPLOAD_BYTES` | number | `52428800` | No | Maximum allowed file upload size in bytes (default 50 MB) |
| `LOCAL_STORAGE_PATH` | string | `./uploads` | No | Filesystem path for locally-stored uploads when `STORAGE_DRIVER=local` |
| `R2_ACCOUNT_ID` | string | — | R2 only | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | string | — | R2 only | R2 access key |
| `R2_SECRET_ACCESS_KEY` | string | — | R2 only | R2 secret key |
| `R2_BUCKET` | string | — | R2 only | R2 bucket name |
| `R2_PUBLIC_DOMAIN` | string | — | R2 only | Public base URL for serving R2 objects |

---

## OCR & AI

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `OCR_BACKEND` | `tesseract` \| `google_vision` | `tesseract` | No | OCR engine used for document text extraction |
| `GOOGLE_VISION_API_KEY` | string | — | `google_vision` only | API key for Google Cloud Vision OCR |
| `ANTHROPIC_API_KEY` | string | — | No | API key for the AI legal research assistant (Claude) |
| `ANTHROPIC_MODEL` | string | `claude-sonnet-4-6` | No | Anthropic model identifier used for research sessions |
| `AI_MONTHLY_LIMIT` | number | `500` | No | Maximum AI research messages per firm per calendar month. Set to `0` for unlimited |

---

## CORS & Network

| Variable | Type | Default | Required (prod) | Description |
|---|---|---|---|---|
| `ALLOWED_ORIGINS` | string (comma-separated) | `""` | Yes | Comma-separated list of origins permitted by CORS. Example: `https://app.elms.firm.com,https://portal.elms.firm.com`. Empty string allows no cross-origin requests beyond same-origin |

---

## Email (SMTP)

All SMTP variables are optional. When omitted, email notifications are silently skipped.

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `SMTP_HOST` | string | — | No | SMTP server hostname |
| `SMTP_PORT` | number | `587` | No | SMTP server port |
| `SMTP_USER` | string | — | No | SMTP authentication username |
| `SMTP_PASS` | string | — | No | SMTP authentication password |
| `SMTP_FROM` | string | `noreply@elms.app` | No | From address used in outgoing emails |

---

## SMS

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `SMS_PROVIDER` | `twilio` \| `none` | `none` | No | Set to `twilio` to enable SMS notifications |
| `SMS_ACCOUNT_SID` | string | — | Twilio only | Twilio account SID |
| `SMS_AUTH_TOKEN` | string | — | Twilio only | Twilio auth token |
| `SMS_FROM_NUMBER` | string | — | Twilio only | Twilio sender phone number |

---

## Desktop

These variables configure the communication between the Tauri shell, the embedded backend, and the embedded PostgreSQL instance. Local development typically uses `apps/desktop/.env.desktop`; when that file is absent, desktop tooling falls back to the checked-in `apps/desktop/.env.desktop.example`.

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `DESKTOP_FRONTEND_URL` | string | `http://127.0.0.1:5173` | No | URL the Tauri webview loads for the frontend |
| `DESKTOP_BACKEND_URL` | string | `http://127.0.0.1:7854` | No | URL the Vite dev proxy and Tauri shell use to reach the backend |
| `DESKTOP_POSTGRES_PORT` | number | `5433` | No | Port for the embedded PostgreSQL instance shipped with the desktop app |

---

## Google OAuth

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | string | — | No | OAuth 2.0 client ID for Google Calendar integration |
| `GOOGLE_OAUTH_CLIENT_SECRET` | string | — | No | OAuth 2.0 client secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | string | — | No | Redirect URI registered with Google Cloud Console |
| `GOOGLE_OAUTH_ENCRYPTION_KEY` | string | — | No | Key used to encrypt stored OAuth tokens at rest in the database |

---

## Observability

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `SENTRY_DSN` | string | — | No | Sentry DSN for backend error reporting |

The frontend reads `VITE_SENTRY_DSN` (a Vite env variable set at build time) independently of the backend variable.

---

## Related

- [Getting Started](./01-getting-started.md) — how to copy and configure `.env.example`
- [Architecture Internals](./04-architecture-internals.md) — how `AUTH_MODE` affects session resolution
- [Database](./05-database.md) — `DATABASE_URL` and the embedded desktop PostgreSQL setup

---

## Web Compose Validation Build Note

The `@elms/web` package build script runs a Docker Compose config validation check. During this validation step, variables are loaded from `apps/web/.env.production.example` so required interpolations (for example `POSTGRES_PASSWORD`) are present in local and CI builds.

This behavior only validates compose configuration rendering. It does not replace production secret management.
