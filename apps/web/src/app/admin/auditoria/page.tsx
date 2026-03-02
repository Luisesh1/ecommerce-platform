"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { DataTable } from '@/components/admin/DataTable';
import { DiffViewer } from '@/components/admin/DiffViewer';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Column } from '@/components/ui/Table';
import { api } from '@/lib/api';

interface AuditLog {
  id: string;
  createdAt: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

interface AuditResponse {
  data: AuditLog[];
  total: number;
}

const actionVariant: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'error',
  PATCH: 'warning',
  LOGIN: 'neutral',
};

const entityOptions = [
  { value: '', label: 'Todas las entidades' },
  { value: 'Product', label: 'Producto' },
  { value: 'Order', label: 'Pedido' },
  { value: 'User', label: 'Usuario' },
  { value: 'Category', label: 'Categoría' },
  { value: 'Promo', label: 'Promo' },
  { value: 'Setting', label: 'Configuración' },
];

export default function AuditoriaPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<AuditResponse>({
    queryKey: ['admin-audit', page, search, entity, from, to],
    queryFn: () =>
      api.get<AuditResponse>('/admin/audit', {
        page,
        pageSize: 25,
        ...(search && { userId: search }),
        ...(entity && { entity }),
        ...(from && { from }),
        ...(to && { to }),
      }),
  });

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const columns: Column<AuditLog>[] = [
    {
      key: 'createdAt',
      header: 'Fecha',
      render: (row) => (
        <span className="text-xs text-neutral-500 whitespace-nowrap">
          {new Date(row.createdAt).toLocaleString('es')}
        </span>
      ),
    },
    {
      key: 'user',
      header: 'Usuario',
      render: (row) => (
        <span className="text-sm font-medium text-neutral-900">{row.userName}</span>
      ),
    },
    {
      key: 'action',
      header: 'Acción',
      render: (row) => (
        <Badge variant={actionVariant[row.action] ?? 'neutral'} size="sm">
          {row.action}
        </Badge>
      ),
    },
    {
      key: 'entity',
      header: 'Entidad',
      render: (row) => (
        <span className="text-sm text-neutral-700">{row.entity}</span>
      ),
    },
    {
      key: 'entityId',
      header: 'ID Entidad',
      render: (row) => (
        <span className="font-mono text-xs text-neutral-500">{row.entityId}</span>
      ),
    },
    {
      key: 'diff',
      header: '',
      render: (row) => {
        const hasDiff = row.before != null || row.after != null;
        if (!hasDiff) return null;
        const isExpanded = expandedIds.has(row.id);
        return (
          <button
            onClick={() => toggleExpand(row.id)}
            className="text-neutral-400 hover:text-brand-600 transition-colors"
            aria-label={isExpanded ? 'Colapsar' : 'Ver cambios'}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        );
      },
    },
  ];

  const filterPanel = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Input
        label="Usuario"
        placeholder="ID o nombre"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        containerClassName="mb-0"
      />
      <Select
        label="Entidad"
        options={entityOptions}
        value={entity}
        onChange={(v) => { setEntity(v); setPage(1); }}
      />
      <Input
        label="Desde"
        type="date"
        value={from}
        onChange={(e) => { setFrom(e.target.value); setPage(1); }}
        containerClassName="mb-0"
      />
      <Input
        label="Hasta"
        type="date"
        value={to}
        onChange={(e) => { setTo(e.target.value); setPage(1); }}
        containerClassName="mb-0"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Auditoría</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Registro de todas las acciones realizadas en el sistema
        </p>
      </div>

      <DataTable
        data={logs}
        columns={columns}
        isLoading={isLoading}
        totalCount={total}
        page={page}
        pageSize={25}
        onPageChange={setPage}
        filterPanel={filterPanel}
        emptyMessage="No hay registros de auditoría"
        getRowId={(row) => row.id}
      />

      {/* Expandable diff rows */}
      {logs
        .filter((log) => expandedIds.has(log.id) && (log.before != null || log.after != null))
        .map((log) => (
          <div
            key={`diff-${log.id}`}
            className="rounded-lg border border-brand-200 bg-brand-50 p-4"
          >
            <p className="text-xs font-semibold text-brand-700 mb-3">
              Cambios — {log.action} {log.entity} #{log.entityId}
            </p>
            <DiffViewer
              before={log.before ?? {}}
              after={log.after ?? {}}
            />
          </div>
        ))}
    </div>
  );
}
