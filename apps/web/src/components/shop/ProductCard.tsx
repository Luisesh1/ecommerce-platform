"use client";
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Heart, ShoppingCart, Star } from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import { useCart } from '@/lib/cart';
import { useToast } from '@/components/ui/useToast';
import { Badge } from '@/components/ui/Badge';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  rating?: number;
  reviewCount?: number;
  inStock: boolean;
  isNew?: boolean;
  isSale?: boolean;
  discountPercent?: number;
  variantId?: string;
}

export interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const { addItem, isLoading } = useCart();
  const { success, error } = useToast();
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.variantId && !product.inStock) return;

    setIsAddingToCart(true);
    try {
      await addItem({
        productId: product.id,
        variantId: product.variantId || product.id,
        quantity: 1,
      });
      success('Producto agregado', `${product.name} se agrego al carrito`);
    } catch {
      error('Error', 'No se pudo agregar al carrito');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWishlisted(!isWishlisted);
  };

  const discount = product.compareAtPrice
    ? Math.round((1 - product.price / product.compareAtPrice) * 100)
    : product.discountPercent;

  return (
    <Link
      href={`/productos/${product.slug}`}
      className={cn(
        'group relative flex flex-col rounded-xl border border-neutral-200 bg-white overflow-hidden no-underline transition-shadow hover:shadow-md',
        className
      )}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-neutral-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.images?.[0] || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600'}
          alt={product.name || 'Producto'}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600'; }}
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.isNew && <Badge variant="info" size="sm">Nuevo</Badge>}
          {discount && discount > 0 && (
            <Badge variant="error" size="sm">-{discount}%</Badge>
          )}
          {!product.inStock && <Badge variant="neutral" size="sm">Agotado</Badge>}
        </div>

        {/* Wishlist */}
        <button
          onClick={handleWishlist}
          className={cn(
            'absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm transition-all',
            'opacity-0 group-hover:opacity-100',
            isWishlisted ? 'text-error-500' : 'text-neutral-400 hover:text-error-400'
          )}
        >
          <Heart className={cn('h-4 w-4', isWishlisted && 'fill-current')} />
        </button>

        {/* Add to cart overlay */}
        {product.inStock && (
          <button
            onClick={handleAddToCart}
            disabled={isAddingToCart}
            className={cn(
              'absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 bg-brand-600 py-2.5 text-sm font-medium text-white',
              'translate-y-full transition-transform duration-200 group-hover:translate-y-0',
              'hover:bg-brand-700 disabled:opacity-70'
            )}
          >
            <ShoppingCart className="h-4 w-4" />
            {isAddingToCart ? 'Agregando...' : 'Agregar al carrito'}
          </button>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 p-4">
        <p className="text-xs text-neutral-400 uppercase tracking-wide">Categoria</p>
        <h3 className="text-sm font-semibold text-neutral-900 line-clamp-2 leading-snug">
          {product.name}
        </h3>

        {/* Rating */}
        {product.rating !== undefined && (
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  'h-3.5 w-3.5',
                  i < Math.round(product.rating!)
                    ? 'fill-warning-500 text-warning-500'
                    : 'text-neutral-200 fill-neutral-200'
                )}
              />
            ))}
            {product.reviewCount !== undefined && (
              <span className="text-xs text-neutral-400">({product.reviewCount})</span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-base font-bold text-neutral-900">
            {formatPrice(product.price)}
          </span>
          {product.compareAtPrice && (
            <span className="text-sm text-neutral-400 line-through">
              {formatPrice(product.compareAtPrice)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
