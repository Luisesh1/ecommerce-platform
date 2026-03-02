# Technical Assumptions and Decisions

This document records the key technical decisions made during the design and implementation of this ecommerce platform. Each assumption explains the rationale and any trade-offs considered.

---

## Authentication

### Strategy: JWT Access Token + HTTP-Only Refresh Token

Access tokens are short-lived JWTs (default TTL: 15 minutes) signed with `JWT_SECRET`. Refresh tokens are longer-lived JWTs (default TTL: 7 days) signed with a separate `JWT_REFRESH_SECRET` and stored as an HTTP-only cookie, making them inaccessible to JavaScript and immune to XSS-based theft.

**Why two secrets?** Using the same secret for both access and refresh tokens means a leaked secret compromises both. Separate secrets allow independent rotation.

**Token rotation:** Every successful use of a refresh token issues a new refresh token and invalidates the old one (refresh token rotation). The previous token is stored in Redis with a short grace period (30 seconds) to handle parallel requests.

**Why not sessions?** Stateless JWTs simplify horizontal scaling since no session store synchronization is needed. The API can be replicated without sticky sessions.

**Token revocation:** Explicit logout stores the token's JTI (JWT ID) in a Redis blacklist until expiry. This is only needed for the access token; refresh token rotation handles the refresh token side.

---

### Admin Authentication: Separate JWT with Shorter Expiry

Admin users authenticate against a separate JWT signed with `ADMIN_JWT_SECRET`, with a default TTL of 8 hours (a single working shift). Admin sessions are not refreshed automatically; admins must re-authenticate after expiry. This limits the blast radius of a compromised admin session.

---

### Two-Factor Authentication: TOTP (RFC 6238)

2FA is implemented as TOTP (Time-based One-Time Password) compatible with Google Authenticator, Authy, and any RFC 6238 compliant app. QR code generation uses the `qrcode` library. TOTP secrets are encrypted at rest using the same AES-256-GCM scheme as payment gateway credentials.

2FA is optional for customers and mandatory (enforced by the system) for admin users with the `SUPER_ADMIN` role.

---

## Payment Processing

### Strategy: Multi-gateway with encrypted credential storage

Payment gateway credentials (Stripe secret keys, MercadoPago access tokens, PayPal client secrets) are stored encrypted in PostgreSQL using AES-256-GCM with a `MASTER_ENCRYPTION_KEY` stored only in environment variables. This allows credentials to be managed from the admin dashboard without redeployment.

**Supported gateways at launch:**
- **Stripe** — Primary gateway for card payments and Link. Stripe Elements is used on the frontend for PCI compliance (card numbers never touch our servers).
- **MercadoPago** — Latin American market. Handles PIX, OXXO, and local card networks.
- **PayPal** — PayPal wallet and Pay Later.

**Webhook idempotency:** Each gateway's webhook handler checks a Redis cache for the event ID before processing. Duplicate events (common during outages) are acknowledged with 200 but not double-processed.

**Refund flow:** Refunds are initiated from the admin panel. The system calls the gateway's refund API, records the result, and creates an inventory RETURN movement for any returned physical items.

---

## Caching: Redis

Redis serves multiple roles:

| Use Case | Details |
|----------|---------|
| Refresh token rotation | Stores previous tokens with a 30-second grace TTL |
| Token blacklist | Stores revoked JTI values with TTL matching token expiry |
| Cart persistence | Guest carts stored as Redis hashes; key = `cart:{sessionId}`, TTL = 7 days |
| Stock reservations | Temporary holds during checkout; TTL = 15 minutes |
| Feature flags | Cached boolean toggles; TTL = 60 seconds |
| Rate limiting | `@nestjs/throttler` uses Redis as the rate limit store |
| BullMQ queues | All background job queues use Redis as the backing store |
| Session store (admin) | Not used; JWT-based auth eliminates server-side sessions |

**No Redis persistence assumption:** Redis is configured with `appendonly no` and `save ""` in the development environment (ephemeral). In production, `appendonly yes` with `appendfsync everysec` is recommended for durability, accepting up to 1 second of data loss. For cart and reservation data, this trade-off is acceptable since carts can be recreated.

---

## Search: Meilisearch

