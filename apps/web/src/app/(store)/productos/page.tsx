"use client";
import { useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useCategories } from '@/lib/hooks';
import { X, SlidersHorizontal } from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import { ProductGrid } from '@/components/shop/ProductGrid';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { api } from '@/lib/api';
import { Product } from '@/components/shop/ProductCard';
import { formatPrice, cn } from '@/lib/utils';

function normalizeProduct(raw: any) {
  const variant = raw.variants?.[0];
  const image = raw.images?.[0]?.url || raw.images?.[0]?.src || raw.thumbnail || null;
  const price = variant?.price ?? raw.price ?? 0;
  const compareAt = variant?.compareAtPrice ?? raw.compareAtPrice;
  const stock = raw.variants?.some((v: any) => (v.inventoryQuantity ?? v.stock ?? 1) > 0) ?? true;
  return {
    id: raw.id,
    name: raw.title || raw.name || 'Producto',
    slug: raw.slug,
    description: raw.description || '',
    price: typeof price === 'number' ? price / 100 : Number(price) / 100,
    compareAtPrice: compareAt ? Number(compareAt) / 100 : undefined,
    images: image ? [image] : [],
    inStock: stock,
    isNew: false,
    isSale: !!compareAt,
    variantId: variant?.id,
  };
}


interface ProductsResponse {
  data: Product[];
  total: number;
  page: number;
  totalPages: number;
}

const sortOptions = [
  { value: 'newest', label: 'Mas recientes' },
  { value: 'oldest', label: 'Mas antiguos' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
];

// categories cargadas de la API

export default function ProductosPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const { data: categoriesData } = useCategories();
  const categories = (categoriesData?.data || []).map((c: any) => ({ id: c.slug, name: c.name }));

  const [page, setPage] = useState(1);
  const [pageSize] = useState(24);
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    searchParams.get('categoria') ? [searchParams.get('categoria')!] : []
  );
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const buildParams = useCallback(() => {
    const params: Record<string, string | number | boolean> = {
      page,
      limit: pageSize,
      sort,
    };
    if (selectedCategories.length > 0) params.categoria = selectedCategories.join(',');
    // status solo ACTIVE para el listing público
    params.status = 'ACTIVE';
    if (priceRange[0] > 0) params.minPrice = priceRange[0];
    if (priceRange[1] < 5000) params.maxPrice = priceRange[1];
    if (inStockOnly) params.inStock = true;
    const q = searchParams.get('q');
    if (q) params.q = q;
    return params;
  }, [page, pageSize, sort, selectedCategories, priceRange, inStockOnly, searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['products', buildParams()],
    queryFn: () => api.get<ProductsResponse>('/products', buildParams()),
  });

  const products = (data?.data || []).map(normalizeProduct);
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
    setPage(1);
  };

  const activeFiltersCount =
    selectedCategories.length +
    (priceRange[0] > 0 || priceRange[1] < 5000 ? 1 : 0) +
    (inStockOnly ? 1 : 0);

  const clearFilters = () => {
    setSelectedCategories([]);
    setPriceRange([0, 5000]);
    setInStockOnly(false);
    setPage(1);
  };

  const FilterPanel = () => (
    <aside className="space-y-6">
      {/* Categories */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">Categorias</h3>
        <div className="space-y-2">
          {categories.map((cat) => (
            <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedCategories.includes(cat.id)}
                onChange={() => toggleCategory(cat.id)}
                className="rounded border-neutral-300"
              />
              <span className="text-sm text-neutral-700">{cat.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Price range */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">
          Precio: {formatPrice(priceRange[0])} - {formatPrice(priceRange[1])}
        </h3>
        <Slider.Root
          min={0}
          max={5000}
          step={100}
          value={priceRange}
          onValueChange={(v) => setPriceRange([v[0], v[1]])}
          className="relative flex items-center h-5 w-full"
        >
          <Slider.Track className="relative h-1.5 flex-grow rounded-full bg-neutral-200">
            <Slider.Range className="absolute h-full rounded-full bg-brand-500" />
          </Slider.Track>
          <Slider.Thumb className="block h-5 w-5 rounded-full border-2 border-brand-600 bg-white shadow focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <Slider.Thumb className="block h-5 w-5 rounded-full border-2 border-brand-600 bg-white shadow focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </Slider.Root>
      </div>

      {/* In stock */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => {
              setInStockOnly(e.target.checked);
              setPage(1);
            }}
            className="rounded border-neutral-300"
          />
          <span className="text-sm text-neutral-700">Solo con stock</span>
        </label>
      </div>

      {activeFiltersCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full">
          Limpiar filtros
        </Button>
      )}
    </aside>
  );

  return (
    <div className="container-page py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Productos</h1>
          {!isLoading && (
            <p className="text-sm text-neutral-500 mt-1">{total} resultados</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<SlidersHorizontal className="h-4 w-4" />}
            onClick={() => setShowFilters(!showFilters)}
            className="lg:hidden"
          >
            Filtros {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </Button>
          <Select
            options={sortOptions}
            value={sort}
            onChange={(v) => { setSort(v); setPage(1); }}
            triggerClassName="w-52"
          />
        </div>
      </div>

      {/* Active filter chips */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className="flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-200 transition-colors"
            >
              {categories.find((c) => c.id === cat)?.name || cat}
              <X className="h-3 w-3" />
            </button>
          ))}
          {(priceRange[0] > 0 || priceRange[1] < 5000) && (
            <button
              onClick={() => setPriceRange([0, 5000])}
              className="flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-200 transition-colors"
            >
              Precio: {formatPrice(priceRange[0])} - {formatPrice(priceRange[1])}
              <X className="h-3 w-3" />
            </button>
          )}
          {inStockOnly && (
            <button
              onClick={() => setInStockOnly(false)}
              className="flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-200 transition-colors"
            >
              En stock <X className="h-3 w-3" />
            </button>
          )}
          <button onClick={clearFilters} className="text-xs text-neutral-500 hover:text-neutral-700 underline">
            Limpiar todo
          </button>
        </div>
      )}

      <div className="flex gap-8">
        {/* Sidebar filters - desktop */}
        <aside className="hidden lg:block w-56 shrink-0">
          <FilterPanel />
        </aside>

        {/* Mobile filter drawer */}
        {showFilters && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowFilters(false)} />
            <div className="absolute right-0 top-0 h-full w-80 bg-white p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold text-neutral-900">Filtros</h2>
                <button onClick={() => setShowFilters(false)}>
                  <X className="h-5 w-5 text-neutral-400" />
                </button>
              </div>
              <FilterPanel />
            </div>
          </div>
        )}

        {/* Products */}
        <div className="flex-1 min-w-0 space-y-6">
          <ProductGrid
            products={products}
            isLoading={isLoading}
            columns={3}
            emptyTitle="No se encontraron productos"
            emptyDescription="Prueba ajustando o eliminando los filtros seleccionados."
          />

          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>
    </div>
  );
}
