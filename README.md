# 🛒 Ecommerce Platform

> Plataforma de comercio electrónico full-stack de nivel producción, construida como monorepo con Next.js 14, NestJS y PostgreSQL.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![NestJS](https://img.shields.io/badge/NestJS-10-red?logo=nestjs)](https://nestjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?logo=postgresql)](https://postgresql.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)

---

## 📋 Tabla de contenido

- [Vista general](#-vista-general)
- [Stack tecnológico](#-stack-tecnológico)
- [Arquitectura](#-arquitectura)
- [Estructura del monorepo](#-estructura-del-monorepo)
- [Módulos de la API](#-módulos-de-la-api)
- [Panel de administración](#-panel-de-administración)
- [Setup rápido](#-setup-rápido)
- [Variables de entorno](#-variables-de-entorno)
- [Flujos principales](#-flujos-principales)

---

## 🌐 Vista general

Esta plataforma implementa un ecommerce completo con:

- **Catálogo** de +500K productos con variantes, imágenes y stock en tiempo real
- **Búsqueda** full-text con filtros por categoría, precio, stock y orden
- **Carrito** persistente por sesión (anónimo) o cuenta (autenticado)
- **Checkout** con múltiples métodos de pago y cálculo de envío
- **Panel admin** completo: estadísticas, gestión de productos, órdenes, clientes, inventario
- **Auth** con JWT + refresh tokens + roles (CUSTOMER / ADMIN / SUPER_ADMIN)
- **Precios en MXN**

---

## 🧰 Stack tecnológico

| Capa | Tecnología | Versión | Rol |
|---|---|---|---|
| **Frontend** | Next.js (App Router) | 14.2 | SSR / CSR, rutas, UI |
| **Estilos** | Tailwind CSS | 3.4 | Design system |
| **Estado** | TanStack Query | 5 | Cache y fetching |
| **API** | NestJS | 10 | REST API, guards, pipes |
| **ORM** | Prisma | 5 | Queries typesafe, migraciones |
| **Base de datos** | PostgreSQL | 15 | Datos principales |
| **Caché / Colas** | Redis | 7 | Sessions, BullMQ queues |
| **Búsqueda** | Meilisearch | 1.x | Full-text search |
| **Archivos** | MinIO | latest | Object storage S3-compatible |
| **Contenedores** | Docker Compose | v2 | Infra local / dev |
| **Monorepo** | pnpm workspaces | 8 | Gestión de paquetes |

---

## 🏗️ Arquitectura

```
                        ┌──────────────────────┐
                        │   Cliente (Browser)   │
                        └──────────┬───────────┘
                                   │ HTTPS
                        ┌──────────▼───────────┐
                        │   ngrok / Proxy TLS   │
                        └──────────┬───────────┘
                                   │
                  ┌────────────────┼────────────────┐
                  │                                  │
       ┌──────────▼──────────┐          ┌───────────▼────────┐
       │   Next.js 14        │          │   NestJS API        │
       │   :3000             │◄────────►│   :4000             │
       │                     │  /api/*  │                     │
       │  App Router (SSR)   │  proxy   │  REST + Guards      │
       │  TanStack Query     │          │  Prisma ORM         │
       │  Tailwind CSS       │          │  BullMQ Workers     │
       └─────────────────────┘          └─────────┬──────────┘
                                                  │
              ┌───────────────────────────────────┼────────────────────────┐
              │                                   │                        │
   ┌──────────▼──────┐               ┌────────────▼────┐       ┌──────────▼─────┐
   │   PostgreSQL    │               │     Redis        │       │  Meilisearch   │
   │   :5432         │               │     :6379        │       │  :7700         │
   │  534K+ productos│               │  Cache + Queues  │       │  Search index  │
   └─────────────────┘               └─────────────────┘       └────────────────┘
                                                  │
                                       ┌──────────▼──────────┐
                                       │       MinIO          │
                                       │       :9000          │
                                       │  Object Storage      │
                                       └─────────────────────┘
```

### Flujo de una request

```
Browser → ngrok → Next.js (3000)
                      │
                      ├─ Ruta pública ──► SSR / CSR directo
                      │
                      └─ /api/* ──proxy──► NestJS (4000)
                                               │
                                               ├─ JwtAuthGuard
                                               ├─ RolesGuard
                                               ├─ ValidationPipe
                                               └─ Controller → Service → Prisma → PostgreSQL
```

---

## 📁 Estructura del monorepo

```
ecommerce/
├── apps/
│   ├── api/                        # NestJS REST API
│   │   ├── src/
│   │   │   ├── auth/               # JWT, refresh tokens, 2FA
│   │   │   ├── catalog/            # Productos, variantes, categorías
│   │   │   ├── cart/               # Carrito (anónimo + autenticado)
│   │   │   ├── checkout/           # Proceso de compra
│   │   │   ├── orders/             # Gestión de órdenes
│   │   │   ├── payments/           # Integración de pagos
│   │   │   ├── inventory/          # Control de stock
│   │   │   ├── shipping/           # Zonas y métodos de envío
│   │   │   ├── search/             # Meilisearch integration
│   │   │   ├── users/              # Gestión de usuarios
│   │   │   ├── promos/             # Cupones y promociones
│   │   │   ├── reviews/            # Reseñas de productos
│   │   │   ├── notifications/      # Email + push
│   │   │   ├── audit/              # Log de auditoría
│   │   │   ├── fraud/              # Detección de fraude
│   │   │   ├── settings/           # Configuración global
│   │   │   ├── tax/                # Cálculo de impuestos
│   │   │   ├── chat/               # Chat de soporte
│   │   │   ├── features/           # Feature flags
│   │   │   ├── import-export/      # Importación masiva
│   │   │   ├── health/             # Healthcheck endpoints
│   │   │   ├── common/             # Guards, decorators, pipes
│   │   │   ├── prisma/             # PrismaService
│   │   │   └── main.ts
│   │   └── prisma/schema.prisma    # Schema de base de datos
│   │
│   └── web/                        # Next.js 14 Frontend
│       └── src/app/
│           ├── (store)/            # Tienda pública
│           │   ├── page.tsx        # Home
│           │   ├── productos/      # Catálogo PLP + PDP
│           │   ├── buscar/         # Búsqueda
│           │   ├── carrito/        # Carrito
│           │   ├── checkout/       # Pago
│           │   ├── login/          # Inicio de sesión
│           │   └── register/       # Registro
│           └── admin/              # Panel administrativo
│               ├── page.tsx        # Dashboard
│               ├── productos/      # CRUD productos
│               ├── pedidos/        # Órdenes
│               ├── clientes/       # Usuarios
│               ├── inventario/     # Stock
│               ├── promos/         # Cupones
│               └── settings/       # Configuración
│
├── scripts/                        # Seeds y utilidades
├── infra/compose/                  # Docker Compose configs
├── docs/                           # Documentación técnica
│   ├── ASSUMPTIONS.md              # Decisiones de arquitectura
│   └── runbooks/                   # Runbooks operacionales
├── pnpm-workspace.yaml
└── turbo.json
```

---

## 🔌 Módulos de la API

### Auth — `/api/auth`

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/register` | Registro de usuario |
| POST | `/auth/login` | Login → `{ user, tokens }` |
| POST | `/auth/refresh` | Renovar access token |
| POST | `/auth/logout` | Invalidar tokens |
| GET | `/auth/me` | Perfil del usuario actual |

### Catálogo — `/api/products`, `/api/categories`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/products` | Listado con filtros: `q`, `categoryId`, `status`, `page`, `limit` |
| GET | `/products/:slug` | Detalle con variantes e imágenes |
| POST | `/products` | Crear producto (admin) |
| PATCH | `/products/:id` | Actualizar producto (admin) |
| DELETE | `/products/:id` | Eliminar producto (admin) |
| GET | `/categories` | Árbol de categorías |

### Carrito — `/api/cart`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/cart?sessionId=xxx` | Obtener o crear carrito |
| POST | `/cart/items?cartId=xxx` | Agregar ítem `{ variantId, quantity }` |
| PATCH | `/cart/items/:id?cartId=xxx` | Actualizar cantidad |
| DELETE | `/cart/items/:id?cartId=xxx` | Eliminar ítem |

### Órdenes — `/api/orders`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/orders` | Listar (admin: todas; customer: propias) |
| GET | `/orders/:id` | Detalle de orden |
| POST | `/orders` | Crear desde checkout |
| PATCH | `/orders/:id/status` | Actualizar estado (admin) |

---

## 🖥️ Panel de administración

| Ruta | Descripción |
|---|---|
| `/admin` | Dashboard con KPIs y gráfica de ventas (30 días) |
| `/admin/productos` | CRUD de productos, filtros, bulk actions |
| `/admin/pedidos` | Gestión de órdenes y cambio de estado |
| `/admin/clientes` | Lista de usuarios registrados |
| `/admin/inventario` | Control de stock y alertas de bajo inventario |
| `/admin/promos` | Cupones y descuentos |
| `/admin/envios` | Zonas y métodos de envío |
| `/admin/impuestos` | Configuración fiscal |
| `/admin/fraude` | Reglas y eventos anti-fraude |
| `/admin/auditoria` | Log de todas las acciones del sistema |
| `/admin/settings` | Configuración general, moneda, email, gateways |

**Acceso:** `admin@example.com` / `Admin123!`

---

## ⚡ Setup rápido

### Requisitos

- Node.js ≥ 18
- pnpm ≥ 8
- Docker + Docker Compose v2

### Instalación

```bash
# 1. Clonar
git clone https://github.com/Luisesh1/ecommerce-platform.git
cd ecommerce-platform

# 2. Variables de entorno
cp .env.example .env   # y editar con tus valores

# 3. Infraestructura (PostgreSQL, Redis, Meilisearch, MinIO)
docker compose -f infra/compose/docker-compose.dev.yml up -d

# 4. Dependencias
pnpm install

# 5. Migrar base de datos
cd apps/api
npx prisma migrate dev

# 6. Seed inicial
npx prisma db seed

# 7. Compilar y levantar API
npx tsc --skipLibCheck
node dist/src/main.js &

# 8. Frontend
cd ../web
npx next dev -p 3000
```

### URLs de desarrollo

| Servicio | URL | Credenciales |
|---|---|---|
| Tienda | http://localhost:3000 | — |
| Admin | http://localhost:3000/admin | admin@example.com / Admin123! |
| API | http://localhost:4000/api | — |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |

### Usuarios demo (password: `Demo1234!`)

- `carlos.lopez@demo.com`
- `ana.martinez@demo.com`
- `jorge.garcia@demo.com`
- `sofia.rodriguez@demo.com`

---

## 🔑 Variables de entorno

```env
# Base de datos
DATABASE_URL=postgresql://user:pass@localhost:5432/ecommerce

# JWT
JWT_SECRET=change-me
JWT_REFRESH_SECRET=change-me-too
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Meilisearch
MEILISEARCH_HOST=http://localhost:7700

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# App
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

Ver [`.env.example`](.env.example) para la lista completa.

---

## 🔄 Flujos principales

### Compra

```
1. /productos      → filtra catálogo (categoría, precio, stock)
2. /productos/slug → elige variante → "Agregar al carrito"
3. /carrito        → revisa ítems, aplica cupón DEMO10
4. /checkout       → dirección → método de pago → confirmar
5. Orden creada    → email de confirmación → tracking
```

### Autenticación

```
POST /auth/login
  → { user, tokens: { accessToken, refreshToken } }
  → accessToken en localStorage (cabecera Authorization: Bearer)
  → refreshToken en cookie HTTP-only (auto-renovación)
```

### Búsqueda

```
GET /api/products?q=laptop&categoryId=xyz&inStock=true&sort=price_asc
  → Prisma: WHERE title ILIKE '%laptop%'
            AND category.id = xyz
            AND variants.some(inventoryLevel.quantity > 0)
    ORDER BY price ASC
```

---

## 📊 Datos de seed

**534,015 productos** distribuidos en 5 categorías con imágenes de Unsplash:

| Categoría | ~Productos |
|---|---|
| Electrónica | 107K |
| Ropa | 107K |
| Hogar | 107K |
| Deportes | 107K |
| Juguetes | 106K |

Precios almacenados en **centavos MXN** en PostgreSQL.

---

## 🧪 Tests E2E

```bash
cd apps/web
npx playwright test
# 34 casos — home, catálogo, búsqueda, carrito, auth, admin
```

---

## 📚 Documentación adicional

- [Decisiones de arquitectura](docs/ASSUMPTIONS.md)
- [Runbooks operacionales](docs/runbooks/)

---

## 📄 Licencia

MIT © 2026
