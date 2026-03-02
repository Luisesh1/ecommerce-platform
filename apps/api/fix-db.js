const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });

const imagesByCategory = {
  ropa: [
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600',
    'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600',
    'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600',
    'https://images.unsplash.com/photo-1603252109303-2751441dd157?w=600',
    'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=600',
  ],
  calzado: [
    'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600',
    'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=600',
    'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600',
    'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=600',
  ],
  bolsas: [
    'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600',
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600',
    'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600',
  ],
  default: [
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600',
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600',
    'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=600',
    'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600',
    'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600',
    'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600',
    'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600',
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600',
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600',
    'https://images.unsplash.com/photo-1585792180666-f7347c490ee2?w=600',
    'https://images.unsplash.com/photo-1567581935884-3349723552ca?w=600',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600',
  ],
};
const r = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function main() {
  console.log('🚀 Actualizando imágenes y stock...\n');

  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const catMap = {};
  categories.forEach(c => {
    const slug = c.slug.toLowerCase();
    if (slug.includes('ropa') || slug.includes('moda')) catMap[c.id] = 'ropa';
    else if (slug.includes('calzado') || slug.includes('zapato')) catMap[c.id] = 'calzado';
    else if (slug.includes('bolsa') || slug.includes('accesorio')) catMap[c.id] = 'bolsas';
    else catMap[c.id] = 'default';
  });

  const totalProducts = await prisma.product.count();
  console.log(`📦 Productos: ${totalProducts.toLocaleString()}`);

  // 1. Limpiar imágenes previas
  await prisma.productImage.deleteMany({});
  console.log('🗑️  Imágenes anteriores eliminadas');

  // 2. Insertar imágenes en batches de 2000 productos
  const BATCH = 2000;
  let cursor = null;
  let totalImgs = 0;
  let processed = 0;

  console.log('📸 Insertando imágenes...');
  while (true) {
    const products = await prisma.product.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, categoryId: true },
      orderBy: { id: 'asc' },
    });
    if (!products.length) break;

    const imageRows = [];
    for (const p of products) {
      const pool = imagesByCategory[catMap[p.categoryId] || 'default'];
      const numImgs = Math.random() < 0.4 ? 2 : 1;
      for (let i = 0; i < numImgs; i++) {
        imageRows.push({ productId: p.id, url: r(pool), altText: null, sortOrder: i });
      }
    }
    await prisma.productImage.createMany({ data: imageRows });
    totalImgs += imageRows.length;
    processed += products.length;
    cursor = products[products.length - 1].id;
    if (processed % 20000 === 0) process.stdout.write(`  ${processed.toLocaleString()} / ${totalProducts.toLocaleString()}\r`);
  }
  console.log(`\n✅ ${totalImgs.toLocaleString()} imágenes insertadas`);

  // 3. Stock: 90% con stock, 10% agotado usando SQL directo
  console.log('\n📊 Actualizando stock (90% con disponibilidad)...');
  
  // Actualizar existentes: 90% con stock alto, 10% en cero
  await prisma.$executeRaw`
    UPDATE "InventoryLevel"
    SET quantity = CASE WHEN RANDOM() < 0.9 THEN FLOOR(RANDOM() * 200 + 5)::int ELSE 0 END,
        "reservedQuantity" = 0,
        "updatedAt" = NOW()
  `;
  console.log('  ✅ Inventory levels actualizados');

  // Crear inventory para variantes que no tienen
  const orphans = await prisma.$queryRaw`
    SELECT pv.id FROM "ProductVariant" pv
    LEFT JOIN "InventoryLevel" il ON il."variantId" = pv.id
    WHERE il.id IS NULL
  `;
  if (orphans.length > 0) {
    console.log(`  📦 Creando inventory para ${orphans.length} variantes huérfanas...`);
    const invData = orphans.map(v => ({
      variantId: v.id,
      quantity: Math.random() < 0.9 ? Math.floor(Math.random() * 200) + 5 : 0,
      reservedQuantity: 0,
    }));
    for (let i = 0; i < invData.length; i += 5000) {
      await prisma.inventoryLevel.createMany({ data: invData.slice(i, i + 5000), skipDuplicates: true });
      if (i % 50000 === 0 && i > 0) console.log(`    ${i.toLocaleString()} / ${invData.length.toLocaleString()}`);
    }
    console.log('  ✅ Done');
  }

  // 4. Resumen
  const imgTotal = await prisma.productImage.count();
  const withStock = await prisma.$queryRaw`SELECT COUNT(*)::int as n FROM "InventoryLevel" WHERE quantity > 0`;
  const noStock   = await prisma.$queryRaw`SELECT COUNT(*)::int as n FROM "InventoryLevel" WHERE quantity = 0`;
  const pct = Math.round(withStock[0].n / (withStock[0].n + noStock[0].n) * 100);

  console.log('\n📊 RESUMEN:');
  console.log(`  📸 Imágenes: ${imgTotal.toLocaleString()}`);
  console.log(`  ✅ Con stock: ${withStock[0].n.toLocaleString()} (${pct}%)`);
  console.log(`  ❌ Sin stock: ${noStock[0].n.toLocaleString()} (${100-pct}%)`);
  console.log('\n🎉 ¡Listo!');
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
