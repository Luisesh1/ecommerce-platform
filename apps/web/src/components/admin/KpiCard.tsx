import { ElementType } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  trendLabel?: string;
  icon?: ElementType;
  iconColor?: string;
  isLoading?: boolean;
  className?: string;
}

export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  icon: Icon,
  iconColor = 'text-brand-600',
  isLoading,
  className,
}: KpiCardProps) {
  if (isLoading) {
    return (
      <div className={cn('rounded-xl border border-neutral-200 bg-white p-6', className)}>
        <div className="flex items-start justify-between mb-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
        <Skeleton className="h-8 w-28 mb-2" />
        <Skeleton className="h-4 w-20" />
      </div>
    );
  }

  const trendPositive = trend !== undefined && trend > 0;
  const trendNegative = trend !== undefined && trend < 0;
  const TrendIcon = trendPositive ? TrendingUp : trendNegative ? TrendingDown : Minus;

  return (
    <div className={cn('rounded-xl border border-neutral-200 bg-white p-6', className)}>
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium text-neutral-500">{title}</p>
        {Icon && (
          <div className={cn('rounded-xl bg-neutral-50 p-2.5', iconColor)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-neutral-900 mb-1">{value}</p>
      <div className="flex items-center gap-2">
        {trend !== undefined && (
          <div
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              trendPositive && 'text-success-600',
              trendNegative && 'text-error-600',
              !trendPositive && !trendNegative && 'text-neutral-400'
            )}
          >
            <TrendIcon className="h-3.5 w-3.5" />
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
        {trendLabel && (
          <span className="text-xs text-neutral-400">{trendLabel}</span>
        )}
        {subtitle && !trendLabel && (
          <span className="text-xs text-neutral-500">{subtitle}</span>
        )}
      </div>
    </div>
  );
}
