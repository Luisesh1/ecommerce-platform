"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/admin/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import type { Column } from '@/components/ui/Table';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  ordersCount: number;
  totalSpent: number;
  createdAt: string;
}

interface CustomersResponse {
  data: Customer[];
  total: number;
  page: number;
  pageSize: number;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n / 100);
}

function formatDate(s: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(s));
}

export default function ClientesPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading } = useQuery<CustomersResponse>({
    queryKey: ['admin-customers', page, search, dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get<any>('/users', Object.fromEntries(
        Object.entries({ page, limit: 25, q: search || undefined }).filter(([,v]) => v !== undefined)
      ));
      // Normalizar campos para la tabla
      const normalized = (res.data || []).map((u: any) => ({
        ...u,
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
        ordersCount: u.ordersCount ?? 0,
        totalSpent: u.totalSpent ?? 0,
      }));
      return { data: normalized, meta: res.meta };
    },
  });

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Nombre',
      render: (row) => (
        <div>
          <div className="font-medium text-neutral-900">{row.name}</div>
          <div className="text-xs text-neutral-500">{row.email}</div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Teléfono',
      render: (row) => (
        <span className="text-sm text-neutral-600">{row.phone ?? '—'}</span>
      ),
    },
    {
      key: 'ordersCount',
      header: 'Pedidos',
      render: (row) => (
        <span className="font-semibold text-neutral-900">{row.ordersCount}</span>
      ),
    },
    {
      key: 'totalSpent',
      header: 'Total gastado',
      render: (row) => (
        <span className="font-semibold text-neutral-900">{formatCurrency(row.totalSpent)}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Registro',
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
          onClick={() => router.push(`/admin/clientes/${row.id}`)}
        >
          Ver
        </Button>
      ),
    },
  ];

  const filterPanel = (
    <div className="flex flex-wrap gap-3">
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
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Clientes</h1>
        <p className="text-sm text-neutral-500 mt-1">Gestiona los clientes registrados</p>
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
        searchPlaceholder="Buscar por nombre, email..."
        getRowId={(row) => row.id}
        filterPanel={filterPanel}
        emptyMessage="No hay clientes"
        onRowClick={(row) => router.push(`/admin/clientes/${row.id}`)}
      />
    </div>
  );
}
