"use client";

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import type { Column } from '@/components/ui/Table';
import { DataTable } from '@/components/admin/DataTable';

interface CustomerOrder {
  id: string;
  number: string;
  total: number;
  status: string;
  createdAt: string;
}

interface CustomerAddress {
  id: string;
  label?: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  isDefault: boolean;
}

interface CustomerDetail {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
  orders: CustomerOrder[];
  addresses: CustomerAddress[];
  stats: {
    totalSpent: number;
    completedOrders: number;
    lastOrderDate?: string;
  };
}

type BadgeVariant = 'success' | 'warning' | 'neutral' | 'error' | 'info';

const STATUS_BADGE: Record<string, BadgeVariant> = {
  DELIVERED: 'success',
  SHIPPED: 'info',
  PROCESSING: 'info',
  CONFIRMED: 'info',
  PENDING: 'neutral',
  PAYMENT_PENDING: 'warning',
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
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(s));
}

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: customer, isLoading } = useQuery<CustomerDetail>({
    queryKey: ['admin-customer', id],
    queryFn: () => api.get<CustomerDetail>(`/users/${id}`),
    enabled: !!id,
  });

  const orderColumns: Column<CustomerOrder>[] = [
    {
      key: 'number',
      header: '#Orden',
      render: (row) => (
        <button
          className="font-mono font-semibold text-brand-600 hover:underline"
          onClick={() => router.push(`/admin/pedidos/${row.id}`)}
        >
          {row.number}
        </button>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'neutral'} size="sm">
          {STATUS_LABEL[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (row) => <span className="font-semibold">{formatCurrency(row.total)}</span>,
    },
    {
      key: 'createdAt',
      header: 'Fecha',
      render: (row) => <span className="text-sm text-neutral-600">{formatDate(row.createdAt)}</span>,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{customer.name}</h1>
          <p className="text-sm text-neutral-500">{customer.email}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="text-sm text-neutral-500 mb-1">Total gastado</div>
          <div className="text-2xl font-bold text-neutral-900">
            {formatCurrency(customer.stats.totalSpent)}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-neutral-500 mb-1">Pedidos completados</div>
          <div className="text-2xl font-bold text-neutral-900">
            {customer.stats.completedOrders}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-neutral-500 mb-1">Último pedido</div>
          <div className="text-2xl font-bold text-neutral-900">
            {customer.stats.lastOrderDate ? formatDate(customer.stats.lastOrderDate) : '—'}
          </div>
        </Card>
      </div>

      {/* Profile info */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Información del perfil</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-neutral-500">Nombre</div>
            <div className="text-neutral-900 font-medium">{customer.name}</div>
          </div>
          <div>
            <div className="text-neutral-500">Email</div>
            <div className="text-neutral-900 font-medium">{customer.email}</div>
          </div>
          <div>
            <div className="text-neutral-500">Teléfono</div>
            <div className="text-neutral-900 font-medium">{customer.phone ?? '—'}</div>
          </div>
          <div>
            <div className="text-neutral-500">Registrado</div>
            <div className="text-neutral-900 font-medium">{formatDate(customer.createdAt)}</div>
          </div>
        </div>
      </Card>

      {/* Orders */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">
          Pedidos ({customer.orders.length})
        </h2>
        <DataTable
          data={customer.orders}
          columns={orderColumns}
          isLoading={false}
          totalCount={customer.orders.length}
          page={1}
          pageSize={customer.orders.length}
          onPageChange={() => {}}
          getRowId={(row) => row.id}
          emptyMessage="Sin pedidos"
          onRowClick={(row) => router.push(`/admin/pedidos/${row.id}`)}
        />
      </Card>

      {/* Addresses */}
      {customer.addresses.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            Direcciones guardadas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {customer.addresses.map((addr) => (
              <div
                key={addr.id}
                className="p-4 rounded-lg border border-neutral-200 text-sm text-neutral-600 space-y-0.5"
              >
                {addr.label && (
                  <div className="font-semibold text-neutral-900 flex items-center gap-2">
                    {addr.label}
                    {addr.isDefault && (
                      <Badge variant="success" size="sm">Predeterminada</Badge>
                    )}
                  </div>
                )}
                <div>{addr.line1}</div>
                <div>
                  {addr.city}, {addr.state} {addr.zip}
                </div>
                <div>{addr.country}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
