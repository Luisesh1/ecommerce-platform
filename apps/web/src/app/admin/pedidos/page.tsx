"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/admin/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import type { Column } from '@/components/ui/Table';

interface Order {
  id: string;
  number: string;
  customerName: string;
  customerEmail: string;
  total: number;
  status: 'PENDING' | 'PAYMENT_PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
  createdAt: string;
}

interface OrdersResponse {
  data: Order[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'PAYMENT_PENDING', label: 'Pago pendiente' },
  { value: 'CONFIRMED', label: 'Confirmado' },
  { value: 'PROCESSING', label: 'Procesando' },
  { value: 'SHIPPED', label: 'Enviado' },
  { value: 'DELIVERED', label: 'Entregado' },
  { value: 'CANCELLED', label: 'Cancelado' },
  { value: 'REFUNDED', label: 'Reembolsado' },
];

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

function exportCSV(orders: Order[]) {
  const headers = ['#Orden', 'Cliente', 'Email', 'Total', 'Estado', 'Fecha'];
  const rows = orders.map((o) => [
    o.number,
    o.customerName,
    o.customerEmail,
    (o.total / 100).toFixed(2),
    STATUS_LABEL[o.status] ?? o.status,
    formatDate(o.createdAt),
  ]);
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PedidosPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading } = useQuery<OrdersResponse>({
    queryKey: ['admin-orders', page, search, status, dateFrom, dateTo],
    queryFn: () =>
      api.get<OrdersResponse>('/orders', {
        page,
        search,
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        pageSize: 25,
      }),
  });

  const columns: Column<Order>[] = [
    {
      key: 'number',
      header: '#Orden',
      render: (row) => (
        <span className="font-mono font-semibold text-neutral-900">{row.number}</span>
      ),
    },
    {
      key: 'customerName',
      header: 'Cliente',
      render: (row) => (
        <div>
          <div className="font-medium text-neutral-900">{row.customerName}</div>
          <div className="text-xs text-neutral-500">{row.customerEmail}</div>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (row) => (
        <span className="font-semibold text-neutral-900">{formatCurrency(row.total)}</span>
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
      key: 'createdAt',
      header: 'Fecha',
      render: (row) => (
        <span className="text-sm text-neutral-600">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/admin/pedidos/${row.id}`)}
        >
          Ver
        </Button>
      ),
    },
  ];

  const filterPanel = (
    <div className="flex flex-wrap gap-3">
      <Select
        options={STATUS_OPTIONS}
        value={status}
        onChange={setStatus}
        placeholder="Estado"
        className="w-48"
      />
      <Input
        type="date"
        value={dateFrom}
        onChange={(e) => setDateFrom(e.target.value)}
        placeholder="Desde"
        className="w-44"
      />
      <Input
        type="date"
        value={dateTo}
        onChange={(e) => setDateTo(e.target.value)}
        placeholder="Hasta"
        className="w-44"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Pedidos</h1>
          <p className="text-sm text-neutral-500 mt-1">Gestiona todos los pedidos de la tienda</p>
        </div>
      </div>

      <DataTable
        data={data?.data ?? []}
        columns={columns}
        isLoading={isLoading}
        totalCount={data?.total ?? 0}
        page={page}
        pageSize={data?.pageSize ?? 25}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Buscar por cliente, #orden..."
        getRowId={(row) => row.id}
        onExport={() => exportCSV(data?.data ?? [])}
        filterPanel={filterPanel}
        emptyMessage="No hay pedidos"
        onRowClick={(row) => router.push(`/admin/pedidos/${row.id}`)}
      />
    </div>
  );
}
