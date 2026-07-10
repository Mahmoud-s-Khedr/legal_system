# ELMS — VPS Deployment Guide

Deploy ELMS on a single VPS using Docker Compose. Everything runs in local containers:
PostgreSQL, Redis, MinIO, Fastify backend, React frontend (Nginx), and Caddy (TLS edge proxy).

This contract is suitable for a controlled hosted beta. The default billing posture is `SAAS_BILLING_MODE=manual`, which keeps customer charging outside the product until Stripe checkout and webhook flows are intentionally hardened.

---

## Prerequisites

- VPS with at least **2 GB RAM, 2 vCPU, 20 GB disk** (4 GB RAM recommended for LibreOffice)
- Docker Engine ≥ 24 and Docker Compose plugin (`docker compose`)
- A domain name pointed at the VPS IP (required for Let's Encrypt TLS)
- Resend account for transactional email

---

## Quick Start

### 1. Clone the repository on the VPS

```bash
git clone https://github.com/your-org/elms.git /opt/elms
cd /opt/elms
```

### 2. Generate JWT keys

```bash
chmod +x ops/scripts/gen-jwt-keys.sh
./ops/scripts/gen-jwt-keys.sh
```

Copy the two output lines into your `.env.production` file.

### 3. Create `.env.production`

```bash
cd ops
cp .env.production.example .env.production
nano .env.production   # Fill in all CHANGE_ME values
```

**Required values to fill in:**

| Variable | Where to get it |
|---|---|
| `POSTGRES_PASSWORD` | Choose a strong password |
| `MINIO_ROOT_PASSWORD` | Choose a strong password (≥ 8 chars) |
| `R2_SECRET_ACCESS_KEY` | Same as `MINIO_ROOT_PASSWORD` |
| `JWT_PRIVATE_KEY` | Output of `gen-jwt-keys.sh` |
| `JWT_PUBLIC_KEY` | Output of `gen-jwt-keys.sh` |
| `SMTP_PASS` | Your Resend API key (`re_xxxx`) |
| `SMTP_FROM` | A verified sender address in Resend |
| `ELMS_DOMAIN` | Your domain, e.g. `elms.yourfirm.com` |
| `ACME_EMAIL` | Your email for Let's Encrypt |
| `COOKIE_DOMAIN` | `.yourfirm.com` (with leading dot) |
| `ALLOWED_ORIGINS` | `https://elms.yourfirm.com` |
| `DATABASE_URL` | Update password to match `POSTGRES_PASSWORD` |

### 4. Build Docker images

Run from the **repository root** (not `ops/`):

```bash
cd /opt/elms

# Build backend image
docker build -f packages/backend/Dockerfile -t elms-backend:local .

# Build frontend image
docker build -f ops/Dockerfile.frontend -t elms-frontend:local .
```

> **Note:** The first build takes ~5–10 minutes due to LibreOffice (~400 MB). Subsequent builds use layer cache.

### 5. Run database migrations

```bash
cd /opt/elms/ops
docker compose -f docker-compose.prod.yml run --rm migrate
```

### 6. Start the full stack

```bash
docker compose -f docker-compose.prod.yml up -d
```

Caddy will automatically obtain a TLS certificate from Let's Encrypt on first start.

### 7. Verify

```bash
# Health check
curl https://elms.yourfirm.com/api/health
# Expected: {"ok":true,"status":"ok","checks":{"db":"ok"}}

# Register the first firm (do this once)
curl -X POST https://elms.yourfirm.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firmName": "My Law Firm",
    "email": "admin@myfirm.com",
    "fullName": "Admin User",
    "password": "StrongPassword123!"
  }'
```

---

## Service Ports

| Service | Internal port | External |
|---|---|---|
| Caddy (HTTP) | 80 | `:80` (redirects to HTTPS) |
| Caddy (HTTPS) | 443 | `:443` |
| MinIO Console | 9001 | `:9001` (restrict via firewall) |
| Backend API | 7854 | Internal only |
| Frontend | 80 | Internal only |

> **Security:** Close port `9001` (MinIO console) to public access via your firewall/security group. Open it only when needed via SSH tunnel: `ssh -L 9001:localhost:9001 user@your-vps`.

---

## Day-to-Day Operations

### View logs

```bash
cd ops
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f extraction-worker
docker compose -f docker-compose.prod.yml logs -f edge
```

### Restart a service

```bash
docker compose -f docker-compose.prod.yml restart backend
```

### Update to a new version

```bash
# On VPS, from /opt/elms
git pull

# Rebuild images
docker build -f packages/backend/Dockerfile -t elms-backend:local .
docker build -f ops/Dockerfile.frontend -t elms-frontend:local .

# Apply any new migrations
docker compose -f docker-compose.prod.yml run --rm migrate

# Restart services with new images
docker compose -f docker-compose.prod.yml up -d --force-recreate backend extraction-worker library-worker docx-worker web
```

### Backup PostgreSQL

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U elms elms_cloud | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Backup MinIO data

MinIO data is in the `minio-data` Docker volume. To backup:

```bash
docker run --rm \
  -v elms_minio-data:/data:ro \
  -v $(pwd):/backup \
  alpine tar czf /backup/minio_$(date +%Y%m%d).tar.gz /data
```

---

## Directory Structure

```
ops/
├── docker-compose.prod.yml   # Full stack definition
├── Caddyfile                 # TLS edge proxy config
├── .env.production.example   # Environment template (copy → .env.production)
├── nginx/
│   └── nginx.conf            # Nginx SPA server config
└── scripts/
    └── gen-jwt-keys.sh       # RSA key pair generator
```

---

## Troubleshooting

### Caddy fails to get TLS certificate

- Ensure port `80` and `443` are open on the VPS firewall
- Ensure DNS for `ELMS_DOMAIN` points to the VPS IP
- Check logs: `docker compose -f docker-compose.prod.yml logs edge`

### Backend fails to start — "JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be set in production"

Run `./ops/scripts/gen-jwt-keys.sh` and paste the output into `.env.production`.

### MinIO bucket not found

The `minio-init` service creates the bucket on first start. If it failed:

```bash
docker compose -f docker-compose.prod.yml logs minio-init
docker compose -f docker-compose.prod.yml run --rm minio-init
```

### Document OCR not working

Check that Tesseract is available in the backend container:

```bash
docker compose -f docker-compose.prod.yml exec backend tesseract --version
```

If missing, rebuild the backend image — `apk add tesseract-ocr` in the Dockerfile handles this.
