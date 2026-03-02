"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal, X, ChevronDown, ChevronUp } from 'lucide-react';

import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';

import { ProductGrid } from '@/components/shop/ProductGrid';
import { Product } from '@/components/shop/ProductCard';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

interface SearchFilters {
  q: string;
  category: string;
  minPrice: string;
  maxPrice: string;
  inStock: boolean;
  page: number;
}

interface SearchResult {
  data: Product[];
  total: number;
  page: number;
  totalPages: number;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ data: Category[] }>('/categories'),
    staleTime: 5 * 60 * 1000,
  });
}

function useSearch(filters: SearchFilters) {
  const params: Record<string, string | number | boolean> = {
    page: filters.page,
    limit: 12,
  };
  params.status = 'ACTIVE';
  if (filters.q) params.q = filters.q;
  if (filters.category) params.categoria = filters.category;
  if (filters.minPrice) params.minPrice = Number(filters.minPrice) * 100; // pesos → centavos
  if (filters.maxPrice) params.maxPrice = Number(filters.maxPrice) * 100;
  if (filters.inStock) params.inStock = true;

  return useQuery({
    queryKey: ['search', filters],
    queryFn: () => api.get<SearchResult>('/products', params),
    placeholderData: (prev) => prev,
    select: (res: any) => ({
      data: (res.data || []).map((p: any) => {
        const v = p.variants?.[0];
        const price = v?.price ? v.price / 100 : 0;
        const img = p.images?.[0]?.url || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600';
        return {
          id: p.id,
          name: p.title || p.name || 'Producto',
          slug: p.slug,
          description: p.description || '',
          price,
          compareAtPrice: v?.compareAtPrice ? v.compareAtPrice / 100 : undefined,
          images: [img],
          inStock: p.variants?.some((vv: any) => (vv.inventoryLevel?.quantity ?? 1) > 0) ?? true,
          variantId: v?.id,
        };
      }),
      total: res.meta?.total || 0,
      totalPages: res.meta?.totalPages || 1,
      page: res.meta?.page || 1,
    }),
  });
}

// ─── Filter sidebar ───────────────────────────────────────────────────────────

interface FilterSidebarProps {
  filters: SearchFilters;
  onFilterChange: (key: keyof SearchFilters, value: string | boolean | number) => void;
  onReset: () => void;
  categories: Category[];
  isLoadingCategories: boolean;
}

