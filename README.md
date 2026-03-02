# Ecommerce Platform

Production-grade ecommerce monorepo built with NestJS, Next.js 14, and PostgreSQL.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Traefik (TLS)                       │
└──────────────────────┬──────────────────────────────────┘
                       │
         ┌─────────────┴────────────┐
         │                          │
   ┌─────▼──────┐            ┌──────▼─────┐
   │  Next.js   │            │  NestJS    │
   │  (Web :3000)│           │  (API :4000)│
   └─────────────┘           └──────┬─────┘
                                    │
                  ┌─────────────────┼─────────────────┐
                  │                 │                  │
           ┌──────▼───┐    ┌───────▼──┐    ┌─────────▼──┐
           │ PostgreSQL│   │  Redis   │    │Meilisearch │
           │  :5432    │   │  :6379   │    │   :7700    │
           └───────────┘   └──────────┘    └────────────┘
                                    │
                           ┌────────▼──────┐
                           │  BullMQ       │
                           │  Worker       │
                           └───────────────┘
```

## Setup rápido (dev)

```bash
# 1. Clonar repositorio
git clone <repo> && cd ecommerce

# 2. Copiar variables de entorno y editar
cp .env.example .env
# (editar .env con tus valores)

# 3. Levantar servicios con Docker
docker compose -f infra/compose/docker-compose.dev.yml up -d

# 4. Instalar dependencias
pnpm install

# 5. Aplicar migraciones
pnpm --filter api prisma migrate dev

# 6. Cargar datos de prueba
pnpm --filter api prisma db seed

# 7. Iniciar servidores de desarrollo
pnpm dev
```

| URL | Descripción |
|-----|-------------|
| http://localhost:3000 | Tienda |
| http://localhost:3000/admin | Admin (`admin@example.com` / `Admin123!`) |
| http://localhost:3001 | API REST |
| http://localhost:3001/api/docs | Swagger / OpenAPI |
| http://localhost:7700 | Meilisearch |
| http://localhost:9001 | MinIO Console |
```

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 App Router, React 18, TailwindCSS |
| Backend | NestJS 10, Prisma 6, TypeScript |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7, BullMQ |
| Search | Meilisearch v1.6 |
| Storage | MinIO (S3-compatible) |
| Email | Resend |
| Payments | Stripe, MercadoPago, PayPal |
| Auth | JWT + Refresh tokens + 2FA TOTP |
| Monitoring | Sentry, Winston |
| Infra | Docker, Traefik, GitHub Actions |

## Project Structure

```
ecommerce/
├── apps/
│   ├── api/                # NestJS backend (port 4000)
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── auth/
│   │       ├── catalog/
│   │       ├── cart/
│   │       ├── orders/
│   │       ├── inventory/
│   │       ├── payments/
│   │       ├── promotions/
│   │       ├── webhooks/
│   │       ├── shipping/
│   │       ├── search/
│   │       ├── email/
│   │       ├── storage/
│   │       ├── features/
│   │       ├── analytics/
│   │       ├── fraud/
│   │       └── prisma/
│   ├── web/                # Next.js frontend (port 3000)
│   │   ├── app/
│   │   │   ├── (store)/   # Public store pages
│   │   │   └── admin/     # Admin dashboard
│   │   └── e2e/           # Playwright tests
│   └── worker/             # BullMQ background worker
├── packages/
│   ├── ui/                 # Shared React component library
│   ├── types/              # Shared TypeScript types
│   └── utils/              # Shared utilities
├── infra/                  # Docker Compose, Traefik config
├── docs/                   # Runbooks, ADRs, assumptions
└── turbo.json
```

## Environment Variables

