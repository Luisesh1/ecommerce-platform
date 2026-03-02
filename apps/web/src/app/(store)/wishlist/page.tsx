"use client";

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, Bell, BellOff, Trash2, ShoppingCart } from 'lucide-react';

import { api } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { formatPrice } from '@/lib/utils';
import { useToast } from '@/components/ui/useToast';

import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { StockBadge } from '@/components/shop/StockBadge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WishlistItem {
  id: string;
  variantId: string;
  productId: string;
  name: string;
  slug: string;
  image: string;
  price: number;
  compareAtPrice?: number;
  inStock: boolean;
  stock: number;
  options: Record<string, string>;
  backInStockNotify: boolean;
  addedAt: string;
}

// ─── Wishlist card ────────────────────────────────────────────────────────────

function WishlistCard({ item }: { item: WishlistItem }) {
  const queryClient = useQueryClient();
  const { addItem } = useCart();
  const { success, error } = useToast();
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const removeMutation = useMutation({
    mutationFn: () => api.delete(`/wishlist/${item.variantId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      success('Eliminado', `${item.name} se elimino de tu lista de deseos`);
    },
    onError: () => error('Error', 'No se pudo eliminar el elemento'),
  });

  const notifyMutation = useMutation({
    mutationFn: () =>
      api.post(`/wishlist/back-in-stock`, {
        variantId: item.variantId,
        subscribe: !item.backInStockNotify,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      if (!item.backInStockNotify) {
        success('Suscripcion activa', 'Te avisaremos cuando vuelva a estar disponible');
      }
    },
    onError: () => error('Error', 'No se pudo actualizar la suscripcion'),
  });

  const handleAddToCart = async () => {
    setIsAddingToCart(true);
    try {
      await addItem({
        productId: item.productId,
        variantId: item.variantId,
        quantity: 1,
      });
      success('Agregado', `${item.name} se agrego al carrito`);
    } catch {
      error('Error', 'No se pudo agregar al carrito');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const discount = item.compareAtPrice
    ? Math.round((1 - item.price / item.compareAtPrice) * 100)
    : undefined;

  return (
    <div className="group relative rounded-xl border border-neutral-200 bg-white overflow-hidden hover:shadow-md transition-shadow">
      {/* Remove button */}
      <button
        onClick={() => removeMutation.mutate()}
        disabled={removeMutation.isPending}
        className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm text-neutral-400 hover:text-error-500 transition-colors opacity-0 group-hover:opacity-100"
        title="Eliminar de favoritos"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {/* Image */}
      <Link href={`/productos/${item.slug}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-neutral-50">
          {item.image ? (
            <Image
              src={item.image}
              alt={item.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Heart className="h-10 w-10 text-neutral-200" />
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {!item.inStock && <Badge variant="neutral" size="sm">Agotado</Badge>}
            {discount && discount > 0 && <Badge variant="error" size="sm">-{discount}%</Badge>}
          </div>
        </div>
      </Link>

      {/* Info */}
      <div className="p-4 space-y-3">
        {/* Name + variants */}
        <div>
          <Link
            href={`/productos/${item.slug}`}
            className="text-sm font-semibold text-neutral-900 hover:text-brand-600 no-underline transition-colors line-clamp-2 leading-snug"
          >
            {item.name}
          </Link>
          {Object.entries(item.options || {}).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {Object.entries(item.options).map(([k, v]) => (
                <span key={k} className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded">
                  {k}: {v}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Price */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-neutral-900">{formatPrice(item.price)}</span>
          {item.compareAtPrice && (
            <span className="text-sm text-neutral-400 line-through">{formatPrice(item.compareAtPrice)}</span>
          )}
        </div>

        {/* Stock */}
        <StockBadge stock={item.stock} />

        {/* Actions */}
        <div className="space-y-2 pt-1">
          {item.inStock ? (
            <Button
              className="w-full"
              size="sm"
              leftIcon={<ShoppingCart className="h-4 w-4" />}
              onClick={handleAddToCart}
              loading={isAddingToCart}
            >
              Agregar al carrito
            </Button>
          ) : (
            <Button
              className="w-full"
              size="sm"
              variant={item.backInStockNotify ? 'secondary' : 'outline'}
              leftIcon={
                item.backInStockNotify ? (
                  <BellOff className="h-4 w-4" />
                ) : (
                  <Bell className="h-4 w-4" />
                )
              }
              onClick={() => notifyMutation.mutate()}
              loading={notifyMutation.isPending}
            >
              {item.backInStockNotify ? 'Cancelar aviso' : 'Avisar cuando llegue'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function WishlistSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-neutral-200 overflow-hidden">
          <Skeleton className="aspect-square w-full" />
          <div className="p-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-8 w-full rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WishlistPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => api.get<{ data: WishlistItem[] }>('/wishlist'),
  });

  const clearMutation = useMutation({
    mutationFn: () => api.delete('/wishlist'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
  });

  const items = data?.data || [];

  return (
    <div className="container-page py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Lista de deseos</h1>
          {!isLoading && items.length > 0 && (
            <p className="text-neutral-500 mt-1">
              {items.length} producto{items.length !== 1 ? 's' : ''} guardado{items.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearMutation.mutate()}
            loading={clearMutation.isPending}
            leftIcon={<Trash2 className="h-4 w-4" />}
          >
            Limpiar lista
          </Button>
        )}
      </div>

      {/* Error state */}
      {isError && (
        <div className="rounded-lg border border-error-200 bg-error-50 p-4 text-sm text-error-700 mb-6">
          No se pudo cargar tu lista de deseos. Intenta recargar la pagina.
        </div>
      )}

      {/* Loading */}
      {isLoading && <WishlistSkeleton />}

      {/* Empty state */}
      {!isLoading && !isError && items.length === 0 && (
        <EmptyState
          icon={Heart}
          title="Tu lista de deseos esta vacia"
          description="Guarda los productos que te gusten para comprarlos despues o que te avisemos cuando vuelvan a estar disponibles."
          action={{
            label: 'Explorar productos',
            onClick: () => (window.location.href = '/productos'),
          }}
        />
      )}

      {/* Grid */}
      {!isLoading && items.length > 0 && (
        <>
          {/* Notify summary bar */}
          {items.some((i) => !i.inStock) && (
            <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 mb-6 flex items-center gap-3">
              <Bell className="h-4 w-4 text-brand-600 shrink-0" />
              <p className="text-sm text-brand-800">
                Algunos productos estan agotados. Activa el aviso para que te notifiquemos cuando vuelvan a estar disponibles.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((item) => (
              <WishlistCard key={item.id} item={item} />
            ))}
          </div>

          {/* CTA */}
          <div className="mt-10 text-center">
            <p className="text-sm text-neutral-500 mb-3">Sigue descubriendo productos</p>
            <Link
              href="/productos"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition-colors no-underline"
            >
              Explorar productos
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
