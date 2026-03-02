"use client";
import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { CartItem as CartItemType } from '@/lib/cart';
import { formatPrice } from '@/lib/utils';
import { useCart } from '@/lib/cart';
import { useToast } from '@/components/ui/useToast';

interface CartItemProps {
  item: CartItemType;
}

export function CartItemRow({ item }: CartItemProps) {
  const { updateItem, removeItem } = useCart();
  const { success } = useToast();

  const handleQuantityChange = async (newQty: number) => {
    if (newQty < 1) return;
    await updateItem(item.id, newQty);
  };

  const handleRemove = async () => {
    await removeItem(item.id);
    success('Eliminado', `${item.name} se elimino del carrito`);
  };

  return (
    <div className="flex gap-4 py-4 border-b border-neutral-100 last:border-0">
      {/* Image */}
      <Link href={`/productos/${item.slug}`} className="shrink-0">
        <div className="relative h-24 w-24 overflow-hidden rounded-lg bg-neutral-50 border border-neutral-100">
          {item.image ? (
            <Image
              src={item.image}
              alt={item.name}
              fill
              className="object-cover"
              sizes="96px"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-neutral-300 text-xs">
              Sin imagen
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="flex flex-1 flex-col justify-between min-w-0">
        <div>
          <Link
            href={`/productos/${item.slug}`}
            className="text-sm font-semibold text-neutral-900 hover:text-brand-600 transition-colors no-underline line-clamp-2"
          >
            {item.name}
          </Link>
          <p className="text-xs text-neutral-400 mt-0.5">SKU: {item.sku}</p>
          {Object.entries(item.options || {}).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(item.options).map(([key, value]) => (
                <span key={key} className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                  {key}: {value}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-2">
          {/* Quantity */}
          <div className="flex items-center gap-1 rounded-lg border border-neutral-200">
            <button
              onClick={() => handleQuantityChange(item.quantity - 1)}
              disabled={item.quantity <= 1}
              className="flex h-8 w-8 items-center justify-center text-neutral-500 hover:text-neutral-900 disabled:opacity-40 transition-colors"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
            <button
              onClick={() => handleQuantityChange(item.quantity + 1)}
              className="flex h-8 w-8 items-center justify-center text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* Price + remove */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-neutral-900">
              {formatPrice(item.price * item.quantity)}
            </span>
            <button
              onClick={handleRemove}
              className="text-neutral-300 hover:text-error-500 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
