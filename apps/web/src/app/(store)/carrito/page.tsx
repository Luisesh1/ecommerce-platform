"use client";

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingCart, ArrowRight, Tag, X } from 'lucide-react';
import { useState } from 'react';

import { useCart } from '@/lib/cart';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';

import { CartItemRow } from '@/components/shop/CartItem';
import { OrderSummary } from '@/components/shop/OrderSummary';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';

interface PromoResult {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountAmount: number;
  message: string;
}

function CouponSection() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [promo, setPromo] = useState<PromoResult | null>(null);
  const [error, setError] = useState('');
  const { applyCoupon, cart } = useCart();

  const handleApply = async () => {
    if (!code.trim()) return;
    setError('');
    setLoading(true);
    try {
      // Validate via promos endpoint first
      const result = await api.post<PromoResult>('/promos/validate', { code: code.trim().toUpperCase() });
      setPromo(result);
      // Apply to cart
      await applyCoupon(result.code);
    } catch {
      setError('Cupon invalido o expirado.');
      setPromo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    const { removeCoupon } = useCart as unknown as ReturnType<typeof useCart>;
    setPromo(null);
    setCode('');
  };

  // If cart already has a coupon applied
  if (cart?.couponCode) {
    return (
      <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-success-600" />
          <span className="text-sm font-medium text-success-800">
            Cupon <strong>{cart.couponCode}</strong> aplicado
          </span>
          {cart.couponDiscount !== undefined && cart.couponDiscount > 0 && (
            <Badge variant="success" size="sm">
              -{formatPrice(cart.couponDiscount)}
            </Badge>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-neutral-700">Codigo de descuento</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="INGRESA TU CUPON"
          className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm uppercase placeholder:normal-case focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          onKeyDown={(e) => e.key === 'Enter' && handleApply()}
        />
        <Button variant="outline" size="sm" onClick={handleApply} loading={loading}>
          Aplicar
        </Button>
      </div>
      {error && <p className="text-xs text-error-600">{error}</p>}
      {promo && (
        <div className="rounded-md bg-success-50 border border-success-200 px-3 py-2 text-sm text-success-800">
          {promo.message || `Descuento de ${formatPrice(promo.discountAmount)} aplicado`}
        </div>
      )}
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 py-4 border-b border-neutral-100">
          <Skeleton className="h-24 w-24 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-24" />
            <div className="flex justify-between mt-4">
              <Skeleton className="h-8 w-28 rounded-lg" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CartPage() {
  const router = useRouter();
  const { cart, isLoading } = useCart();

  const isEmpty = !cart || cart.items.length === 0;

  return (
    <div className="container-page py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900">Carrito de compras</h1>
        {!isEmpty && (
          <p className="text-neutral-500 mt-1">
            {cart.items.reduce((sum, i) => sum + i.quantity, 0)} producto(s) en tu carrito
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <CartSkeleton />
          </div>
          <div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={ShoppingCart}
          title="Tu carrito esta vacio"
          description="Agrega productos a tu carrito para continuar con tu compra."
          action={{
            label: 'Explorar productos',
            onClick: () => router.push('/productos'),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Cart items */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-neutral-200 bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-neutral-900">
                  Productos ({cart.items.reduce((s, i) => s + i.quantity, 0)})
                </h2>
                <Link
                  href="/productos"
                  className="text-sm text-brand-600 hover:text-brand-700 font-medium no-underline flex items-center gap-1"
                >
                  Seguir comprando
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="divide-y divide-neutral-100">
                {cart.items.map((item) => (
                  <CartItemRow key={item.id} item={item} />
                ))}
              </div>
            </div>

            {/* Coupon section standalone */}
            <div className="rounded-xl border border-neutral-200 bg-white p-6">
              <CouponSection />
            </div>
          </div>

          {/* Order summary sidebar */}
          <div className="space-y-4">
            <OrderSummary
              cart={cart}
              showCoupon={false}
              showCheckoutButton={true}
              onCheckout={() => router.push('/checkout')}
            />

            {/* Trust badges */}
            <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
              <div className="flex items-center gap-3 text-sm text-neutral-600">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 shrink-0">
                  <svg className="h-4 w-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-neutral-800 text-xs">Pago seguro</p>
                  <p className="text-xs text-neutral-500">Tus datos estan protegidos</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm text-neutral-600">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success-50 shrink-0">
                  <svg className="h-4 w-4 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-neutral-800 text-xs">Devolucion gratuita</p>
                  <p className="text-xs text-neutral-500">30 dias para devolver tu pedido</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
