"use client";

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MapPin, Star, ShoppingCart, ArrowLeft, Loader2, Send } from 'lucide-react';

import { api } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { useAuth } from '@/lib/authContext';
import { formatPrice } from '@/lib/utils';

import { ImageGallery } from '@/components/shop/ImageGallery';
import { VariantSelector, VariantOption } from '@/components/shop/VariantSelector';
import { StockBadge } from '@/components/shop/StockBadge';
import { ReviewsList, Review } from '@/components/shop/ReviewsList';
import { ProductGrid } from '@/components/shop/ProductGrid';
import { Product } from '@/components/shop/ProductCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  richDescription?: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  rating?: number;
  reviewCount?: number;
  stock: number;
  inStock: boolean;
  isNew?: boolean;
  isSale?: boolean;
  sku: string;
  brand?: string;
  category?: string | { id: string; name: string; slug: string };
  options: VariantOption[];
  variants: {
    id: string;
    options: Record<string, string>;
    price: number;
    stock: number;
    sku: string;
  }[];
}

interface ReviewsData {
  data: Review[];
  summary: {
    average: number;
    total: number;
    distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  };
}

interface ShippingEstimate {
  estimatedDays: number;
  price: number;
  method: string;
}

const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  title: z.string().min(3, 'El titulo debe tener al menos 3 caracteres'),
  body: z.string().min(10, 'La resena debe tener al menos 10 caracteres'),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

function useProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: () => api.get<ProductDetail>(`/products/${slug}`),
  });
}

function useProductReviews(slug: string) {
  return useQuery({
    queryKey: ['reviews', slug],
    queryFn: () => api.get<ReviewsData>(`/products/${slug}/reviews`),
  });
}

function useRelatedProducts(slug: string) {
  return useQuery({
    queryKey: ['products', 'related', slug],
    queryFn: () => api.get<{ data: Product[] }>(`/products?related=${slug}&limit=4`),
  });
}