### API (`apps/api/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | required |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `JWT_SECRET` | JWT signing secret (>=32 chars) | required |
| `JWT_EXPIRES_IN` | JWT access token TTL | `15m` |
| `JWT_REFRESH_SECRET` | Refresh token signing secret | required |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL | `7d` |
| `ENCRYPTION_KEY` | AES-256 key for credentials (32 chars) | required |
| `MEILISEARCH_URL` | Meilisearch base URL | `http://localhost:7700` |
| `MEILISEARCH_KEY` | Meilisearch master key | required |
| `MINIO_ENDPOINT` | MinIO / S3 endpoint hostname | `localhost` |
| `MINIO_PORT` | MinIO port | `9000` |
| `MINIO_ACCESS_KEY` | MinIO access key | required |
| `MINIO_SECRET_KEY` | MinIO secret key | required |
| `MINIO_USE_SSL` | Use HTTPS for MinIO | `false` |
| `MINIO_BUCKET` | Default bucket name | `ecommerce` |
| `RESEND_API_KEY` | Resend transactional email key | required |
| `RESEND_FROM_EMAIL` | Sender address | required |
| `STRIPE_SECRET_KEY` | Stripe secret key | optional |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | optional |
| `MERCADOPAGO_ACCESS_TOKEN` | MercadoPago access token | optional |
| `MERCADOPAGO_WEBHOOK_SECRET` | MercadoPago webhook secret | optional |
| `PAYPAL_CLIENT_ID` | PayPal REST client ID | optional |
| `PAYPAL_CLIENT_SECRET` | PayPal REST client secret | optional |
| `SENTRY_DSN` | Sentry DSN for error tracking | optional |
| `CORS_ORIGINS` | Comma-separated allowed CORS origins | `http://localhost:3000` |
| `PORT` | API port | `4000` |

### Web (`apps/web/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Public API base URL (e.g. `http://localhost:4000`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key for Elements |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | MercadoPago public key |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics 4 Measurement ID |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for client-side errors |
| `PLAYWRIGHT_BASE_URL` | Playwright base URL override (CI) |

## Available Scripts

Run from the monorepo root with `pnpm <script>`:

| Script | Description |
|--------|-------------|
| `dev` | Start all apps in dev mode via Turborepo |
| `build` | Production build for all apps |
| `test` | Run all Jest unit tests |
| `test:e2e` | Run Playwright end-to-end tests |
| `lint` | ESLint across the entire monorepo |
| `format` | Prettier format check |
| `docker:dev` | Start PostgreSQL, Redis, Meilisearch, MinIO via Docker Compose |
| `docker:down` | Stop all Docker services |
| `db:migrate` | Apply Prisma migrations (`prisma migrate deploy`) |
| `db:migrate:dev` | Create + apply migration in dev (`prisma migrate dev`) |
| `db:seed` | Run the database seed script |
| `db:studio` | Open Prisma Studio |
| `db:reset` | Reset database and re-seed (destructive!) |

## Features

### Catalog
- Products with unlimited custom variants (color, size, material, ...)
- Hierarchical categories (unlimited depth)
- Collections for manual / rule-based grouping
- Product attributes and tags
- Full-text search via Meilisearch with faceted filtering
- SEO-friendly slugs, meta titles, descriptions

### Inventory
- Per-variant inventory levels
- Stock reservations with TTL (expired automatically via BullMQ)
- Complete movement audit trail (ADJUSTMENT, SALE, RETURN, TRANSFER, ...)
- Low-stock alerts and configurable threshold per variant

### Cart
- Guest and authenticated carts
- Seamless cart merge on customer login
- Coupon / promotion code support
- Persisted via Redis (guest) and PostgreSQL (authenticated)

### Checkout
- 5-step flow: Information > Shipping > Payment > Review > Confirmation
- Data persistence across back/forward navigation
- No-double-submit guard on final confirmation
- Real-time shipping rate calculation

### Orders
- Full order lifecycle with timeline events
- Packing slip and invoice PDF generation (stored in MinIO)
- Partial and full refunds
- Order tags and internal notes

### Payments
- Stripe (Card, Link)
- MercadoPago
- PayPal
- Gateway credentials encrypted at rest with AES-256-GCM
- Payment gateway config manageable from admin without redeployment

### Webhooks
- Stripe signature verification (HMAC-SHA256)
- Idempotency guard (duplicate event IDs skipped)
- Dead-letter queue after 3 failed processing attempts
- Webhook event audit log with payload storage

### Promotions
- Percentage, fixed amount, free shipping, and buy-X-get-Y discount types
- Per-customer and global usage limits
- Start / end date scheduling
- Applicable product / category targeting
- Automatic depletion tracking

### Email (Resend)
- Order confirmation
- Shipping update with tracking link
- Abandoned cart recovery sequence
- Password reset and email verification
- Back-in-stock notification

### Chat and Support
- Real-time WebSocket chat (Socket.IO)
- Support ticket creation from chat
- Agent assignment and escalation
- Chat history persisted to PostgreSQL

