"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Package, MapPin, CreditCard } from 'lucide-react';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/authContext';
import { formatPrice, formatDate } from '@/lib/utils';

import { OrderTimeline } from '@/components/shop/OrderTimeline';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';

interface OrderItem {
  id: string;
  name: string;
  slug: string;
  image: string;
  sku: string;
  quantity: number;
  price: number;
  options: Record<string, string>;
}

interface TimelineEvent {
  status: OrderStatus;
  label: string;
  description?: string;
  timestamp?: string;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
  couponCode?: string;
  shippingAddress: {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
  shippingMethod?: {
    name: string;
    estimatedDays: number;
  };
  paymentMethod?: {
    gateway: string;
    last4?: string;
    brand?: string;
  };
  timeline?: TimelineEvent[];
  estimatedDelivery?: string;
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

const statusBadge: Record<
  OrderStatus,
  { variant: 'warning' | 'info' | 'neutral' | 'success' | 'error'; label: string; className?: string }
> = {
  PENDING: { variant: 'warning', label: 'Pendiente' },
  PROCESSING: { variant: 'info', label: 'En preparacion' },
  SHIPPED: { variant: 'neutral', label: 'Enviado', className: 'bg-purple-100 text-purple-700' },
  DELIVERED: { variant: 'success', label: 'Entregado' },
  CANCELLED: { variant: 'error', label: 'Cancelado' },
  REFUNDED: { variant: 'error', label: 'Reembolsado' },
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function OrderDetailSkeleton() {
  return (
    <div className="container-page py-8 max-w-4xl space-y-8">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['orders', orderId],
    queryFn: () => api.get<OrderDetail>(`/orders/${orderId}`),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/login?redirect=/cuenta/pedidos/${orderId}`);
    }
  }, [authLoading, isAuthenticated, router, orderId]);

  const handleDownloadInvoice = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/orders/${orderId}/invoice`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
          },
        }
      );
      if (!response.ok) throw new Error('Error al descargar factura');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura-${order?.orderNumber || orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('No se pudo descargar la factura. Intenta de nuevo.');
    }
  };

  if (authLoading || isLoading) return <OrderDetailSkeleton />;
  if (!isAuthenticated) return null;

  if (isError || !order) {
    return (
      <div className="container-page py-16 text-center">
        <p className="text-neutral-500 mb-4">No se encontro el pedido.</p>
        <Button variant="outline" onClick={() => router.push('/cuenta/pedidos')} leftIcon={<ArrowLeft className="h-4 w-4" />}>
          Volver a mis pedidos
        </Button>
      </div>
    );
  }

  const badge = statusBadge[order.status] || { variant: 'neutral' as const, label: order.status };

  return (
    <div className="container-page py-8 max-w-4xl space-y-8">
      {/* Back + Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <Link
          href="/cuenta/pedidos"
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors no-underline w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Mis pedidos
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-neutral-900">
            Pedido <span className="font-mono text-brand-700">#{order.orderNumber}</span>
          </h1>
          <Badge
            variant={badge.variant}
            className={badge.className || undefined}
          >
            {badge.label}
          </Badge>
        </div>
      </div>

      <p className="text-sm text-neutral-500 -mt-4">
        Realizado el {formatDate(order.createdAt)}
        {order.estimatedDelivery && (
          <> · Entrega estimada: {formatDate(order.estimatedDelivery)}</>
        )}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — items + timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50">
              <p className="font-semibold text-neutral-800">
                Productos ({order.items.reduce((s, i) => s + i.quantity, 0)})
              </p>
            </div>
            <div className="divide-y divide-neutral-100">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-4 px-6 py-4">
                  <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-neutral-50 border border-neutral-100 shrink-0">
                    {item.image ? (
                      <Image src={item.image} alt={item.name} fill className="object-cover" sizes="64px" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-5 w-5 text-neutral-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/productos/${item.slug}`}
                      className="text-sm font-semibold text-neutral-900 hover:text-brand-600 no-underline transition-colors line-clamp-2"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs text-neutral-400 mt-0.5">SKU: {item.sku}</p>
                    {Object.entries(item.options || {}).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(item.options).map(([k, v]) => (
                          <span key={k} className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded">
                            {k}: {v}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-neutral-500 mt-1">Cantidad: {item.quantity}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-neutral-900">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                    {item.quantity > 1 && (
                      <p className="text-xs text-neutral-400">{formatPrice(item.price)} c/u</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-neutral-200 px-6 py-4 space-y-1.5 bg-neutral-50">
              <div className="flex justify-between text-sm text-neutral-600">
                <span>Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-sm text-success-700">
                  <span>Descuento{order.couponCode && ` (${order.couponCode})`}</span>
                  <span>-{formatPrice(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-neutral-600">
                <span>Envio</span>
                <span>
                  {order.shipping === 0 ? (
                    <span className="text-success-600 font-medium">Gratis</span>
                  ) : (
                    formatPrice(order.shipping)
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm text-neutral-600">
                <span>Impuestos</span>
                <span>{formatPrice(order.tax)}</span>
              </div>
              <div className="flex justify-between font-bold text-neutral-900 pt-2 border-t border-neutral-200">
                <span>Total</span>
                <span>{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <h2 className="font-semibold text-neutral-900 mb-6">Estado del pedido</h2>
            <OrderTimeline
              currentStatus={order.status as Parameters<typeof OrderTimeline>[0]['currentStatus']}
              events={order.timeline}
            />
          </div>
        </div>

        {/* Right column — address, payment, actions */}
        <div className="space-y-4">
          {/* Shipping address */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-brand-600" />
              <p className="text-sm font-semibold text-neutral-800">Direccion de envio</p>
            </div>
            <div className="text-sm text-neutral-600 space-y-0.5">
              <p className="font-medium text-neutral-900">
                {order.shippingAddress.firstName} {order.shippingAddress.lastName}
              </p>
              <p>{order.shippingAddress.address}</p>
              <p>
                {order.shippingAddress.city}, CP {order.shippingAddress.postalCode}
              </p>
              <p>{order.shippingAddress.country}</p>
              {order.shippingAddress.phone && (
                <p className="text-neutral-400 text-xs mt-1">{order.shippingAddress.phone}</p>
              )}
            </div>
          </div>

          {/* Shipping method */}
          {order.shippingMethod && (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4 text-brand-600" />
                <p className="text-sm font-semibold text-neutral-800">Metodo de envio</p>
              </div>
              <p className="text-sm text-neutral-600">{order.shippingMethod.name}</p>
              <p className="text-xs text-neutral-400 mt-0.5">
                {order.shippingMethod.estimatedDays} dias habiles
              </p>
            </div>
          )}

          {/* Payment info */}
          {order.paymentMethod && (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-4 w-4 text-brand-600" />
                <p className="text-sm font-semibold text-neutral-800">Pago</p>
              </div>
              <p className="text-sm text-neutral-600 capitalize">{order.paymentMethod.gateway}</p>
              {order.paymentMethod.brand && order.paymentMethod.last4 && (
                <p className="text-xs text-neutral-400 mt-0.5">
                  {order.paymentMethod.brand} **** {order.paymentMethod.last4}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {order.status === 'DELIVERED' && (
              <Button
                className="w-full"
                variant="outline"
                leftIcon={<Download className="h-4 w-4" />}
                onClick={handleDownloadInvoice}
              >
                Descargar factura
              </Button>
            )}
            <Button
              className="w-full"
              variant="ghost"
              onClick={() => router.push('/cuenta/pedidos')}
              leftIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Volver a mis pedidos
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
