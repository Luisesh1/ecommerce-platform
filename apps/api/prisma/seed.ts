import {
  PrismaClient,
  UserRole,
  ProductStatus,
  InventoryPolicy,
  CouponStatus,
  ShippingRuleType,
  DiscountType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** All Mexican state codes / names used for the shipping zone */
const MX_STATES = [
  'AGU', 'BCN', 'BCS', 'CAM', 'CHP', 'CHH', 'COA', 'COL',
  'CMX', 'DUR', 'GUA', 'GRO', 'HID', 'JAL', 'MEX', 'MIC',
  'MOR', 'NAY', 'NLE', 'OAX', 'PUE', 'QUE', 'ROO', 'SLP',
  'SIN', 'SON', 'TAB', 'TAM', 'TLA', 'VER', 'YUC', 'ZAC',
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('🌱 Starting seed...');

  // -------------------------------------------------------------------------
  // 1. Admin user
  // -------------------------------------------------------------------------
  console.log('👤 Creating admin user...');
  const passwordHash = await bcrypt.hash('Admin123!', 12);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      passwordHash,
      emailVerified: true,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
    create: {
      email: 'admin@example.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.SUPER_ADMIN,
      emailVerified: true,
      isActive: true,
      marketingConsent: false,
    },
  });
  console.log(`   ✔ Admin user: ${adminUser.email} (id=${adminUser.id})`);

  // -------------------------------------------------------------------------
  // 2. Categories
  // -------------------------------------------------------------------------
  console.log('📂 Creating categories...');

  const categoryDefs = [
    { name: 'Ropa',        slug: 'ropa',        sortOrder: 1 },
    { name: 'Calzado',     slug: 'calzado',     sortOrder: 2 },
    { name: 'Accesorios',  slug: 'accesorios',  sortOrder: 3 },
    { name: 'Electrónica', slug: 'electronica', sortOrder: 4 },
    { name: 'Hogar',       slug: 'hogar',       sortOrder: 5 },
  ];

  const categories: Record<string, string> = {}; // slug -> id

  for (const def of categoryDefs) {
    const cat = await prisma.category.upsert({
      where: { slug: def.slug },
      update: { name: def.name, sortOrder: def.sortOrder, isActive: true },
      create: {
        name: def.name,
        slug: def.slug,
        sortOrder: def.sortOrder,
        isActive: true,
      },
    });
    categories[def.slug] = cat.id;
    console.log(`   ✔ Category: ${cat.name}`);
  }

  // -------------------------------------------------------------------------
  // 3. Products + variants + inventory
  // -------------------------------------------------------------------------
  console.log('🛍  Creating products...');

  // --- 3.1 Camiseta Básica Blanca ---
  const camiseta = await prisma.product.upsert({
    where: { slug: 'camiseta-basica-blanca' },
    update: {
      status: ProductStatus.ACTIVE,
      publishedAt: new Date(),
    },
    create: {
      title: 'Camiseta Básica Blanca',
      slug: 'camiseta-basica-blanca',
      description:
        'Camiseta de algodón 100% de alta calidad, disponible en tallas S, M y L y en colores Blanco y Negro.',
      shortDescription: 'Camiseta básica de algodón premium.',
      status: ProductStatus.ACTIVE,
      categoryId: categories['ropa'],
      taxable: true,
      requiresShipping: true,
      weight: 0.25,
      publishedAt: new Date(),
    },
  });

  const camisetaVariants = [
    { sku: 'CAM-BLA-S', title: 'Blanco / S',  options: { talla: 'S', color: 'Blanco' }, price: 29900 },
    { sku: 'CAM-BLA-M', title: 'Blanco / M',  options: { talla: 'M', color: 'Blanco' }, price: 29900 },
    { sku: 'CAM-BLA-L', title: 'Blanco / L',  options: { talla: 'L', color: 'Blanco' }, price: 29900 },
    { sku: 'CAM-NEG-S', title: 'Negro / S',   options: { talla: 'S', color: 'Negro'  }, price: 29900 },
    { sku: 'CAM-NEG-M', title: 'Negro / M',   options: { talla: 'M', color: 'Negro'  }, price: 29900 },
    { sku: 'CAM-NEG-L', title: 'Negro / L',   options: { talla: 'L', color: 'Negro'  }, price: 29900 },
  ];

  for (let i = 0; i < camisetaVariants.length; i++) {
    const v = camisetaVariants[i];
    const variant = await prisma.productVariant.upsert({
      where: { sku: v.sku },
      update: { price: v.price, isActive: true },
      create: {
        productId: camiseta.id,
        sku: v.sku,
        title: v.title,
        price: v.price,
        options: v.options,
        inventoryPolicy: InventoryPolicy.DENY,
        position: i,
        isActive: true,
      },
    });
    await prisma.inventoryLevel.upsert({
      where: { variantId: variant.id },
      update: { quantity: 50, reservedQuantity: 0 },
      create: { variantId: variant.id, quantity: 50, reservedQuantity: 0 },
    });
  }
  console.log(`   ✔ Camiseta Básica Blanca (${camisetaVariants.length} variantes)`);

  // --- 3.2 Tenis Running Pro ---
  const tenis = await prisma.product.upsert({
    where: { slug: 'tenis-running-pro' },
    update: { status: ProductStatus.ACTIVE, publishedAt: new Date() },
    create: {
      title: 'Tenis Running Pro',
      slug: 'tenis-running-pro',
      description:
        'Tenis de alto rendimiento para corredores. Suela de goma antideslizante y upper transpirable.',
      shortDescription: 'Tenis running de alto rendimiento.',
      status: ProductStatus.ACTIVE,
      categoryId: categories['calzado'],
      taxable: true,
      requiresShipping: true,
      weight: 0.6,
      publishedAt: new Date(),
    },
  });

  const tenisVariants = [
    { sku: 'TEN-RUN-26', title: 'Talla 26', options: { talla: '26' }, price: 129900 },
    { sku: 'TEN-RUN-27', title: 'Talla 27', options: { talla: '27' }, price: 129900 },
    { sku: 'TEN-RUN-28', title: 'Talla 28', options: { talla: '28' }, price: 129900 },
  ];

  for (let i = 0; i < tenisVariants.length; i++) {
    const v = tenisVariants[i];
    const variant = await prisma.productVariant.upsert({
      where: { sku: v.sku },
      update: { price: v.price, isActive: true },
      create: {
        productId: tenis.id,
        sku: v.sku,
        title: v.title,
        price: v.price,
        options: v.options,
        inventoryPolicy: InventoryPolicy.DENY,
        position: i,
        isActive: true,
      },
    });
    await prisma.inventoryLevel.upsert({
      where: { variantId: variant.id },
      update: { quantity: 30, reservedQuantity: 0 },
      create: { variantId: variant.id, quantity: 30, reservedQuantity: 0 },
    });
  }
  console.log(`   ✔ Tenis Running Pro (${tenisVariants.length} variantes)`);

  // --- 3.3 Bolsa de Mano Elegante ---
  const bolsa = await prisma.product.upsert({
    where: { slug: 'bolsa-de-mano-elegante' },
    update: { status: ProductStatus.ACTIVE, publishedAt: new Date() },
    create: {
      title: 'Bolsa de Mano Elegante',
      slug: 'bolsa-de-mano-elegante',
      description:
        'Bolsa de mano de cuero sintético de alta gama. Perfecta para ocasiones formales.',
      shortDescription: 'Bolsa de mano de cuero sintético.',
      status: ProductStatus.ACTIVE,
      categoryId: categories['accesorios'],
      taxable: true,
      requiresShipping: true,
      weight: 0.4,
      publishedAt: new Date(),
    },
  });

  const bolsaVariant = await prisma.productVariant.upsert({
    where: { sku: 'BOL-MAN-UNI' },
    update: { price: 79900, isActive: true },
    create: {
      productId: bolsa.id,
      sku: 'BOL-MAN-UNI',
      title: 'Única',
      price: 79900,
      options: { color: 'Negro' },
      inventoryPolicy: InventoryPolicy.DENY,
      position: 0,
      isActive: true,
    },
  });
  await prisma.inventoryLevel.upsert({
    where: { variantId: bolsaVariant.id },
    update: { quantity: 20, reservedQuantity: 0 },
    create: { variantId: bolsaVariant.id, quantity: 20, reservedQuantity: 0 },
  });
  console.log('   ✔ Bolsa de Mano Elegante (1 variante)');

  // --- 3.4 Audífonos Bluetooth Max ---
  const audifonos = await prisma.product.upsert({
    where: { slug: 'audifonos-bluetooth-max' },
    update: { status: ProductStatus.ACTIVE, publishedAt: new Date() },
    create: {
      title: 'Audífonos Bluetooth Max',
      slug: 'audifonos-bluetooth-max',
      description:
        'Audífonos inalámbricos con cancelación de ruido activa (ANC), hasta 30 horas de batería y carga rápida USB-C.',
      shortDescription: 'Audífonos Bluetooth con ANC y 30h de batería.',
      status: ProductStatus.ACTIVE,
      categoryId: categories['electronica'],
      taxable: true,
      requiresShipping: true,
      weight: 0.28,
      publishedAt: new Date(),
    },
  });

  const audioVariant = await prisma.productVariant.upsert({
    where: { sku: 'AUD-BT-MAX-NEG' },
    update: { price: 179900, isActive: true },
    create: {
      productId: audifonos.id,
      sku: 'AUD-BT-MAX-NEG',
      title: 'Negro',
      price: 179900,
      options: { color: 'Negro' },
      inventoryPolicy: InventoryPolicy.DENY,
      position: 0,
      isActive: true,
    },
  });
  await prisma.inventoryLevel.upsert({
    where: { variantId: audioVariant.id },
    update: { quantity: 15, reservedQuantity: 0 },
    create: { variantId: audioVariant.id, quantity: 15, reservedQuantity: 0 },
  });
  console.log('   ✔ Audífonos Bluetooth Max (1 variante)');

  // --- 3.5 Set de Toallas Premium ---
  const toallas = await prisma.product.upsert({
    where: { slug: 'set-de-toallas-premium' },
    update: { status: ProductStatus.ACTIVE, publishedAt: new Date() },
    create: {
      title: 'Set de Toallas Premium',
      slug: 'set-de-toallas-premium',
      description:
        'Set de 4 toallas 100% algodón egipcio 600 GSM. Incluye 2 toallas de baño, 1 de manos y 1 facial.',
      shortDescription: 'Set 4 toallas algodón egipcio 600 GSM.',
      status: ProductStatus.ACTIVE,
      categoryId: categories['hogar'],
      taxable: true,
      requiresShipping: true,
      weight: 1.2,
      publishedAt: new Date(),
    },
  });

  const toallasVariant = await prisma.productVariant.upsert({
    where: { sku: 'TOA-SET-PRE-BLA' },
    update: { price: 49900, isActive: true },
    create: {
      productId: toallas.id,
      sku: 'TOA-SET-PRE-BLA',
      title: 'Blanco',
      price: 49900,
      options: { color: 'Blanco' },
      inventoryPolicy: InventoryPolicy.DENY,
      position: 0,
      isActive: true,
    },
  });
  await prisma.inventoryLevel.upsert({
    where: { variantId: toallasVariant.id },
    update: { quantity: 40, reservedQuantity: 0 },
    create: { variantId: toallasVariant.id, quantity: 40, reservedQuantity: 0 },
  });
  console.log('   ✔ Set de Toallas Premium (1 variante)');

  // -------------------------------------------------------------------------
  // 4. Feature flags
  // -------------------------------------------------------------------------
  console.log('🚩 Creating feature flags...');

  const featureFlags = [
    { key: 'checkout_paypal',       name: 'Checkout con PayPal',            isEnabled: true,  description: 'Habilita el método de pago PayPal en checkout' },
    { key: 'checkout_mercadopago',  name: 'Checkout con MercadoPago',       isEnabled: true,  description: 'Habilita el método de pago MercadoPago en checkout' },
    { key: 'checkout_stripe',       name: 'Checkout con Stripe',            isEnabled: true,  description: 'Habilita el método de pago Stripe en checkout' },
    { key: 'reviews_enabled',       name: 'Reseñas de productos',           isEnabled: true,  description: 'Habilita el módulo de reseñas de productos' },
    { key: 'wishlist_enabled',      name: 'Lista de deseos',                isEnabled: true,  description: 'Habilita el módulo de lista de deseos' },
    { key: 'chat_enabled',          name: 'Chat en vivo',                   isEnabled: true,  description: 'Habilita el widget de chat en tiempo real' },
    { key: 'push_notifications',    name: 'Notificaciones push',            isEnabled: false, description: 'Habilita las notificaciones push (Web Push API)' },
    { key: 'pwa_enabled',           name: 'Progressive Web App',            isEnabled: false, description: 'Habilita el service worker y manifiesto PWA' },
    { key: 'analytics_tracking',    name: 'Seguimiento analítico',          isEnabled: true,  description: 'Envía eventos a GA4 y Meta Conversions API' },
    { key: 'abandoned_cart_emails', name: 'Emails de carrito abandonado',   isEnabled: true,  description: 'Envía emails automáticos por carritos abandonados' },
  ];

  for (const flag of featureFlags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: { isEnabled: flag.isEnabled, name: flag.name, description: flag.description },
      create: {
        key: flag.key,
        name: flag.name,
        description: flag.description,
        isEnabled: flag.isEnabled,
      },
    });
    console.log(`   ✔ Flag: ${flag.key} = ${flag.isEnabled}`);
  }

  // -------------------------------------------------------------------------
  // 5. Settings
  // -------------------------------------------------------------------------
  console.log('⚙️  Creating settings...');

  const settings = [
    { key: 'store_name',          value: 'Mi Tienda',              group: 'general',   description: 'Nombre de la tienda' },
    { key: 'store_email',         value: 'contacto@example.com',   group: 'general',   description: 'Email de contacto principal' },
    { key: 'store_currency',      value: 'MXN',                    group: 'general',   description: 'Moneda por defecto' },
    { key: 'store_locale',        value: 'es-MX',                  group: 'general',   description: 'Localización por defecto' },
    { key: 'tax_rate',            value: '16',                     group: 'taxes',     description: 'Tasa de IVA (%)' },
    { key: 'tax_inclusive',       value: 'false',                  group: 'taxes',     description: 'Los precios incluyen IVA' },
    { key: 'low_stock_threshold', value: '5',                      group: 'inventory', description: 'Umbral de stock bajo' },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, group: setting.group, description: setting.description },
      create: {
        key: setting.key,
        value: setting.value,
        group: setting.group,
        description: setting.description,
        isEncrypted: false,
      },
    });
    console.log(`   ✔ Setting: ${setting.key} = ${setting.value}`);
  }

  // -------------------------------------------------------------------------
  // 6. Shipping zones & methods — Mexico
  // -------------------------------------------------------------------------
  console.log('🚚 Creating shipping zones...');

  // Find or create the national MX shipping zone
  let zonaNacional = await prisma.shippingZone.findFirst({
    where: { name: 'Zona Nacional' },
  });

  if (!zonaNacional) {
    zonaNacional = await prisma.shippingZone.create({
      data: {
        name: 'Zona Nacional',
        countries: ['MX'],
        states: MX_STATES,
        postalCodes: [],
        isDefault: true,
      },
    });
    console.log(`   ✔ ShippingZone: ${zonaNacional.name} (id=${zonaNacional.id})`);
  } else {
    // Update states / countries in case they changed
    zonaNacional = await prisma.shippingZone.update({
      where: { id: zonaNacional.id },
      data: {
        countries: ['MX'],
        states: MX_STATES,
        isDefault: true,
      },
    });
    console.log(`   ✔ ShippingZone (existing): ${zonaNacional.name}`);
  }

  // Shipping methods for the zone (upsert by name + zone)
  const shippingMethods = [
    {
      name: 'Envío Estándar',
      description: 'Entrega en 5-7 días hábiles',
      type: ShippingRuleType.FLAT_RATE,
      price: 9900,          // $99 MXN in cents
      minOrderAmount: null,
      freeShippingThreshold: null,
      estimatedDaysMin: 5,
      estimatedDaysMax: 7,
      sortOrder: 0,
    },
    {
      name: 'Envío Express',
      description: 'Entrega en 1-2 días hábiles',
      type: ShippingRuleType.FLAT_RATE,
      price: 19900,         // $199 MXN in cents
      minOrderAmount: null,
      freeShippingThreshold: null,
      estimatedDaysMin: 1,
      estimatedDaysMax: 2,
      sortOrder: 1,
    },
    {
      name: 'Envío Gratis',
      description: 'Envío gratis en pedidos mayores a $999 MXN',
      type: ShippingRuleType.FREE,
      price: 0,
      minOrderAmount: 99900, // $999 MXN in cents
      freeShippingThreshold: 99900,
      estimatedDaysMin: 5,
      estimatedDaysMax: 7,
      sortOrder: 2,
    },
  ];

  for (const method of shippingMethods) {
    const existing = await prisma.shippingMethod.findFirst({
      where: { zoneId: zonaNacional.id, name: method.name },
    });

    if (existing) {
      await prisma.shippingMethod.update({
        where: { id: existing.id },
        data: {
          type: method.type,
          price: method.price,
          minOrderAmount: method.minOrderAmount,
          freeShippingThreshold: method.freeShippingThreshold,
          estimatedDaysMin: method.estimatedDaysMin,
          estimatedDaysMax: method.estimatedDaysMax,
          sortOrder: method.sortOrder,
          isActive: true,
        },
      });
    } else {
      await prisma.shippingMethod.create({
        data: {
          zoneId: zonaNacional.id,
          name: method.name,
          description: method.description,
          type: method.type,
          price: method.price,
          minOrderAmount: method.minOrderAmount,
          freeShippingThreshold: method.freeShippingThreshold,
          estimatedDaysMin: method.estimatedDaysMin,
          estimatedDaysMax: method.estimatedDaysMax,
          sortOrder: method.sortOrder,
          isActive: true,
        },
      });
    }
    console.log(`   ✔ ShippingMethod: ${method.name} ($${method.price / 100} MXN)`);
  }

  // -------------------------------------------------------------------------
  // 7. Demo coupon — DEMO10
  // -------------------------------------------------------------------------
  console.log('🎟  Creating demo coupon...');

  await prisma.promotion.upsert({
    where: { code: 'DEMO10' },
    update: {
      status: CouponStatus.ACTIVE,
      discountValue: 10,
    },
    create: {
      code: 'DEMO10',
      title: '10% de descuento',
      description: 'Cupón de demostración — 10% de descuento en tu pedido',
      discountType: DiscountType.PERCENTAGE,
      discountValue: 10,
      minimumOrderAmount: 50000, // $500 MXN
      usageLimit: 100,
      usageLimitPerCustomer: 1,
      isCombinable: false,
      freeShipping: false,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2027-12-31'),
      status: CouponStatus.ACTIVE,
      applicableProductIds: [],
      applicableCategoryIds: [],
      excludedProductIds: [],
    },
  });
  console.log('   ✔ Coupon: DEMO10 (10%)');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

main()
  .then(async () => {
    console.log('✅ Seed complete!');
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
