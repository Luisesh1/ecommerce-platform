"use client";
import { Check, Circle, Package, Truck, Home, XCircle, Clock } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

type OrderStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

interface TimelineEvent {
  status: OrderStatus;
  label: string;
  description?: string;
  timestamp?: string;
}

const statusOrder: OrderStatus[] = [
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
];

const icons: Record<OrderStatus, typeof Package> = {
  PENDING: Clock,
  PROCESSING: Package,
  SHIPPED: Truck,
  DELIVERED: Home,
  CANCELLED: XCircle,
  REFUNDED: XCircle,
};

const labels: Record<OrderStatus, string> = {
  PENDING: 'Pedido recibido',
  PROCESSING: 'En preparacion',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
  REFUNDED: 'Reembolsado',
};

interface OrderTimelineProps {
  currentStatus: OrderStatus;
  events?: TimelineEvent[];
}

export function OrderTimeline({ currentStatus, events }: OrderTimelineProps) {
  const isTerminal = currentStatus === 'CANCELLED' || currentStatus === 'REFUNDED';

  if (isTerminal) {
    const Icon = icons[currentStatus];
    return (
      <div className="flex items-center gap-3 rounded-lg bg-error-50 px-4 py-3">
        <Icon className="h-5 w-5 text-error-500" />
        <span className="text-sm font-semibold text-error-700">{labels[currentStatus]}</span>
      </div>
    );
  }

  const currentIndex = statusOrder.indexOf(currentStatus);

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-neutral-200" />

      <div className="space-y-6">
        {statusOrder.map((status, index) => {
          const isCompleted = index < currentIndex;
          const isActive = index === currentIndex;
          const Icon = icons[status];
          const event = events?.find((e) => e.status === status);

          return (
            <div key={status} className="relative flex gap-4">
              {/* Icon circle */}
              <div
                className={cn(
                  'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2',
                  isCompleted && 'border-brand-600 bg-brand-600',
                  isActive && 'border-brand-600 bg-white',
                  !isCompleted && !isActive && 'border-neutral-200 bg-white'
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5 text-white" />
                ) : (
                  <Icon
                    className={cn(
                      'h-5 w-5',
                      isActive ? 'text-brand-600' : 'text-neutral-300'
                    )}
                  />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pt-1.5 pb-2">
                <p
                  className={cn(
                    'text-sm font-semibold',
                    isActive ? 'text-brand-700' : isCompleted ? 'text-neutral-900' : 'text-neutral-400'
                  )}
                >
                  {event?.label || labels[status]}
                </p>
                {(event?.description || event?.timestamp) && (
                  <div className="mt-0.5 space-y-0.5">
                    {event.description && (
                      <p className="text-xs text-neutral-500">{event.description}</p>
                    )}
                    {event.timestamp && (
                      <p className="text-xs text-neutral-400">
                        {formatDate(event.timestamp, { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
