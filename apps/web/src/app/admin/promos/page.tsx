"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, Tag } from 'lucide-react';
import { DataTable } from '@/components/admin/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Column } from '@/components/ui/Table';
import { api } from '@/lib/api';

interface Promo {
  id: string;
  code: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'BUY_X_GET_Y';
  value: number;
  minOrder: number | null;
  usageCount: number;
  maxUses: number | null;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'DEPLETED';
  startsAt: string | null;
  expiresAt: string | null;
}

interface PromosResponse {
  data: Promo[];
  total: number;
}

const statusVariant: Record<Promo['status'], 'success' | 'neutral' | 'error' | 'warning'> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  EXPIRED: 'error',
  DEPLETED: 'warning',
};

const statusLabel: Record<Promo['status'], string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  EXPIRED: 'Expirado',
  DEPLETED: 'Agotado',
};

const typeLabel: Record<Promo['type'], string> = {
  PERCENTAGE: '%',
  FIXED_AMOUNT: '$',
  FREE_SHIPPING: 'Envío gratis',
  BUY_X_GET_Y: 'X+Y',
};

const typeVariant: Record<Promo['type'], 'info' | 'neutral' | 'success' | 'warning'> = {
  PERCENTAGE: 'info',
  FIXED_AMOUNT: 'neutral',
  FREE_SHIPPING: 'success',
  BUY_X_GET_Y: 'warning',
};

export default function PromosPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<PromosResponse>({
    queryKey: ['admin-promos', page, search],
    queryFn: () =>
      api.get<PromosResponse>('/promos', { page, search, pageSize: 25 }),
  });

  const promos = data?.data ?? [];
  const total = data?.total ?? 0;

  const columns: Column<Promo>[] = [
    {
      key: 'code',
      header: 'Código',
      render: (row) => (
        <span className="font-mono font-semibold text-neutral-900">{row.code}</span>
      ),
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (row) => (
        <Badge variant={typeVariant[row.type]} size="sm">
          {typeLabel[row.type]}
        </Badge>
      ),
    },
    {
      key: 'value',
      header: 'Valor',
      render: (row) => {
        if (row.type === 'FREE_SHIPPING') return <span className="text-neutral-500">—</span>;
        if (row.type === 'PERCENTAGE') return <span>{row.value}%</span>;
        return <span>${row.value.toFixed(2)}</span>;
      },
    },
    {
      key: 'minOrder',
      header: 'Min. orden',
      render: (row) =>
        row.minOrder != null ? (
          <span>${row.minOrder.toFixed(2)}</span>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      key: 'usage',
      header: 'Usos / Máx.',
      render: (row) => (
        <span>
          {row.usageCount}
          {row.maxUses != null ? ` / ${row.maxUses}` : ''}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <Badge variant={statusVariant[row.status]} size="sm">
          {statusLabel[row.status]}
        </Badge>
      ),
    },
    {
      key: 'startsAt',
      header: 'Inicio',
      render: (row) =>
        row.startsAt ? (
          <span className="text-sm">{new Date(row.startsAt).toLocaleDateString('es')}</span>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      key: 'expiresAt',
      header: 'Fin',
      render: (row) =>
        row.expiresAt ? (
          <span className="text-sm">{new Date(row.expiresAt).toLocaleDateString('es')}</span>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/admin/promos/${row.id}`)}
        >
          Editar
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Promociones</h1>
          <p className="text-sm text-neutral-500 mt-1">Gestiona cupones y descuentos</p>
        </div>
        <Button
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => router.push('/admin/promos/nuevo')}
        >
          Nueva Promo
        </Button>
      </div>

      <DataTable
        data={promos}
        columns={columns}
        isLoading={isLoading}
        totalCount={total}
        page={page}
        pageSize={25}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Buscar por código..."
        getRowId={(row) => row.id}
        emptyMessage="No hay promociones"
        actions={
          <div className="flex items-center gap-1 text-neutral-400">
            <Tag className="h-4 w-4" />
            <span className="text-sm">{total} promos</span>
          </div>
        }
      />
    </div>
  );
}
