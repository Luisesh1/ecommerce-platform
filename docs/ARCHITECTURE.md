# Arquitectura del Sistema

## Visión general

El sistema está diseñado como un **monorepo de dos aplicaciones** (`api` + `web`) que comparten infraestructura a través de Docker Compose. La comunicación entre frontend y backend ocurre exclusivamente vía HTTP REST, con el frontend actuando como proxy para las rutas `/api/*`.

---

## Diagrama de componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTE                                  │
│                    (Browser / Mobile)                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS
                ┌──────────▼──────────┐
                │    Reverse Proxy     │
                │  (ngrok / Traefik)   │
                └──────┬──────────────┘
                       │
         ┌─────────────┼──────────────┐
         │             │              │
  ┌──────▼──────┐      │       Rutas /api/*
  │  Next.js    │      │       (rewrite proxy)
  │  :3000      │──────┘──────►┌──────────────┐
  │             │              │   NestJS API  │
  │  SSR pages  │              │   :4000       │
  │  React CSR  │              │               │
  └─────────────┘              │  Controllers  │
                               │  Services     │
                               │  Guards       │
                               │  Pipes        │
                               └──────┬────────┘
                                      │
              ┌───────────────────────┼──────────────────────┐
              │                       │                      │
    ┌─────────▼────────┐   ┌──────────▼──────┐   ┌──────────▼────┐
    │   PostgreSQL     │   │     Redis        │   │  Meilisearch  │
    │   (Prisma ORM)   │   │                  │   │               │
    │                  │   │  ┌────────────┐  │   │  Índice de    │
    │  Products        │   │  │  Cache     │  │   │  búsqueda     │
    │  Orders          │   │  │  Sessions  │  │   │  full-text    │
    │  Users           │   │  │  Blacklist │  │   │               │
    │  Categories      │   │  └────────────┘  │   └───────────────┘
    │  Variants        │   │  ┌────────────┐  │
    │  Inventory       │   │  │  BullMQ    │  │   ┌───────────────┐
    │  Carts           │   │  │  Queues:   │  │   │    MinIO      │
    │  ...             │   │  │  - email   │  │   │               │
    └──────────────────┘   │  │  - import  │  │   │  Imágenes     │
                           │  │  - notif   │  │   │  Exports CSV  │
                           │  └────────────┘  │   │               │
                           └──────────────────┘   └───────────────┘
```

---

## Módulos NestJS

### Dependencias entre módulos

```
AppModule
├── AuthModule          ← PrismaModule, RedisModule, UsersModule
├── CatalogModule       ← PrismaModule, SearchModule
├── CartModule          ← PrismaModule, RedisModule
├── CheckoutModule      ← CartModule, OrdersModule, PaymentsModule, ShippingModule
├── OrdersModule        ← PrismaModule, NotificationsModule
├── PaymentsModule      ← PrismaModule, OrdersModule
├── InventoryModule     ← PrismaModule
├── ShippingModule      ← PrismaModule
├── SearchModule        ← MeilisearchModule
├── UsersModule         ← PrismaModule
├── PromosModule        ← PrismaModule
├── ReviewsModule       ← PrismaModule
├── NotificationsModule ← RedisModule (BullMQ)
├── EmailModule         ← BullMQ queue
├── AuditModule         ← PrismaModule
├── FraudModule         ← PrismaModule, RedisModule
├── SettingsModule      ← PrismaModule, RedisModule
├── TaxModule           ← PrismaModule
├── ChatModule          ← PrismaModule
├── FeaturesModule      ← PrismaModule, RedisModule
├── ImportExportModule  ← PrismaModule, BullMQ
├── HealthModule        ← RedisModule
└── AdminStatsModule    ← PrismaModule
```

---

## Modelo de datos (simplificado)

```
User
├── id, email, passwordHash, role, isActive
├── → Cart (1:1 por sesión)
├── → Order (1:N)
├── → Review (1:N)
└── → Address (1:N)

Product
├── id, title, slug, description, status, vendor
├── → Category (N:1)
├── → ProductVariant (1:N)
└── → ProductImage (1:N)

ProductVariant
├── id, productId, sku, price (centavos), compareAtPrice
├── → InventoryLevel (1:1)
└── → CartItem (1:N)

InventoryLevel
├── variantId, quantity, reservedQuantity
└── → InventoryMovement (1:N)

Cart
├── id, sessionId, userId?, status, expiresAt
└── → CartItem (1:N)

CartItem
├── cartId, variantId, quantity, price (snapshot)

Order
├── id, userId, status, subtotal, shippingAmount, taxAmount, totalAmount (centavos)
├── → OrderItem (1:N)
├── → Address (shipping)
└── → Payment (1:1)

Category
├── id, name, slug, parentId?, imageUrl
└── → children (árbol recursivo)
```

---

## Seguridad

### Autenticación

```
Login ──► [email + password]
            │
            ▼
         bcrypt.compare()
            │
         ✅ OK
            │
     ┌──────┴───────────────────┐
     │                          │
accessToken (15min)    refreshToken (7 días)
JWT, signed HS256      JWT, signed HS256
→ localStorage         → HTTP-only cookie
→ Authorization: Bearer  → auto-renovación
```

### Guards aplicados

| Guard | Aplicación |
|---|---|
| `JwtAuthGuard` | Global (salvo rutas `@Public()`) |
| `RolesGuard` | Rutas admin con `@Roles(UserRole.ADMIN)` |
| `ThrottleGuard` | Rate limiting en auth endpoints |

### Roles

| Rol | Permisos |
|---|---|
| `CUSTOMER` | Tienda, carrito, órdenes propias, reseñas |
| `MANAGER` | + Inventario, reportes |
| `SUPPORT` | + Órdenes de todos, chat |
| `ADMIN` | + CRUD productos, usuarios, settings |
| `SUPER_ADMIN` | Todo sin restricciones |

---

## Colas BullMQ (Redis)

| Cola | Disparador | Procesador |
|---|---|---|
| `email` | Orden creada, registro, password reset | EmailService → SMTP/Resend |
| `notifications` | Eventos de sistema | Push notifications |
| `import` | Upload de CSV/Excel | ImportExportService → bulk insert |
| `inventory` | Stock bajo umbral | Alert → notificación admin |

---

## Estrategia de caché (Redis)

| Clave | TTL | Contenido |
|---|---|---|
| `settings:hash` | No expira | Configuración global (hash) |
| `jwt:blacklist:{jti}` | = expiración del token | Tokens revocados |
| `refresh:{userId}` | 7 días | Refresh token activo |
| `cart:{sessionId}` | 30 días | Referencia al cartId |
| `features:{key}` | 5 min | Feature flags |

---

## Decisiones técnicas clave

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Compilar TS → JS con `tsc` | `ts-node` en producción | ts-node genera 15+ workers, usa 6GB RAM vs 80MB |
| `setsid nohup node` | PM2 / systemd | Evita SIGTERM al cerrar shell padre |
| `<img>` sobre `<Image>` de Next.js | Next.js Image component | Bloquea dominios no configurados en dev |
| `/api/products` para búsqueda | Meilisearch | Índice de Meilisearch vacío; ILIKE en Postgres funciona bien para dev |
| `sessionId` como query param | Body param | Cart DTO solo acepta `variantId + quantity` en body |
| Precios en centavos (Int) | Decimal/Float | Evita errores de punto flotante en cálculos monetarios |

Ver [ASSUMPTIONS.md](ASSUMPTIONS.md) para el razonamiento completo de cada decisión.

---

## Performance

### Métricas de referencia (Raspberry Pi 4, 8GB)

| Métrica | Valor |
|---|---|
| RAM API (compilada) | ~80 MB |
| RAM Web (Next.js dev) | ~250 MB |
| Load average típico | ~2.5 |
| Productos en DB | 534,015 |
| Tiempo de respuesta `/products` | ~200ms |
| Tests E2E (34 casos) | ~12.6 min |

### Optimizaciones aplicadas

- API compilada a JS puro (no ts-node)
- Índices PostgreSQL en `slug`, `status`, `categoryId`, `createdAt`
- Paginación en todos los endpoints de listado (default `limit=25`)
- Imágenes cargadas con `loading="lazy"` y fallback a Unsplash
