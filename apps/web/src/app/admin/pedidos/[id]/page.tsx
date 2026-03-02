"use client";

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  Truck,
  XCircle,
  RotateCcw,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/useToast';

// ---- Types ----

type OrderStatus =
  | 'PENDING'
  | 'PAYMENT_PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

interface OrderItem {
  id: string;
  productName: string;
  variantName?: string;
  sku: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface OrderTimeline {
  status: OrderStatus;
  date: string;
  description: string;
}

interface OrderDetail {
  id: string;
  number: string;
  status: OrderStatus;
  createdAt: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  tax: number;
  discount: number;
  total: number;
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  tracking?: {
    number?: string;
    url?: string;
  };
  timeline: OrderTimeline[];
}

// ---- Helpers ----

type BadgeVariant = 'success' | 'warning' | 'neutral' | 'error' | 'info';

const STATUS_BADGE: Record<string, BadgeVariant> = {
  PENDING: 'neutral',
  PAYMENT_PENDING: 'warning',
  CONFIRMED: 'info',
  PROCESSING: 'info',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'error',
  REFUNDED: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  PAYMENT_PENDING: 'Pago pendiente',
  CONFIRMED: 'Confirmado',
  PROCESSING: 'Procesando',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
  REFUNDED: 'Reembolsado',
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n / 100);
}

function formatDate(s: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s));
}

const TIMELINE_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-4 w-4 text-neutral-500" />,
  PAYMENT_PENDING: <AlertCircle className="h-4 w-4 text-warning-500" />,
  CONFIRMED: <CheckCircle className="h-4 w-4 text-brand-500" />,
  PROCESSING: <Package className="h-4 w-4 text-brand-500" />,
  SHIPPED: <Truck className="h-4 w-4 text-brand-500" />,
  DELIVERED: <CheckCircle className="h-4 w-4 text-success-500" />,
  CANCELLED: <XCircle className="h-4 w-4 text-error-500" />,
  REFUNDED: <RotateCcw className="h-4 w-4 text-neutral-500" />,
};