function FilterSidebar({
  filters,
  onFilterChange,
  onReset,
  categories,
  isLoadingCategories,
}: FilterSidebarProps) {
  const [showCategories, setShowCategories] = useState(true);
  const [showPrice, setShowPrice] = useState(true);

  const hasActiveFilters =
    filters.category || filters.minPrice || filters.maxPrice || filters.inStock;

  return (
    <aside className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-neutral-900">Filtros</h3>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Limpiar
          </button>
        )}
      </div>

      {/* Categories */}
      <div>
        <button
          onClick={() => setShowCategories(!showCategories)}
          className="flex items-center justify-between w-full text-sm font-semibold text-neutral-800 mb-3"
        >
          Categorias
          {showCategories ? (
            <ChevronUp className="h-4 w-4 text-neutral-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-neutral-400" />
          )}
        </button>
        {showCategories && (
          <div className="space-y-2">
            {isLoadingCategories ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full rounded" />
              ))
            ) : (
              <>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="category"
                    value=""
                    checked={!filters.category}
                    onChange={() => onFilterChange('category', '')}
                    className="text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm text-neutral-700">Todas las categorias</span>
                </label>
                {categories.map((cat) => (
                  <label key={cat.id} className="flex items-center justify-between gap-2 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="category"
                        value={cat.slug}
                        checked={filters.category === cat.slug}
                        onChange={() => onFilterChange('category', cat.slug)}
                        className="text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-neutral-700">{cat.name}</span>
                    </div>
                    <span className="text-xs text-neutral-400">{cat.productCount}</span>
                  </label>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-neutral-200" />

      {/* Price range */}
      <div>
        <button
          onClick={() => setShowPrice(!showPrice)}
          className="flex items-center justify-between w-full text-sm font-semibold text-neutral-800 mb-3"
        >
          Precio
          {showPrice ? (
            <ChevronUp className="h-4 w-4 text-neutral-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-neutral-400" />
          )}
        </button>
        {showPrice && (
          <div className="space-y-3">
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <label className="text-xs text-neutral-500 mb-1 block">Min</label>
                <input
                  type="number"
                  value={filters.minPrice}
                  onChange={(e) => onFilterChange('minPrice', e.target.value)}
                  placeholder="0"
                  min={0}
                  className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              <span className="text-neutral-400 mt-5">—</span>
              <div className="flex-1">
                <label className="text-xs text-neutral-500 mb-1 block">Max</label>
                <input
                  type="number"
                  value={filters.maxPrice}
                  onChange={(e) => onFilterChange('maxPrice', e.target.value)}
                  placeholder="5000"
                  min={0}
                  className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </div>
            {/* Quick price ranges */}
            <div className="flex flex-wrap gap-1">
              {[
                { label: 'Menos de $500', min: '', max: '500' },
                { label: '$500 – $1500', min: '500', max: '1500' },
                { label: 'Mas de $1500', min: '1500', max: '' },
              ].map((range) => (
                <button
                  key={range.label}
                  onClick={() => {
                    onFilterChange('minPrice', range.min);
                    onFilterChange('maxPrice', range.max);
                  }}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    filters.minPrice === range.min && filters.maxPrice === range.max
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-neutral-200 text-neutral-600 hover:border-brand-300'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-neutral-200" />

      {/* Availability */}
      <div>
        <p className="text-sm font-semibold text-neutral-800 mb-3">Disponibilidad</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.inStock}
            onChange={(e) => onFilterChange('inStock', e.target.checked)}
            className="rounded text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-neutral-700">Solo en stock</span>
        </label>
      </div>
    </aside>
  );
}

// ─── Active filters pills ─────────────────────────────────────────────────────

function ActiveFilters({
  filters,
  onRemove,
  categories,
}: {
  filters: SearchFilters;
  onRemove: (key: keyof SearchFilters) => void;
  categories: Category[];
}) {
  const pills: { key: keyof SearchFilters; label: string }[] = [];

  if (filters.category) {
    const cat = categories.find((c) => c.slug === filters.category);
    pills.push({ key: 'category', label: cat?.name || filters.category });
  }
  if (filters.minPrice || filters.maxPrice) {
    const label =
      filters.minPrice && filters.maxPrice
        ? `${formatPrice(Number(filters.minPrice))} – ${formatPrice(Number(filters.maxPrice))}`
        : filters.minPrice
        ? `Desde ${formatPrice(Number(filters.minPrice))}`
        : `Hasta ${formatPrice(Number(filters.maxPrice))}`;
    pills.push({ key: 'minPrice', label });
  }
  if (filters.inStock) {
    pills.push({ key: 'inStock', label: 'En stock' });
  }

  if (!pills.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {pills.map((pill) => (
        <span
          key={pill.key}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 text-brand-800 text-xs font-medium px-3 py-1"
        >
          {pill.label}
          <button onClick={() => onRemove(pill.key)} className="hover:text-brand-900">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

// ─── Search skeleton ──────────────────────────────────────────────────────────

function SearchSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-neutral-200 overflow-hidden">
          <Skeleton className="aspect-square w-full" />
          <div className="p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [filters, setFilters] = useState<SearchFilters>({
    q: searchParams.get('q') || '',
    category: searchParams.get('category') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    inStock: searchParams.get('inStock') === 'true',
    page: Number(searchParams.get('page')) || 1,
  });

  // Sync URL -> state
  useEffect(() => {
    setFilters({
      q: searchParams.get('q') || '',
      category: searchParams.get('category') || '',
      minPrice: searchParams.get('minPrice') || '',
      maxPrice: searchParams.get('maxPrice') || '',
      inStock: searchParams.get('inStock') === 'true',
      page: Number(searchParams.get('page')) || 1,
    });
  }, [searchParams]);

  // State -> URL
  const updateUrl = useCallback(
    (newFilters: SearchFilters) => {
      const params = new URLSearchParams();
      if (newFilters.q) params.set('q', newFilters.q);
      if (newFilters.category) params.set('category', newFilters.category);
      if (newFilters.minPrice) params.set('minPrice', newFilters.minPrice);
      if (newFilters.maxPrice) params.set('maxPrice', newFilters.maxPrice);
      if (newFilters.inStock) params.set('inStock', 'true');
      if (newFilters.page > 1) params.set('page', String(newFilters.page));
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname]
  );

  const handleFilterChange = (key: keyof SearchFilters, value: string | boolean | number) => {
    const newFilters = { ...filters, [key]: value, page: key === 'page' ? (value as number) : 1 };
    setFilters(newFilters);
    updateUrl(newFilters);
  };

  const handleRemoveFilter = (key: keyof SearchFilters) => {
    const newFilters = {
      ...filters,
      [key]: key === 'inStock' ? false : key === 'page' ? 1 : '',
      page: 1,
    };
    // For price, remove both min and max
    if (key === 'minPrice') {
      newFilters.maxPrice = '';
    }
    setFilters(newFilters);
    updateUrl(newFilters);
  };

  const handleReset = () => {
    const newFilters: SearchFilters = {
      q: filters.q,
      category: '',
      minPrice: '',
      maxPrice: '',
      inStock: false,
      page: 1,
    };
    setFilters(newFilters);
    updateUrl(newFilters);
  };

  const { data, isLoading, isFetching } = useSearch(filters);
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories();
  const categories = categoriesData?.data || [];

  const products = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <div className="container-page py-8">
      {/* Search bar */}
      <div className="mb-6">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
          <input
            type="search"
            value={filters.q}
            onChange={(e) => handleFilterChange('q', e.target.value)}
            placeholder="Buscar productos..."
            className="w-full rounded-xl border border-neutral-300 pl-10 pr-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors"
          />
        </div>
      </div>

      {/* Results header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          {filters.q ? (
            <h1 className="text-xl font-bold text-neutral-900">
              Resultados para <span className="text-brand-700">&ldquo;{filters.q}&rdquo;</span>
            </h1>
          ) : (
            <h1 className="text-xl font-bold text-neutral-900">Todos los productos</h1>
          )}
          {!isLoading && (
            <p className="text-sm text-neutral-500 mt-0.5">
              {total} producto{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Mobile filter toggle */}
        <Button
          variant="outline"
          size="sm"
          leftIcon={<SlidersHorizontal className="h-4 w-4" />}
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className="lg:hidden"
        >
          Filtros
          {(filters.category || filters.minPrice || filters.maxPrice || filters.inStock) && (
            <Badge variant="primary" size="sm" className="ml-1 h-4 w-4 p-0 text-xs flex items-center justify-center rounded-full">
              !
            </Badge>
          )}
        </Button>
      </div>

      <div className="flex gap-8">
        {/* Sidebar — desktop always visible, mobile conditional */}
        <div
          className={`shrink-0 w-56 ${
            showMobileFilters ? 'block' : 'hidden'
          } lg:block`}
        >
          <div className="sticky top-4">
            <FilterSidebar
              filters={filters}
              onFilterChange={handleFilterChange}
              onReset={handleReset}
              categories={categories}
              isLoadingCategories={categoriesLoading}
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 min-w-0">
          <ActiveFilters
            filters={filters}
            onRemove={handleRemoveFilter}
            categories={categories}
          />

          {isLoading ? (
            <SearchSkeleton />
          ) : products.length === 0 ? (
            <EmptyState
              icon={Search}
              title={filters.q ? `Sin resultados para "${filters.q}"` : 'Sin productos encontrados'}
              description="Intenta con otros terminos de busqueda o ajusta los filtros."
              action={{
                label: 'Limpiar filtros',
                onClick: handleReset,
              }}
            />
          ) : (
            <div className={isFetching && !isLoading ? 'opacity-60 pointer-events-none' : ''}>
              <ProductGrid products={products} columns={3} />
            </div>
          )}

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className="mt-8">
              <Pagination
                page={filters.page}
                totalPages={totalPages}
                onPageChange={(p) => handleFilterChange('page', p)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
