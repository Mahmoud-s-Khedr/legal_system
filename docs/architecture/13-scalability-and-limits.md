# Scalability & Known Limits

An honest assessment of ELMS v0.1.0 capacity, single points of failure, and the path to horizontal scale.

## Design Intent by Deployment Mode

| Mode | Designed Capacity | Bottleneck |
|------|------------------|-----------|
| Desktop (LOCAL) | 1–50 concurrent users, single firm | Embedded PostgreSQL, single Node.js process |
| Cloud SaaS | Hundreds of firms, thousands of users | Redis, single PostgreSQL instance |

ELMS is deliberately optimized for **law firm scale**, not internet-scale. A firm with 50 concurrent users is well within the architecture's sweet spot.

---

## Stateless Backend — Horizontal Scale Ready

The Fastify backend is **fully stateless**:

- Session state lives in Redis (CLOUD mode) or in the local process only (LOCAL mode)
- No in-memory state shared between processes
- File storage is external (local filesystem or Cloudflare R2)

This means multiple backend instances can run behind an Nginx upstream with no session affinity required:

```
                    ┌─────────────────────────────────┐
Internet ──► Nginx ─┤  backend:7854 (instance A)      ├──► PostgreSQL
                    │  backend:7854 (instance B)      │──► Redis
                    │  backend:7854 (instance C)      │──► R2 Storage
                    └─────────────────────────────────┘
```

**Prerequisite:** Use `STORAGE_DRIVER=r2` (not `local`) so all instances share the same file store. Use a managed PostgreSQL with a connection pooler (see below).

---

## Single Points of Failure

### Redis (Cloud Mode)

Redis is required for:
- JWT refresh token storage
- BullMQ job queues (extraction, reminder, edition lifecycle)

**Current state:** Single Redis instance (no clustering, no Sentinel).
**Failure impact:** Auth refresh fails; background jobs halt; active users must re-login.
**Mitigation path:** Redis Sentinel (failover) → Redis Cluster (horizontal).

### PostgreSQL

**Current state:** Single PostgreSQL 16 instance; Prisma connection pool defaults to 10 connections.
**Failure impact:** Full application outage.
**Mitigation path:**
1. Increase Prisma pool: `DATABASE_URL?connection_limit=25`
2. Add PgBouncer connection pooler (transaction mode)
3. Add a read replica and route `SELECT` queries to it

### BullMQ Workers (Extraction)

Workers run as a **separate process** (`dist/jobs/extractionWorker.js`). If they are not running:
- Document uploads succeed
- `extractionStatus` stays `PENDING`
- Queue depth grows (visible in `/api/health`)

Workers are **horizontally scalable**: run N worker processes against the same Redis queue. Each worker has `concurrency: 3`, so 3 worker processes = 9 parallel extractions.

---

## Database Connection Pool

Prisma uses a single connection pool per process. Defaults are conservative:

| Setting | Default | Recommended (prod) |
|---------|---------|-------------------|
| `connection_limit` | 10 | 20–50 (depending on PG `max_connections`) |
| `pool_timeout` | 10 s | leave as-is |
| `connect_timeout` | 5 s | leave as-is |

Configure via the DATABASE_URL query parameter:

```
DATABASE_URL=postgresql://user:pass@host/db?connection_limit=25&pool_timeout=15
```

For large deployments (>100 concurrent users), add **PgBouncer** in front of PostgreSQL in transaction pooling mode, and set `connection_limit=5` in Prisma (PgBouncer manages the real pool).

---

## AI Monthly Usage Limit

Anthropic API calls are capped per firm per calendar month via `AI_MONTHLY_LIMIT` (default: 500).

The check is performed **at query time** by counting `ResearchMessage` rows in the current month:

```sql
SELECT COUNT(*) FROM "ResearchMessage"
WHERE session_id IN (
  SELECT id FROM "ResearchSession" WHERE firm_id = $firmId
)
AND created_at >= date_trunc('month', now())
AND role = 'USER'
```

No cron job or counter table is needed. This is correct but adds a COUNT query to every research request. At high volume (many concurrent research requests) this query should be indexed or cached.

**Set to 0 for unlimited:** `AI_MONTHLY_LIMIT=0`

---

## File Storage Limits

| Driver | Practical Limit | Notes |
|--------|----------------|-------|
| `local` | Disk size of the server | Not shareable across instances |
| `r2` | Unlimited (Cloudflare R2) | Required for multi-instance deployments |

The `MAX_UPLOAD_BYTES` limit (default 50 MB) is enforced per file by `@fastify/multipart`. There is no per-firm or per-firm-total storage quota in v0.1.0.

---

## Concurrency Model

Node.js is single-threaded but non-blocking. ELMS workloads are I/O-bound (database queries, file reads, HTTP calls to Anthropic), which is exactly the scenario where Node.js excels.

CPU-bound tasks (OCR via Tesseract.js) are offloaded to:
- BullMQ workers running in separate processes (cloud)
- The same process but asynchronously (desktop — acceptable for 1–5 users)

---

## Known Limitations in v0.1.0

| Limitation | Impact | Planned Fix |
|------------|--------|------------|
| No read replicas | All DB load on one node | Add replica + read routing |
| Redis single-node | Auth SPF for cloud | Redis Sentinel / Cluster |
| No per-firm storage quota | Unbounded disk usage | Per-firm quota + storage reports |
| AI usage counted at query time | Extra DB round-trip per AI request | Counter table or Redis counter |
| Tesseract WASM in desktop | High memory use for large PDFs | Stream pages, limit concurrency |
| `STORAGE_DRIVER=local` not shareable | Blocks multi-instance deploy | Enforced switch to R2 in prod docs |
| No rate limit on document uploads | Potential storage abuse | Add per-firm daily upload limits |

---

## Load Test Results (Baseline)

Load tests in `tests/load/` are run with k6. The baseline test (`api-baseline.js`) validates:
- P95 response time < 500 ms
- Error rate < 1%

Under the default configuration (1 backend instance, PostgreSQL pool 10, no workers), the system handles approximately 50–100 RPS on read-heavy endpoints before latency increases. Document-heavy workloads benefit significantly from running dedicated extraction workers.

---

## Scaling Checklist for Production

```
□ Switch STORAGE_DRIVER=r2 (R2_* env vars configured)
□ Set DATABASE_URL with connection_limit=25
□ Deploy Redis with Sentinel or use managed Redis (e.g., Upstash)
□ Run at least one extractionWorker process separately
□ Configure ALLOWED_ORIGINS to restrict CORS in production
□ Set JWT_PRIVATE_KEY + JWT_PUBLIC_KEY (not auto-generated dev keys)
□ Set SENTRY_DSN for error monitoring
□ Configure SMTP or RESEND_API_KEY for email notifications
□ Review AI_MONTHLY_LIMIT per expected firm usage
```

## Related Files

| File | Purpose |
|------|---------|
| [docs/architecture/06-deployment-topologies.md](./06-deployment-topologies.md) | Cloud vs desktop infrastructure |
| [docs/architecture/09-async-jobs.md](./09-async-jobs.md) | BullMQ worker architecture |
| [packages/backend/src/jobs/extractionWorker.ts](../../packages/backend/src/jobs/extractionWorker.ts) | Worker process entry point |
| [archive/cloud/apps/web/docker-compose.prod.yml](../../archive/cloud/apps/web/docker-compose.prod.yml) | Production Docker configuration |

## Source of truth

- `docs/_inventory/source-of-truth.md`

