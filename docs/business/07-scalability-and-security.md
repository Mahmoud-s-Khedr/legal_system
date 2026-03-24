# Scalability & Security

A technical due-diligence overview of ELMS's security posture, data architecture, and production readiness.

---

## Data Isolation & Multi-Tenancy

Every data record in ELMS is scoped to a `firmId`. Law firm A can never read, write, or search Law firm B's data.

**How it is enforced:**
- Every database table has a `firmId UUID` foreign key with `ON DELETE CASCADE`
- The `injectTenant` middleware extracts `firmId` from the authenticated session on every request
- Every Prisma query automatically includes `WHERE firm_id = $firmId`
- Firm deletion triggers a cascade that removes all associated records (clients, cases, documents, invoices, etc.)

There is no shared application-level cache that crosses firm boundaries.

---

## Authentication & Identity Security

| Control | Implementation |
|---------|---------------|
| Password hashing | bcrypt, cost factor 12 |
| Token signing | JWT RS256 (RSA-2048 asymmetric key pair) |
| Access token TTL | 15 minutes (configurable) |
| Refresh token storage | UUID stored in Redis, 30-day TTL |
| Cookie flags | `HttpOnly`, `SameSite=lax`, `Secure` (in production) |
| Login rate limiting | 10 requests/minute per IP |
| Register rate limiting | 5 requests/minute per IP |
| Session invalidation | Refresh token deleted from Redis on logout |
| Key rotation | New RSA key pair invalidates all sessions (no DB migration needed) |

JWT private keys are **never** auto-generated in production — `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` must be explicitly set.

---

## Role-Based Access Control (RBAC)

ELMS uses a **permission-string model** rather than simple role checks:

- 69 granular permissions: `cases:create`, `invoices:delete`, `library:manage`, etc.
- 5 built-in system roles: `firm_admin`, `senior_lawyer`, `junior_lawyer`, `paralegal`, `secretary`
- Firm admins can create **custom roles** with any permission subset
- Permissions are checked per-route via `requirePermission(permission)` middleware

The model is flat (no role hierarchy), giving administrators precise control over what each team member can do.

---

## Firm Lifecycle Protection

Firms that are in `SUSPENDED` or `PENDING_DELETION` state cannot modify any data:

- `firmLifecycleWriteGuard` middleware intercepts all `POST`, `PUT`, `PATCH`, `DELETE` requests
- Returns **HTTP 423 Locked** with a machine-readable error code
- `GET` requests remain fully functional (read-only access)

This prevents data modification during billing disputes, subscription cancellation, or account deactivation — while preserving data access for export.

---

## Audit Trail

`AuditLog` records every significant data change:

| Field | Content |
|-------|---------|
| `action` | `create`, `update`, `delete` |
| `entityType` | `case`, `invoice`, `user`, etc. |
| `oldData` | JSON snapshot before change |
| `newData` | JSON snapshot after change |
| `ipAddress` | Client IP |
| `userAgent` | Browser/client identifier |
| `userId` | Who made the change |
| `firmId` | Which firm's data was changed |

This audit trail supports compliance requirements, dispute resolution, and forensic investigations without external tooling.

---

## Data Retention: Soft Deletes

Critical entities use **soft deletes** (`deletedAt` timestamp) rather than hard `DELETE`:

- `Client.deletedAt`
- `Case.deletedAt`
- `Document.deletedAt`
- `Task.deletedAt`
- `User.deletedAt`

Soft-deleted records are excluded from all queries by default but can be recovered by administrators. Hard deletes only occur on firm deletion (cascade) or explicit data erasure.

---

## Error Monitoring

Both the frontend and backend integrate **Sentry**:

- `SENTRY_DSN` environment variable activates monitoring
- Uncaught exceptions and unhandled promise rejections are captured automatically
- Slow database queries and API timeouts are tracked
- User context (firmId, userId) is attached to every event for debugging

---

## Testing & Quality Assurance

| Test Type | Tool | Coverage |
|-----------|------|---------|
| Unit tests | Vitest | Backend modules, shared utilities |
| Integration tests | Vitest | Service-layer database interactions |
| E2E tests | Playwright | 7 full user workflow specs |
| Load tests | k6 | API baseline, auth, document upload |
| Performance | Lighthouse CI | Frontend performance budget (CI enforced) |
| Type safety | TypeScript strict mode | Compile-time correctness across all packages |
| Linting | ESLint flat config | Enforced in CI pre-merge |

Backend coverage thresholds are enforced in CI — builds fail if coverage drops below configured minimums.

---

## Production Deployment Checklist

The following controls should be verified before a production deployment:

```
Security:
□ JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are set (not auto-generated)
□ COOKIE_DOMAIN matches the production domain
□ ALLOWED_ORIGINS restricts CORS to known frontend domains
□ NODE_ENV=production (disables Swagger UI, enables Secure cookies)
□ SENTRY_DSN is configured

Data:
□ DATABASE_URL points to production PostgreSQL with SSL
□ Regular automated backups via backup-postgres.sh
□ STORAGE_DRIVER=r2 (or secure local mount) — not development ./uploads
□ MAX_UPLOAD_BYTES set appropriately for firm plan

Operations:
□ Extraction workers running as separate processes
□ Redis available with persistence enabled
□ Health endpoint monitored: GET /api/health
□ Sentry alerts configured for error spikes
```

---

## Desktop Security Model

The desktop application (Tauri 2) adds an additional security layer:

- **Content Security Policy (CSP)** enforced at the Tauri level via `capabilities/` configuration
- **License validation** on startup — RSA-2048 signed license key; tampered licenses are rejected
- **Local-only network** — the embedded API never binds to public network interfaces
- **No cloud connectivity required** — all data stays on the local machine

---

## Related Documents

- [Architecture: Auth & Security](../architecture/04-auth-and-security.md)
- [Architecture: Multi-Tenancy](../architecture/05-multi-tenancy.md)
- [Architecture: Scalability & Limits](../architecture/13-scalability-and-limits.md)
- [Architecture: Editions & Licensing](../architecture/11-editions-and-licensing.md)
