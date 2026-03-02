"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Package, ChevronRight } from 'lucide-react';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/authContext';
import { formatPrice, formatDate } from '@/lib/utils';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

interface OrderSummaryItem {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  total: number;
  itemCount: number;
}

// ─── Badge colors ─────────────────────────────────────────────────────────────

const statusBadge: Record<
  OrderStatus,
  { variant: 'warning' | 'info' | 'neutral' | 'success' | 'error'; label: string }
> = {
  PENDING: { variant: 'warning', label: 'Pendiente' },
  CONFIRMED: { variant: 'info', label: 'Confirmado' },
  SHIPPED: { variant: 'neutral', label: 'Enviado' },
  DELIVERED: { variant: 'success', label: 'Entregado' },
  CANCELLED: { variant: 'error', label: 'Cancelado' },
};

// Apply purple-style via className override for SHIPPED
const statusClassName: Record<OrderStatus, string> = {
  PENDING: '',
  CONFIRMED: '',
  SHIPPED: 'bg-purple-100 text-purple-700',
  DELIVERED: '',
  CANCELLED: '',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function OrdersTableSkeleton() {
  return (
    <div className="divide-y divide-neutral-100">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center justify-between px-6 py-4 gap-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24 hidden sm:block" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-4 rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['orders', 'my'],
    queryFn: () => api.get<{ data: OrderSummaryItem[] }>('/orders/my'),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/cuenta/pedidos');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading) {
    return (
      <div className="container-page py-8 max-w-4xl">
        <Skeleton className="h-9 w-36 mb-8" />
        <Skeleton className="h-12 w-full rounded-xl mb-1" />
        <OrdersTableSkeleton />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const orders = data?.data || [];

  return (
    <div className="container-page py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Mis pedidos</h1>
          <p className="text-neutral-500 mt-1">
            {orders.length > 0 ? `${orders.length} pedido(s) en total` : 'Historial de tus compras'}
          </p>
        </div>
        <Link
          href="/productos"
          className="text-sm font-medium text-brand-600 hover:text-brand-700 no-underline"
        >
          Seguir comprando
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:flex items-center px-6 py-3 bg-neutral-50 border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase tracking-wide gap-4">
            <span className="w-32">Numero</span>
            <span className="flex-1">Fecha</span>
            <span className="w-28">Estado</span>
            <span className="w-24 text-right">Total</span>
            <span className="w-4" />
          </div>
          <OrdersTableSkeleton />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No tienes pedidos aun"
          description="Cuando realices tu primera compra, apareceran aqui."
          action={{
            label: 'Explorar productos',
            onClick: () => router.push('/productos'),
          }}
        />
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
          {/* Desktop table header */}
          <div className="hidden sm:grid grid-cols-[140px_1fr_140px_100px_40px] px-6 py-3 bg-neutral-50 border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase tracking-wide">
            <span>Numero</span>
            <span>Fecha</span>
            <span>Estado</span>
            <span className="text-right">Total</span>
            <span />
          </div>

          {/* Rows */}
          <div className="divide-y divide-neutral-100">
            {orders.map((order) => {
              const badge = statusBadge[order.status] || { variant: 'neutral' as const, label: order.status };
              const badgeClass = statusClassName[order.status] || '';

              return (
                <Link
                  key={order.id}
                  href={`/cuenta/pedidos/${order.id}`}
                  className="flex sm:grid sm:grid-cols-[140px_1fr_140px_100px_40px] items-center px-6 py-4 gap-4 hover:bg-neutral-50 transition-colors no-underline group"
                >
                  {/* Order number */}
                  <div className="font-mono font-semibold text-sm text-brand-700 truncate">
                    #{order.orderNumber}
                  </div>

                  {/* Date */}
                  <div className="hidden sm:block text-sm text-neutral-600">
                    {formatDate(order.createdAt)}
                  </div>

                  {/* Status badge */}
                  <div>
                    <Badge
                      variant={badge.variant}
                      size="sm"
                      className={badgeClass || undefined}
                    >
                      {badge.label}
                    </Badge>
                  </div>

                  {/* Total */}
                  <div className="ml-auto sm:ml-0 sm:text-right font-semibold text-sm text-neutral-900">
                    {formatPrice(order.total)}
                  </div>

                  {/* Arrow */}
                  <div className="hidden sm:flex justify-center">
                    <ChevronRight className="h-4 w-4 text-neutral-400 group-hover:text-neutral-700 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
