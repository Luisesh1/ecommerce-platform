export const ORDER_STATUS = {
  PENDING: 'PENDING',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  CONFIRMED: 'CONFIRMED',
  PROCESSING: 'PROCESSING',
  PACKED: 'PACKED',
  SHIPPED: 'SHIPPED',
  IN_TRANSIT: 'IN_TRANSIT',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  REFUND_REQUESTED: 'REFUND_REQUESTED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  FULLY_REFUNDED: 'FULLY_REFUNDED',
  RETURN_REQUESTED: 'RETURN_REQUESTED',
  RETURNED: 'RETURNED',
} as const;

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  AUTHORIZED: 'AUTHORIZED',
  CAPTURED: 'CAPTURED',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REFUND_PENDING: 'REFUND_PENDING',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  FULLY_REFUNDED: 'FULLY_REFUNDED',
  CHARGEBACK: 'CHARGEBACK',
} as const;

export const USER_ROLE = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  SUPPORT: 'SUPPORT',
  CUSTOMER: 'CUSTOMER',
} as const;

export const QUEUES = {
  EMAILS: 'emails',
  WEBHOOKS: 'webhooks',
  INVENTORY_EXPIRY: 'inventory-expiry',
  ABANDONED_CART: 'abandoned-cart',
  SEARCH_INDEX: 'search-index',
  IMPORT_EXPORT: 'import-export',
  NOTIFICATIONS: 'notifications',
  BACK_IN_STOCK: 'back-in-stock',
  TRACKING: 'tracking',
  PDF_GENERATION: 'pdf-generation',
  ORDER_PROCESSING: 'order-processing',
} as const;

export const DEAD_LETTER_QUEUES = {
  EMAILS_DLQ: 'emails-dlq',
  WEBHOOKS_DLQ: 'webhooks-dlq',
  INVENTORY_EXPIRY_DLQ: 'inventory-expiry-dlq',
  ABANDONED_CART_DLQ: 'abandoned-cart-dlq',
  SEARCH_INDEX_DLQ: 'search-index-dlq',
  NOTIFICATIONS_DLQ: 'notifications-dlq',
  BACK_IN_STOCK_DLQ: 'back-in-stock-dlq',
} as const;

export const CACHE_KEYS = {
  FEATURE_FLAGS: 'feature-flags',
  CART: (id: string) => `cart:${id}`,
  PRODUCT: (id: string) => `product:${id}`,
  CATEGORY_TREE: 'category-tree',
  SETTINGS: 'settings',
  SHIPPING_ZONES: 'shipping-zones',
  TAX_RATES: 'tax-rates',
  GATEWAY_CONFIGS: 'gateway-configs',
} as const;

export const CACHE_TTL = {
  FEATURE_FLAGS: 60,
  CART: 3600,
  PRODUCT: 300,
  CATEGORY_TREE: 600,
  SETTINGS: 300,
  GATEWAY_CONFIGS: 300,
  SESSION: 604800,
} as const;

export const INVENTORY_RESERVATION_TTL_MINUTES = 15;
export const DEFAULT_CURRENCY = 'MXN';
export const DEFAULT_LOCALE = 'es-MX';
export const DEFAULT_TIMEZONE = 'America/Mexico_City';
export const DEFAULT_TAX_RATE = 0.16;
export const LOW_STOCK_THRESHOLD = 5;
export const MAX_CART_ITEM_QUANTITY = 100;
export const MAX_UPLOAD_SIZE_MB = 10;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const ALLOWED_CSV_TYPES = ['text/csv', 'application/csv'];
export const ORDER_NUMBER_PREFIX = 'ORD';
export const ABANDONED_CART_DELAY_HOURS = [1, 24, 72];
export const MAX_WISHLIST_ITEMS = 100;
export const MAX_REVIEWS_PER_PRODUCT = 1;
export const SEARCH_INDEX_NAME = 'products';
export const MIN_SEARCH_CHARS = 2;
export const RATE_LIMIT = {
  GLOBAL: { ttl: 60, max: 100 },
  AUTH: { ttl: 300, max: 10 },
  CHECKOUT: { ttl: 60, max: 5 },
  WEBHOOKS: { ttl: 10, max: 50 },
  PASSWORD_RESET: { ttl: 3600, max: 3 },
} as const;

export const BCRYPT_ROUNDS = 12;
export const JWT_COOKIE_NAME = 'access_token';
export const REFRESH_COOKIE_NAME = 'refresh_token';
export const REQUEST_ID_HEADER = 'x-request-id';
export const CORRELATION_ID_HEADER = 'x-correlation-id';

export const EMAIL_TEMPLATES = {
  WELCOME: 'welcome',
  EMAIL_VERIFICATION: 'email-verification',
  PASSWORD_RESET: 'password-reset',
  ORDER_CONFIRMATION: 'order-confirmation',
  ORDER_SHIPPED: 'order-shipped',
  ORDER_DELIVERED: 'order-delivered',
  ORDER_CANCELLED: 'order-cancelled',
  REFUND_CONFIRMATION: 'refund-confirmation',
  ABANDONED_CART_1H: 'abandoned-cart-1h',
  ABANDONED_CART_24H: 'abandoned-cart-24h',
  ABANDONED_CART_72H: 'abandoned-cart-72h',
  BACK_IN_STOCK: 'back-in-stock',
  LOW_STOCK_ALERT: 'low-stock-alert',
  TWO_FACTOR_CODE: 'two-factor-code',
} as const;

export const SETTINGS_KEYS = {
  STORE_NAME: 'store.name',
  STORE_EMAIL: 'store.email',
  STORE_PHONE: 'store.phone',
  STORE_ADDRESS: 'store.address',
  STORE_LOGO: 'store.logo',
  STORE_FAVICON: 'store.favicon',
  STORE_CURRENCY: 'store.currency',
  STORE_TIMEZONE: 'store.timezone',
  STORE_LOCALE: 'store.locale',
  STORE_META_TITLE: 'store.metaTitle',
  STORE_META_DESCRIPTION: 'store.metaDescription',
  GA4_MEASUREMENT_ID: 'tracking.ga4MeasurementId',
  GA4_API_SECRET: 'tracking.ga4ApiSecret',
  META_PIXEL_ID: 'tracking.metaPixelId',
  META_ACCESS_TOKEN: 'tracking.metaAccessToken',
  SMTP_FROM: 'email.smtpFrom',
  SMTP_FROM_NAME: 'email.smtpFromName',
  TAX_RATE: 'tax.defaultRate',
  TAX_INCLUSIVE: 'tax.inclusive',
  MAINTENANCE_MODE: 'system.maintenanceMode',
  MAINTENANCE_MESSAGE: 'system.maintenanceMessage',
} as const;