function ShippingEstimator({ productId }: { productId: string }) {
  const [cp, setCp] = useState('');
  const [estimate, setEstimate] = useState<ShippingEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEstimate = async () => {
    if (cp.length < 4) {
      setError('Ingresa un codigo postal valido');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await api.get<ShippingEstimate>('/shipping/estimate', {
        cp,
        productId,
      });
      setEstimate(result);
    } catch {
      setError('No se pudo calcular el envio para ese codigo postal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-neutral-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-brand-600" />
        <span className="text-sm font-semibold text-neutral-800">Calcular envio</span>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={cp}
          onChange={(e) => setCp(e.target.value.replace(/\D/g, '').slice(0, 5))}
          placeholder="Codigo postal"
          className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          onKeyDown={(e) => e.key === 'Enter' && handleEstimate()}
        />
        <Button size="sm" variant="outline" onClick={handleEstimate} loading={loading}>
          Calcular
        </Button>
      </div>
      {error && <p className="text-xs text-error-600">{error}</p>}
      {estimate && (
        <div className="rounded-md bg-success-50 px-3 py-2 text-sm">
          <p className="font-medium text-success-800">
            {estimate.price === 0 ? 'Envio gratis' : formatPrice(estimate.price)}
          </p>
          <p className="text-success-700 text-xs mt-0.5">
            {estimate.method} — {estimate.estimatedDays} dias habiles
          </p>
        </div>
      )}
    </div>
  );
}

function ReviewForm({ productSlug, onSuccess }: { productSlug: string; onSuccess: () => void }) {
  const { isAuthenticated } = useAuth();
  const [hovered, setHovered] = useState(0);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 0 },
  });

  const rating = watch('rating');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: ReviewFormData) => api.post(`/reviews`, { ...data, productSlug }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', productSlug] });
      reset();
      onSuccess();
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="rounded-lg border border-neutral-200 p-6 text-center">
        <p className="text-sm text-neutral-600">
          Debes{' '}
          <a href="/login" className="text-brand-600 font-medium hover:underline">
            iniciar sesion
          </a>{' '}
          para dejar una resena.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <h4 className="font-semibold text-neutral-900">Escribe una resena</h4>

      {/* Star rating */}
      <div>
        <label className="text-sm font-medium text-neutral-700 mb-1 block">Calificacion</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setValue('rating', star, { shouldValidate: true })}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={`h-6 w-6 ${
                  star <= (hovered || rating)
                    ? 'fill-warning-500 text-warning-500'
                    : 'text-neutral-200 fill-neutral-200'
                }`}
              />
            </button>
          ))}
        </div>
        {errors.rating && (
          <p className="text-xs text-error-600 mt-1">Selecciona una calificacion</p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-neutral-700 mb-1 block">Titulo</label>
        <input
          {...register('title')}
          placeholder="Resumen de tu opinion"
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
        {errors.title && <p className="text-xs text-error-600 mt-1">{errors.title.message}</p>}
      </div>

      <div>
        <label className="text-sm font-medium text-neutral-700 mb-1 block">Resena</label>
        <textarea
          {...register('body')}
          rows={4}
          placeholder="Describe tu experiencia con el producto..."
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
        />
        {errors.body && <p className="text-xs text-error-600 mt-1">{errors.body.message}</p>}
      </div>

      {mutation.isError && (
        <p className="text-sm text-error-600">Ocurrio un error al enviar la resena. Intenta de nuevo.</p>
      )}

      <Button
        type="submit"
        loading={mutation.isPending}
        leftIcon={<Send className="h-4 w-4" />}
      >
        Publicar resena
      </Button>
    </form>
  );
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const { data: product, isLoading, isError } = useProduct(slug);
  const { data: reviewsData, isLoading: reviewsLoading, refetch: refetchReviews } = useProductReviews(slug);
  const { data: relatedData } = useRelatedProducts(slug);

  const { addItem, isLoading: cartLoading } = useCart();

  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [cartError, setCartError] = useState('');

  const handleVariantChange = (optionName: string, value: string) => {
    setSelectedVariants((prev) => ({ ...prev, [optionName]: value }));
    setAddedToCart(false);
  };

  const selectedVariant = product?.variants?.find((v) =>
    Object.entries(selectedVariants).every(([k, val]) => v.options[k] === val)
  );

  const effectiveStock = selectedVariant ? selectedVariant.stock : product?.stock ?? 0;
  const effectivePrice = selectedVariant ? selectedVariant.price : product?.price ?? 0;

  const handleAddToCart = async () => {
    if (!product) return;
    setCartError('');

    const variantId = selectedVariant?.id || product.id;

    try {
      await addItem({
        productId: product.id,
        variantId,
        quantity,
      });
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 3000);
    } catch {
      setCartError('No se pudo agregar el producto al carrito. Intenta de nuevo.');
    }
  };

  if (isError) {
    return (
      <div className="container-page py-16 text-center">
        <p className="text-neutral-500 mb-4">No se encontro el producto.</p>
        <Button variant="outline" onClick={() => router.back()} leftIcon={<ArrowLeft className="h-4 w-4" />}>
          Volver
        </Button>
      </div>
    );
  }

  if (isLoading || !product) {
    return (
      <div className="container-page py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-full" lines={3} variant="text" />
          </div>
        </div>
      </div>
    );
  }

  const discount = product.compareAtPrice
    ? Math.round((1 - effectivePrice / product.compareAtPrice) * 100)
    : undefined;

  const relatedProducts = relatedData?.data || [];
  const reviews = reviewsData?.data || [];

  return (
    <div className="container-page py-8 space-y-16">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-neutral-400">
        <a href="/" className="hover:text-neutral-700 no-underline">Inicio</a>
        <span>/</span>
        <a href="/productos" className="hover:text-neutral-700 no-underline">Productos</a>
        {product.category && (
          <>
            <span>/</span>
            <span className="text-neutral-500">{typeof product.category === 'object' ? product.category?.name : product.category}</span>
          </>
        )}
        <span>/</span>
        <span className="text-neutral-800 font-medium truncate max-w-xs">{product.title}</span>
      </nav>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-16">
        {/* Gallery */}
        <div>
          <ImageGallery images={product.images} alt={product.title} />
        </div>

        {/* Product info */}
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-2">
            {product.brand && (
              <p className="text-sm font-medium text-brand-600 uppercase tracking-wide">{product.brand}</p>
            )}
            <h1 className="text-3xl font-bold text-neutral-900 leading-tight">{product.title}</h1>

            {/* Rating summary */}
            {product.rating !== undefined && (
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i <= Math.round(product.rating!)
                          ? 'fill-warning-500 text-warning-500'
                          : 'fill-neutral-200 text-neutral-200'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm text-neutral-500">
                  {product.rating.toFixed(1)} ({product.reviewCount} resenas)
                </span>
              </div>
            )}
          </div>

          {/* Price */}
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-neutral-900">{formatPrice(effectivePrice)}</span>
            {product.compareAtPrice && (
              <span className="text-lg text-neutral-400 line-through">{formatPrice(product.compareAtPrice)}</span>
            )}
            {discount && discount > 0 && (
              <Badge variant="error" size="md">-{discount}%</Badge>
            )}
          </div>

          {/* Stock badge */}
          <StockBadge stock={effectiveStock} />

          {/* Badges */}
          <div className="flex gap-2 flex-wrap">
            {product.isNew && <Badge variant="info">Nuevo</Badge>}
            {product.isSale && <Badge variant="error">En oferta</Badge>}
          </div>

          {/* Description */}
          <p className="text-neutral-600 leading-relaxed">{product.description}</p>

          {/* Rich description */}
          {product.richDescription && (
            <div
              className="prose prose-sm prose-neutral max-w-none text-neutral-600"
              dangerouslySetInnerHTML={{ __html: product.richDescription }}
            />
          )}

          {/* Variants */}
          {product.options && product.options.length > 0 && (
            <div className="border-t border-neutral-100 pt-4">
              <VariantSelector
                options={product.options}
                selectedValues={selectedVariants}
                onChange={handleVariantChange}
              />
            </div>
          )}

          {/* Quantity + Add to cart */}
          <div className="border-t border-neutral-100 pt-4 space-y-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center rounded-lg border border-neutral-200">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="flex h-10 w-10 items-center justify-center text-neutral-500 hover:text-neutral-900 disabled:opacity-40 transition-colors text-lg"
                >
                  −
                </button>
                <span className="w-12 text-center text-sm font-semibold">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(effectiveStock, q + 1))}
                  disabled={quantity >= effectiveStock}
                  className="flex h-10 w-10 items-center justify-center text-neutral-500 hover:text-neutral-900 disabled:opacity-40 transition-colors text-lg"
                >
                  +
                </button>
              </div>
              <span className="text-sm text-neutral-400">{effectiveStock} disponibles</span>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleAddToCart}
              disabled={effectiveStock === 0 || cartLoading}
              loading={cartLoading}
              leftIcon={addedToCart ? undefined : <ShoppingCart className="h-5 w-5" />}
            >
              {addedToCart ? 'Agregado al carrito!' : effectiveStock === 0 ? 'Agotado' : 'Agregar al carrito'}
            </Button>

            {cartError && <p className="text-sm text-error-600">{cartError}</p>}
          </div>

          {/* SKU */}
          <p className="text-xs text-neutral-400">
            SKU: {selectedVariant?.sku || product.sku}
          </p>

          {/* Shipping estimator */}
          <ShippingEstimator productId={product.id} />
        </div>
      </div>

      {/* Reviews section */}
      <div className="border-t border-neutral-200 pt-12 space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold text-neutral-900 mb-6">Resenas de clientes</h2>
            <ReviewsList
              reviews={reviews}
              summary={reviewsData?.summary}
              isLoading={reviewsLoading}
            />
          </div>
          <div>
            <ReviewForm productSlug={slug} onSuccess={() => refetchReviews()} />
          </div>
        </div>
      </div>

      {/* Related products */}
      {relatedProducts.length > 0 && (
        <div className="border-t border-neutral-200 pt-12">
          <h2 className="text-xl font-bold text-neutral-900 mb-6">Productos relacionados</h2>
          <ProductGrid products={relatedProducts} columns={4} />
        </div>
      )}
    </div>
  );
}