Meilisearch is used for product full-text search and faceted filtering. Elasticsearch was considered but rejected due to operational complexity and resource requirements (Elasticsearch requires a minimum of 1 GB heap vs. Meilisearch's lower footprint).

**Index strategy:**
- One index per searchable entity: `products`, `orders` (admin only), `customers` (admin only)
- Product index contains denormalized data: product name, description, category name, tags, variant SKUs, and attributes
- Facets: category, price range, tags, availability
- Ranking rules prioritize exact title matches over description matches

**Sync strategy:** Product data is indexed via BullMQ jobs triggered by Prisma's afterWrite hooks in the API. A full re-index job is available via admin panel for recovery.

**Assumption:** Meilisearch's eventual consistency (index updates happen asynchronously) is acceptable. A product change will be reflected in search within 1-3 seconds.

---

## File Storage: MinIO / S3-Compatible

MinIO is used in development and staging as a self-hosted S3-compatible object store. In production, the same `@aws-sdk/client-s3` client can point to either a self-hosted MinIO instance or AWS S3 with no code changes — only environment variable changes are required.

**Bucket structure:**

```
ecommerce/
├── products/          # Product images (original + resized variants)
├── invoices/          # Order invoice PDFs
├── packing-slips/     # Packing slip PDFs
├── exports/           # CSV export files (temporary, 24h TTL via lifecycle rule)
├── imports/           # CSV import files (temporary)
└── email-attachments/ # Email attachments
```

**Image processing:** On upload, the API uses `sharp` to create three resized variants: thumbnail (200x200), medium (600x600), and large (1200x1200). All variants are stored in the `products/` prefix. The original is retained.

**Presigned URLs:** File downloads use presigned S3 URLs with a 1-hour expiry, avoiding the API acting as a proxy for large files.

**Public vs. private access:** Product images are public-read (no auth required). Invoices, packing slips, and export files are private (presigned URL required).

---

## Multi-Tenancy: Single Tenant

This platform is designed as a single-tenant application — one store, one database schema, one set of admin credentials. Multi-tenancy (serving multiple independent stores from one deployment) is explicitly out of scope.

**Why single-tenant?** The target use case is a single brand deploying their own store. Multi-tenancy adds significant complexity (row-level security, data isolation, per-tenant billing) with no benefit for this use case.

---

## Currency Handling

All monetary amounts in the database are stored as integers in the smallest currency unit (centavos for MXN, cents for USD). For example, $299.00 MXN is stored as `29900`.

**Why integers?** Floating-point arithmetic is unsuitable for money. Integer centavo/cent arithmetic is exact. This convention is used by Stripe and MercadoPago natively.

**Currency field:** Every `Order`, `OrderItem`, `Product`, and `ProductVariant` row stores a `currency` column (ISO 4217 code, e.g., `MXN`, `USD`). The current implementation supports one base currency per store, configured via a store settings record. Multi-currency display (showing prices in the visitor's local currency) is not implemented.

**Display:** The frontend formats amounts using the JavaScript `Intl.NumberFormat` API with the store's configured locale and currency code. Formatting is always done at the presentation layer, never in the database or API response.

---

## Timezone Handling

All timestamps in the database are stored as UTC (`TIMESTAMPTZ` in PostgreSQL). No timezone conversion happens in the database layer.

**Application layer:** The API returns all timestamps as ISO 8601 strings with a `Z` suffix (UTC). The frontend is responsible for converting to the user's local timezone using `date-fns` with the user's browser locale.

**Scheduled jobs:** BullMQ cron expressions use UTC. When configuring scheduled promotions or email campaigns, the admin UI displays times in UTC with a note to the operator.

**Assumption:** Store operators are assumed to understand UTC or configure an offset manually. A per-store timezone setting is stored in the store configuration record and used for report generation (e.g., "daily orders report for March 1, 2026" means March 1 in the store's configured timezone, not UTC).

---

## Background Jobs: BullMQ

All time-consuming or asynchronous operations are delegated to BullMQ queues processed by the Worker application. The API enqueues jobs and returns immediately.

**Queue inventory:**

| Queue | Jobs |
|-------|------|
| `email` | Order confirmation, shipping updates, password reset, back-in-stock |
| `search-index` | Product index sync after create/update/delete |
| `inventory` | Stock reservation expiry, low-stock alert evaluation |
| `orders` | Order export, invoice generation, packing slip generation |
| `imports` | CSV product/order/customer bulk import processing |
| `notifications` | Web Push notification dispatch |
| `analytics` | GA4 Measurement Protocol events, Meta CAPI events |

**Retry policy:** Jobs are retried up to 3 times with exponential backoff (2s, 4s, 8s). After 3 failures the job moves to the dead-letter queue (`<queue>:failed`) where it can be inspected via the Bull Board admin UI.

**Worker concurrency:** Each queue processor runs with a concurrency setting tuned to its workload. Email: 5 concurrent. Search index: 2 concurrent (Meilisearch rate limits). Import: 1 concurrent (CPU-bound).

---

## Email: Resend

Resend is used as the transactional email provider. It was chosen over SendGrid or AWS SES for its developer experience, native TypeScript SDK, and competitive pricing.

**Templates:** Email templates are Handlebars HTML templates compiled at runtime. Templates are stored in the API filesystem (not in a database) at `apps/api/src/email/templates/`.

**Assumption:** Email deliverability depends on proper DNS configuration: SPF, DKIM, and DMARC records must be set on the sender domain. Resend's onboarding guide covers this. The `EMAIL_FROM` address must be a verified domain in the Resend dashboard.

---

## Monitoring and Observability

**Error tracking:** Sentry is used for both the API (via `@sentry/nestjs`) and the web frontend (via `@sentry/nextjs`). Errors are captured with full stack traces, request context, and user ID (if authenticated). PII is scrubbed from Sentry payloads for the email, phone, and payment fields.

**Logging:** The API uses Winston with two transports: console (formatted with `pino-pretty` in development, JSON in production) and a file transport writing to `/var/log/ecommerce/api.log`. Log level is controlled via `LOG_LEVEL` env var.

**Health check endpoint:** `GET /api/health` returns a JSON object with the status of each dependency (PostgreSQL, Redis, Meilisearch, MinIO). Used by Traefik's health check configuration and the smoke test script.

**No APM assumption:** Distributed tracing (OpenTelemetry, Datadog APM) is not implemented. For the expected traffic volumes of a single-store deployment, Sentry error tracking combined with structured JSON logs is sufficient. APM can be added later without architectural changes.

---

## Security Assumptions

**Rate limiting:** All API endpoints are rate-limited via `@nestjs/throttler` with Redis as the store. Default: 100 requests per 60-second window per IP. Auth endpoints (login, register, password reset) have stricter limits: 10 requests per 60-second window.

**CORS:** The allowed origins list is configured via the `CORS_ORIGINS` environment variable. Only the web frontend origin is allowed in production.

**Helmet:** The API uses `helmet` middleware to set security HTTP headers (CSP, HSTS, X-Frame-Options, etc.).

**Input validation:** All incoming data is validated using `class-validator` DTOs at the NestJS controller layer. Prisma provides a second layer of type safety at the database layer. Frontend forms use Zod schemas for client-side validation.

**SQL injection:** Not possible — Prisma uses parameterized queries exclusively. Raw SQL is not used.

**File upload security:** File uploads validate MIME type and file extension. Maximum upload size is 10 MB per file. Files are scanned for potentially dangerous content (SVG files are sanitized with `sanitize-html` before storage).

**Assumption — No WAF:** A Web Application Firewall (Cloudflare, AWS WAF) is not included in this architecture. The Traefik + rate limiting combination is considered sufficient for a single-store deployment. Adding Cloudflare as a reverse proxy in front of Traefik is straightforward and recommended for high-traffic stores.

---

## Infrastructure Assumptions

**Single VPS deployment:** The entire stack (API, Web, Worker, PostgreSQL, Redis, Meilisearch, MinIO, Traefik) runs on a single VPS. This simplifies operations and costs but is a single point of failure.

**No Kubernetes:** Kubernetes adds significant operational overhead (cluster management, networking, secrets management). For the expected scale of a single store, Docker Compose on a single VPS is appropriate. Migration to Kubernetes is possible without code changes since the application is container-native.

**Horizontal scaling assumption:** The API and Worker are stateless and can be scaled horizontally by running multiple replicas behind a load balancer. PostgreSQL read replicas would be required at that point. This migration path is clear but not implemented in the initial deployment.

**Backup assumption:** The backup strategy assumes the VPS has network access to an S3-compatible store. If the VPS and MinIO are on the same physical machine and both fail, only the S3/cloud copy survives. For production, MinIO should run on a separate VPS or cloud S3 should be used for backup storage.
