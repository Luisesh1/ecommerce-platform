"use client";
import { cn } from '@/lib/utils';

type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

interface StockBadgeProps {
  stock: number;
  lowStockThreshold?: number;
  className?: string;
}

function getStatus(stock: number, threshold: number): StockStatus {
  if (stock <= 0) return 'out_of_stock';
  if (stock <= threshold) return 'low_stock';
  return 'in_stock';
}

const statusConfig: Record<StockStatus, { label: string; dot: string; text: string; bg: string }> = {
  in_stock: {
    label: 'Disponible',
    dot: 'bg-success-500',
    text: 'text-success-700',
    bg: 'bg-success-50',
  },
  low_stock: {
    label: 'Pocas unidades',
    dot: 'bg-warning-500',
    text: 'text-warning-700',
    bg: 'bg-warning-50',
  },
  out_of_stock: {
    label: 'Agotado',
    dot: 'bg-neutral-400',
    text: 'text-neutral-600',
    bg: 'bg-neutral-100',
  },
};

export function StockBadge({ stock, lowStockThreshold = 5, className }: StockBadgeProps) {
  const status = getStatus(stock, lowStockThreshold);
  const config = statusConfig[status];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1',
        config.bg,
        className
      )}
    >
      <div className={cn('h-2 w-2 rounded-full', config.dot)} />
      <span className={cn('text-sm font-medium', config.text)}>
        {config.label}
        {status === 'low_stock' && stock > 0 && ` (${stock} disponibles)`}
      </span>
    </div>
  );
}
