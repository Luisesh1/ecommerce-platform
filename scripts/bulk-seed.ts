import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ log: ['error'] });

const TOTAL = 10_000_000;
const BATCH = 5000;

const brands = ['Apple','Samsung','Sony','LG','Huawei','Xiaomi','ASUS','Dell','HP','Lenovo','JBL','Bose','Logitech','Razer','MSI','Acer','Microsoft','Google','OnePlus','Motorola'];
const types  = ['Smartphone','Laptop','Tablet','Audífono','Bocina','Smartwatch','Monitor','Teclado','Mouse','Cámara','SSD','GPU','Router','Proyector','CPU'];
const adjs   = ['Pro','Ultra','Max','Plus','Lite','SE','Air','Elite','Prime','Edge','Neo','X','Z','S','A'];
const imgs   = [
  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400',
  'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400',
  'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400',
  'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400',
  'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400',
  'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400',
];

const r  = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const ri = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const uid = () => Math.random().toString(36).slice(2, 9);

async function main() {
  console.log(`\n🌱 Insertando ${TOTAL.toLocaleString()} productos en batches de ${BATCH}...\n`);

  const cats = await prisma.category.findMany({ select: { id: true } });
  if (!cats.length) { console.error('❌ Sin categorías. Corre seed primero.'); process.exit(1); }
  const catIds = cats.map(c => c.id);
  const totalBatches = Math.ceil(TOTAL / BATCH);
  let inserted = 0;
  const start = Date.now();

  for (let b = 0; b < totalBatches; b++) {
    const bStart = b * BATCH;
    const count = Math.min(BATCH, TOTAL - bStart);
    const pRows: string[] = [];
    const vRows: string[] = [];

    for (let i = 0; i < count; i++) {
      const gid = bStart + i + 1;
      const brand = r(brands), type = r(types), adj = r(adjs), num = ri(1, 9999);
      const title = `${brand} ${type} ${adj} ${num}`.replace(/'/g, "''");
      const slug  = `${brand.toLowerCase()}-${type.toLowerCase().replace(/[^a-z]/g,'-')}-${adj.toLowerCase()}-${gid}`;
      const price = ri(29900, 9999900); // centavos MXN
      const catId = r(catIds);
      const img   = r(imgs);
      const pid   = `p${gid}x${uid()}`;

      pRows.push(`('${pid}','${title}','${slug}',NULL,'ACTIVE','${catId}',NULL,NULL,'[]'::jsonb,true,true,NULL,NULL,'KG',NULL,NULL,NULL,false,NULL,0,0,false,NOW(),NOW())`);

      const nv = ri(1, 3);
      for (let v = 0; v < nv; v++) {
        const vid   = `v${gid}x${v}${uid()}`;
        const sku   = `SKU-${gid}-${v}`;
        const vtitle = ['Estándar','Plus','Pro'][v];
        const vp    = Math.max(19900, price + ri(-20000, 50000));
        const stock = ri(0, 100);
        vRows.push(`('${vid}','${pid}','${sku}','${vtitle}',${vp},NULL,NULL,NULL,'KG',true,${stock},NULL,NULL,NULL,false,false,'[]'::jsonb,NULL,NOW(),NOW())`);
      }
    }

    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO products(id,title,slug,description,status,category_id,vendor,product_type,seo_keywords,taxable,requires_shipping,tax_code,weight,weight_unit,length,width,height,is_featured,tags,published_at_count,sort_order,deleted,created_at,updated_at)
        SELECT id,title,slug,description,status::\"ProductStatus\",category_id,vendor,product_type,seo_keywords,taxable,requires_shipping,tax_code,weight,weight_unit::\"WeightUnit\",length,width,height,is_featured,tags,published_at_count,sort_order,deleted,created_at,updated_at
        FROM (VALUES ${pRows.join(',')}) AS t(id,title,slug,description,status,category_id,vendor,product_type,seo_keywords,taxable,requires_shipping,tax_code,weight,weight_unit,length,width,height,is_featured,tags,published_at_count,sort_order,deleted,created_at,updated_at)
        ON CONFLICT(slug) DO NOTHING
      `);
    } catch(e: any) {
      // En primer fallo mostramos el error para depurar
      if (b === 0) { console.error('Error en batch 0:', e.message); process.exit(1); }
    }

    inserted += count;
    if (b % 100 === 0 || b === totalBatches - 1) {
      const sec = (Date.now() - start) / 1000;
      const rate = Math.round(inserted / sec);
      const eta  = Math.round((TOTAL - inserted) / Math.max(rate, 1));
      const pct  = ((inserted / TOTAL) * 100).toFixed(1);
      console.log(`  📦 ${inserted.toLocaleString().padStart(12)} / ${TOTAL.toLocaleString()} | ${pct.padStart(5)}% | ${rate.toLocaleString()} prod/s | ETA ${eta}s`);
    }
  }

  const total = await prisma.product.count();
  console.log(`\n✅ Completado! Total productos en DB: ${total.toLocaleString()}`);
  await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
