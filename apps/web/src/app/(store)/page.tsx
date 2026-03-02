'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { HeroBanner } from '@/components/shop/HeroBanner';
import { ProductGrid } from '@/components/shop/ProductGrid';
import { CategoryGrid } from '@/components/shop/CategoryGrid';
import { api } from '@/lib/api';
import { Product } from '@/components/shop/ProductCard';
import { Category } from '@/components/shop/CategoryGrid';
import { ArrowRight } from 'lucide-react';

// Normaliza la respuesta de la API al formato que espera ProductCard
function normalizeProduct(raw: any): Product {
  const variant = raw.variants?.[0];
  const image = raw.images?.[0]?.url || raw.images?.[0]?.src || raw.thumbnail || null;
  const price = variant?.price ?? raw.price ?? 0;
  const compareAt = variant?.compareAtPrice ?? raw.compareAtPrice;
  const stock = raw.variants?.some((v: any) => (v.inventoryQuantity ?? v.stock ?? 1) > 0) ?? true;

  return {
    id: raw.id,
    name: raw.title || raw.name || 'Producto',
    slug: raw.slug,
    description: raw.description || raw.shortDescription || '',
    price: typeof price === 'number' ? price / 100 : Number(price) / 100,
    compareAtPrice: compareAt ? (typeof compareAt === 'number' ? compareAt / 100 : Number(compareAt) / 100) : undefined,
    images: image ? [image] : [],
    inStock: stock,
    isNew: false,
    isSale: !!compareAt,
    rating: raw.rating,
    reviewCount: raw.reviewCount,
    variantId: variant?.id,
  };
}



function useFeaturedProducts() {
  return useQuery({
    queryKey: ['products', 'featured'],
    queryFn: () => api.get<{ data: any[] }>('/products?limit=8'),
  });
}

function useCategories() {
  return useQuery({
    queryKey: ['categories', 'featured'],
    queryFn: () => api.get<{ data: Category[] }>('/categories?limit=6'),
  });
}

export default function HomePage() {
  const { data: productsData, isLoading: productsLoading } = useFeaturedProducts();
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories();

  const products = (productsData?.data || []).map(normalizeProduct);
  const categories = categoriesData?.data || [];

  return (
    <div className="space-y-16 pb-16">
      {/* Hero */}
      <section className="container-page pt-6">
        <HeroBanner />
      </section>

      {/* Categories */}
      <section className="container-page">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-neutral-900">Comprar por categoria</h2>
          <Link href="/productos" className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 no-underline">
            Ver todo <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <CategoryGrid categories={categories} isLoading={categoriesLoading} />
      </section>

      {/* Featured Products */}
      <section className="container-page">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-neutral-900">Productos destacados</h2>
          <Link href="/productos" className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 no-underline">
            Ver mas <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <ProductGrid
          products={products}
          isLoading={productsLoading}
          emptyTitle="Sin productos destacados"
        />
      </section>

      {/* Promo banner */}
      <section className="container-page">
        <div className="rounded-2xl bg-gradient-to-r from-brand-600 to-brand-800 p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Envio gratis en pedidos mayores a $999
            </h3>
            <p className="text-brand-200">
              Aprovecha esta oferta en toda la tienda. Sin restricciones.
            </p>
          </div>
          <Link
            href="/productos"
            className="shrink-0 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 transition-colors no-underline"
          >
            Comprar ahora
          </Link>
        </div>
      </section>

      {/* New arrivals */}
      <section className="container-page">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-neutral-900">Nuevos ingresos</h2>
          <Link href="/productos?sort=newest" className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 no-underline">
            Ver todo <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <ProductGrid
          products={products.slice(0, 4)}
          isLoading={productsLoading}
          columns={4}
        />
      </section>
    </div>
  );
}