### Reviews
- Verified-purchase reviews only
- Star rating (1-5) with title and body
- Admin moderation (PENDING > APPROVED / REJECTED)
- Admin response capability
- Review images

### Wishlist
- Guest wishlists (session-based) + authenticated wishlists
- Merge on login
- Back-in-stock email subscription per product/variant

### Fraud Detection
- Velocity checks (orders per IP/email in time window)
- IP and email blacklist
- Risk scoring (LOW / MEDIUM / HIGH / BLOCKED)
- Configurable rules with auto-block / review actions

### Feature Flags
- Boolean feature toggles managed from the admin dashboard
- Redis-cached for sub-millisecond reads
- Conditions support (% rollout, user segment)

### Audit Log
- Full before/after diff for every entity change
- Indexed by user, entity type, and timestamp
- Accessible from admin

### Import / Export
- CSV bulk import: products, variants, inventory, customers, orders
- Row-level validation with error report
- Background processing via BullMQ
- CSV export with download link (stored in MinIO)

### Push Notifications
- Web Push API with VAPID keys
- Permission prompt in storefront
- Notification topics: order updates, back-in-stock, promotions

### Analytics
- GA4 server-side events via Measurement Protocol
- Meta Conversions API for accurate attribution
- TrackingEvent table for event log and replay

### Backup
- Automated pg_dump on schedule
- AES-256-GCM encryption of dump file
- Upload to MinIO (or any S3-compatible store)
- Backup run history with status and checksum

## Admin Credentials (demo)

| Field | Value |
|-------|-------|
| Email | `admin@example.com` |
| Password | `Admin123!` |
| Role | `SUPER_ADMIN` |

## Demo Seed Data

After running `pnpm db:seed` the following data is available:

**Categories:** Ropa, Calzado, Accesorios, Electronica, Hogar

**Products:**

| Product | Price | Variants |
|---------|-------|---------|
| Camiseta Basica Blanca | $299 MXN | 6 (S/M/L x Blanco/Negro) |
| Tenis Running Pro | $1,299 MXN | 3 (tallas 26/27/28) |
| Bolsa de Mano Elegante | $799 MXN | 1 |
| Audifonos Bluetooth Max | $1,799 MXN | 1 |
| Set de Toallas Premium | $499 MXN | 1 |

**Coupon:** `DEMO10` -- 10% off (minimum order $500 MXN)

**Shipping Zone:** Zona Nacional (all MX states)
- Envio Estandar -- $99 MXN (5-7 business days)
- Envio Express -- $199 MXN (1-2 business days)
- Envio Gratis -- free on orders >= $999 MXN

## Running Tests

### Unit tests (Jest)

```bash
# All packages
pnpm test

# Watch mode
pnpm test --watch

# A specific service
pnpm --filter api test -- --testPathPattern inventory
```

### E2E tests (Playwright)

```bash
# Run all e2e tests (requires running web server)
pnpm test:e2e

# Run with UI (interactive)
pnpm exec playwright test --ui

# Run against a specific browser
pnpm exec playwright test --project=chromium

# Show the HTML report
pnpm exec playwright show-report
```

## Deployment

See [Deploy Runbook](./docs/runbooks/deploy.md) for step-by-step production deployment instructions.

### Docker Compose (production)

```bash
docker compose -f infra/docker-compose.prod.yml up -d
```

### Environment checklist before go-live

- [ ] All required env vars set (see table above)
- [ ] `DATABASE_URL` points to production PostgreSQL
- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` are >=32-char random strings
- [ ] `ENCRYPTION_KEY` is exactly 32 characters
- [ ] Stripe/MercadoPago/PayPal webhook endpoints registered
- [ ] Resend domain verified and DNS records set
- [ ] MinIO / S3 bucket created with appropriate ACL
- [ ] Sentry project created and DSN configured
- [ ] Traefik TLS certificates configured (Let's Encrypt)
- [ ] `pnpm db:migrate` run against production DB
- [ ] `pnpm db:seed` run once for initial data

## Links

- [Deploy Runbook](./docs/runbooks/deploy.md)
- [Backup / Restore Runbook](./docs/runbooks/backup-restore.md)
- [Assumptions and Decisions](./docs/ASSUMPTIONS.md)
- [API Docs](http://localhost:4000/api/docs) (when running locally)