// ---- Component ----

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const { data: order, isLoading } = useQuery<OrderDetail>({
    queryKey: ['admin-order', id],
    queryFn: () => api.get<OrderDetail>(`/orders/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (order) {
      setTrackingNumber(order.tracking?.number ?? '');
      setTrackingUrl(order.tracking?.url ?? '');
    }
  }, [order]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-order', id] });

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => { toast({ title: 'Estado actualizado', variant: 'success' }); invalidate(); },
    onError: () => toast({ title: 'Error al actualizar estado', variant: 'error' }),
  });

  const saveTracking = useMutation({
    mutationFn: () =>
      api.patch(`/orders/${id}/tracking`, { number: trackingNumber, url: trackingUrl }),
    onSuccess: () => { toast({ title: 'Tracking guardado', variant: 'success' }); invalidate(); },
    onError: () => toast({ title: 'Error al guardar tracking', variant: 'error' }),
  });

  const createRefund = useMutation({
    mutationFn: () =>
      api.post(`/orders/${id}/refund`, {
        amount: refundAmount ? Math.round(parseFloat(refundAmount) * 100) : undefined,
        reason: refundReason,
      }),
    onSuccess: () => {
      toast({ title: 'Reembolso creado', variant: 'success' });
      setShowRefundModal(false);
      invalidate();
    },
    onError: () => toast({ title: 'Error al crear reembolso', variant: 'error' }),
  });

  const cancelOrder = useMutation({
    mutationFn: () => api.patch(`/orders/${id}/status`, { status: 'CANCELLED' }),
    onSuccess: () => {
      toast({ title: 'Pedido cancelado', variant: 'success' });
      setShowCancelModal(false);
      invalidate();
    },
    onError: () => toast({ title: 'Error al cancelar pedido', variant: 'error' }),
  });

  const downloadPackingSlip = async () => {
    const blob = await api.getBlob(`/orders/${id}/packing-slip`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `packing-slip-${order?.number ?? id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-neutral-900">Pedido {order.number}</h1>
              <Badge variant={STATUS_BADGE[order.status] ?? 'neutral'}>
                {STATUS_LABEL[order.status] ?? order.status}
              </Badge>
            </div>
            <p className="text-sm text-neutral-500 mt-0.5">{formatDate(order.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FileText className="h-4 w-4" />}
            onClick={downloadPackingSlip}
          >
            Packing Slip PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Artículos</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500">
                  <th className="text-left pb-3 font-medium">Producto</th>
                  <th className="text-center pb-3 font-medium">Qty</th>
                  <th className="text-right pb-3 font-medium">Precio unit.</th>
                  <th className="text-right pb-3 font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.productName}
                            className="h-10 w-10 rounded object-cover bg-neutral-100"
                          />
                        )}
                        <div>
                          <div className="font-medium text-neutral-900">{item.productName}</div>
                          {item.variantName && (
                            <div className="text-xs text-neutral-500">{item.variantName}</div>
                          )}
                          <div className="text-xs text-neutral-400 font-mono">{item.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center text-neutral-700">{item.quantity}</td>
                    <td className="py-3 text-right text-neutral-700">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-3 text-right font-medium text-neutral-900">{formatCurrency(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="mt-4 pt-4 border-t border-neutral-200 space-y-2">
              <div className="flex justify-between text-sm text-neutral-600">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-neutral-600">
                <span>Envío</span>
                <span>{formatCurrency(order.shippingCost)}</span>
              </div>
              <div className="flex justify-between text-sm text-neutral-600">
                <span>Impuestos</span>
                <span>{formatCurrency(order.tax)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-sm text-success-600">
                  <span>Descuento</span>
                  <span>-{formatCurrency(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-neutral-900 pt-2 border-t border-neutral-200">
                <span>Total</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>
          </Card>

          {/* Tracking */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Tracking de envío</h2>
            <div className="flex flex-col gap-3">
              <Input
                label="Número de guía"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Ej: 1Z999AA10123456784"
              />
              <Input
                label="URL de rastreo"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                placeholder="https://tracking.carrier.com/..."
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => saveTracking.mutate()}
                  loading={saveTracking.isPending}
                >
                  Guardar tracking
                </Button>
              </div>
            </div>
          </Card>

          {/* Timeline */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Historial del pedido</h2>
            <div className="space-y-4">
              {order.timeline.map((event, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">
                    {TIMELINE_ICONS[event.status] ?? <Clock className="h-4 w-4 text-neutral-400" />}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-neutral-900">
                      {STATUS_LABEL[event.status] ?? event.status}
                    </div>
                    <div className="text-xs text-neutral-500">{formatDate(event.date)}</div>
                    {event.description && (
                      <div className="text-sm text-neutral-600 mt-0.5">{event.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Customer */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-3">Cliente</h2>
            <div className="space-y-1.5 text-sm">
              <div className="font-medium text-neutral-900">{order.customer.name}</div>
              <div className="text-neutral-600">{order.customer.email}</div>
              {order.customer.phone && (
                <div className="text-neutral-600">{order.customer.phone}</div>
              )}
            </div>
          </Card>

          {/* Shipping address */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-3">Dirección de envío</h2>
            <div className="text-sm text-neutral-600 space-y-0.5">
              <div>{order.shippingAddress.line1}</div>
              {order.shippingAddress.line2 && <div>{order.shippingAddress.line2}</div>}
              <div>
                {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                {order.shippingAddress.zip}
              </div>
              <div>{order.shippingAddress.country}</div>
            </div>
          </Card>

          {/* Actions */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-3">Acciones</h2>
            <div className="space-y-2">
              {order.status === 'CONFIRMED' && (
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  leftIcon={<Package className="h-4 w-4" />}
                  onClick={() => updateStatus.mutate('PROCESSING')}
                  loading={updateStatus.isPending}
                >
                  Marcar como procesado
                </Button>
              )}
              {order.status === 'PROCESSING' && (
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  leftIcon={<Truck className="h-4 w-4" />}
                  onClick={() => updateStatus.mutate('SHIPPED')}
                  loading={updateStatus.isPending}
                >
                  Marcar como enviado
                </Button>
              )}
              {!['CANCELLED', 'REFUNDED', 'DELIVERED'].includes(order.status) && (
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  leftIcon={<RotateCcw className="h-4 w-4" />}
                  onClick={() => setShowRefundModal(true)}
                >
                  Crear reembolso
                </Button>
              )}
              {!['CANCELLED', 'REFUNDED', 'DELIVERED', 'SHIPPED'].includes(order.status) && (
                <Button
                  variant="danger"
                  size="sm"
                  fullWidth
                  leftIcon={<XCircle className="h-4 w-4" />}
                  onClick={() => setShowCancelModal(true)}
                >
                  Cancelar pedido
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Refund Modal */}
      <Modal
        open={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        title="Crear reembolso"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowRefundModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createRefund.mutate()}
              loading={createRefund.isPending}
            >
              Confirmar reembolso
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Total del pedido: <strong>{formatCurrency(order.total)}</strong>
          </p>
          <Input
            label="Monto a reembolsar (vacío = reembolso total)"
            type="number"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            placeholder={`Máx. ${(order.total / 100).toFixed(2)}`}
            prefix={<span className="text-sm">$</span>}
          />
          <Input
            label="Razón del reembolso"
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder="Ej: Producto defectuoso"
            required
          />
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancelar pedido"
        description={`¿Estás seguro de que deseas cancelar el pedido ${order.number}? Esta acción no se puede deshacer.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowCancelModal(false)}>
              Volver
            </Button>
            <Button
              variant="danger"
              onClick={() => cancelOrder.mutate()}
              loading={cancelOrder.isPending}
            >
              Cancelar pedido
            </Button>
          </div>
        }
      >
        <p className="text-sm text-neutral-600">
          Se cancelará el pedido y se notificará al cliente por email.
        </p>
      </Modal>
    </div>
  );
}
