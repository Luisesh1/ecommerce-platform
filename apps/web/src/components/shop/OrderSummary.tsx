"use client";
import { useState } from 'react';
import { Tag, X } from 'lucide-react';
import { Cart, useCart } from '@/lib/cart';
import { formatPrice } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/useToast';

interface OrderSummaryProps {
  cart: Cart;
  showCoupon?: boolean;
  showCheckoutButton?: boolean;
  onCheckout?: () => void;
}

export function OrderSummary({
  cart,
  showCoupon = true,
  showCheckoutButton = false,
  onCheckout,
}: OrderSummaryProps) {
  const { applyCoupon, removeCoupon } = useCart();
  const { success, error } = useToast();
  const [couponInput, setCouponInput] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setIsApplying(true);
    try {
      await applyCoupon(couponInput.trim().toUpperCase());
      success('Cupon aplicado', `Cupon ${couponInput.toUpperCase()} aplicado correctamente`);
      setCouponInput('');
    } catch {
      error('Cupon invalido', 'El cupon ingresado no es valido o ya expiro');
    } finally {
      setIsApplying(false);
    }
  };

  const handleRemoveCoupon = async () => {
    try {
      await removeCoupon();
    } catch {
      error('Error', 'No se pudo eliminar el cupon');
    }
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 space-y-4">
      <h3 className="text-lg font-semibold text-neutral-900">Resumen del pedido</h3>

      {/* Line items */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-neutral-600">
          <span>Subtotal ({cart.items.reduce((s, i) => s + i.quantity, 0)} productos)</span>
          <span>{formatPrice(cart.subtotal)}</span>
        </div>

        {cart.couponCode && cart.couponDiscount !== undefined && cart.couponDiscount > 0 && (
          <div className="flex justify-between text-success-700">
            <div className="flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" />
              <span>Cupon: {cart.couponCode}</span>
              <button
                onClick={handleRemoveCoupon}
                className="text-neutral-400 hover:text-error-500 ml-1"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <span>-{formatPrice(cart.couponDiscount)}</span>
          </div>
        )}

        {cart.discount > 0 && (
          <div className="flex justify-between text-success-700">
            <span>Descuento</span>
            <span>-{formatPrice(cart.discount)}</span>
          </div>
        )}

        <div className="flex justify-between text-neutral-600">
          <span>Envio</span>
          <span>
            {cart.shipping === 0 ? (
              <span className="text-success-600 font-medium">Gratis</span>
            ) : (
              formatPrice(cart.shipping)
            )}
          </span>
        </div>

        <div className="flex justify-between text-neutral-600">
          <span>Impuestos</span>
          <span>{formatPrice(cart.tax)}</span>
        </div>

        <div className="border-t border-neutral-200 pt-2 flex justify-between font-bold text-base text-neutral-900">
          <span>Total</span>
          <span>{formatPrice(cart.total)}</span>
        </div>
      </div>

      {/* Coupon input */}
      {showCoupon && !cart.couponCode && (
        <div className="border-t border-neutral-100 pt-4">
          <p className="text-sm font-medium text-neutral-700 mb-2">Cupon de descuento</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              placeholder="CODIGO-DESCUENTO"
              className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm uppercase placeholder:normal-case focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleApplyCoupon}
              loading={isApplying}
            >
              Aplicar
            </Button>
          </div>
        </div>
      )}

      {showCheckoutButton && (
        <Button
          className="w-full"
          size="lg"
          onClick={onCheckout}
          disabled={cart.items.length === 0}
        >
          Proceder al pago
        </Button>
      )}
    </div>
  );
}
