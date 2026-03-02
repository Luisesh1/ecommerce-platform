"use client";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { DataTable } from '@/components/admin/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/api';
import type { Column } from '@/components/ui/Table';

// ---- Types ----
interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: number;
  stock: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  category: string;
  image?: string;
}

interface ProductsResponse {
  data: Product[];
  total: number;
  page: number;
  limit: number;
}

// ---- Constants ----
const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'ARCHIVED', label: 'Archivado' },
];

type BadgeVariant = 'success' | 'warning' | 'neutral';

const STATUS_BADGE: Record<string, BadgeVariant> = {
  ACTIVE: 'success',
  DRAFT: 'warning',
  ARCHIVED: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activo',
  DRAFT: 'Borrador',
  ARCHIVED: 'Archivado',
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
}

// ---- Component ----
export default function ProductosAdminPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading } = useQuery<ProductsResponse>({
    queryKey: ['admin-products', search, category, status, page],
    queryFn: () =>
      api.get<any>('/products', Object.fromEntries(
        Object.entries({
          q: search || undefined,
          categoryId: category || undefined,
          status: status || undefined,
          page,
          limit: 25,
        }).filter(([, v]) => v !== undefined)
      )).then((res: any) => ({
        ...res,
        data: (res.data || []).map((p: any) => {
          const v = p.variants?.[0];
          return {
            id: p.id,
            name: p.title || p.name || 'Sin nombre',
            slug: p.slug,
            status: p.status,
            price: v?.price ? v.price / 100 : 0,
            stock: p.variants?.reduce((acc: number, vv: any) => acc + (vv.inventoryLevel?.quantity ?? 0), 0) ?? 0,
            category: typeof p.category === 'object' ? p.category?.name : (p.category || '—'),
            image: p.images?.[0]?.url || null,
            vendor: p.vendor || '',
            createdAt: p.createdAt,
          };
        }),
      })),
  });

  const { data: categoriesData } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['admin-categories-simple'],
    queryFn: () => api.get('/categories'),
  });

  const categoryOptions = [
    { value: '', label: 'Todas las categorías' },
    ...(categoriesData ?? []).map((c) => ({ value: c.id, label: c.name })),
  ];

  const bulkActivate = useMutation({
    mutationFn: () =>
      Promise.all(selectedIds.map((id) => api.patch(`/products/${id}`, { status: 'ACTIVE' }))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setSelectedIds([]);
    },
  });

  const bulkDeactivate = useMutation({
    mutationFn: () =>
      Promise.all(selectedIds.map((id) => api.patch(`/products/${id}`, { status: 'DRAFT' }))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setSelectedIds([]);
    },
  });

  const bulkDelete = useMutation({
    mutationFn: () =>
      Promise.all(selectedIds.map((id) => api.delete(`/products/${id}`))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setSelectedIds([]);
      setConfirmDelete(false);
    },
  });

  const handleExport = async () => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/admin/export/products`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}`,
        },
      }
    );
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'productos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<Product>[] = [
    {
      key: 'image',
      title: 'Imagen',
      render: (row) =>
        row.image ? (
          <img src={row.image} alt={row.name} className="h-10 w-10 rounded object-cover" />
        ) : (
          <div className="h-10 w-10 rounded bg-neutral-100 flex items-center justify-center text-neutral-300">
            <span className="text-xs">N/A</span>
          </div>
        ),
    },
    {
      key: 'name',
      title: 'Nombre',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-neutral-900">{row.name}</p>
          <p className="text-xs text-neutral-400">{row.slug}</p>
        </div>
      ),
    },
    { key: 'sku', title: 'SKU', render: (row) => <span className="font-mono text-xs">{row.sku}</span> },
    {
      key: 'price',
      title: 'Precio',
      sortable: true,
      render: (row) => <span className="font-medium">{formatCurrency(row.price)}</span>,
    },
    {
      key: 'stock',
      title: 'Stock',
      sortable: true,
      render: (row) => (
        <span className={row.stock === 0 ? 'text-error-600 font-semibold' : row.stock < 5 ? 'text-warning-600 font-semibold' : 'text-neutral-700'}>
          {row.stock}
        </span>
      ),
    },
    {
      key: 'status',
      title: 'Estado',
      render: (row) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'neutral'} size="sm">
          {STATUS_LABEL[row.status] ?? row.status}
        </Badge>
      ),
    },
    { key: 'category', title: 'Categoría', render: (row) => <span className="text-neutral-600">{row.category}</span> },
    {
      key: 'actions',
      title: '',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/admin/productos/${row.id}`)}
        >
          Editar
        </Button>
      ),
    },
  ];

  const bulkActions = selectedIds.length > 0 ? (
    <div className="flex items-center gap-2">
      <span className="text-sm text-neutral-500">{selectedIds.length} seleccionados</span>
      <Button
        variant="outline"
        size="sm"
        leftIcon={<Eye className="h-4 w-4" />}
        onClick={() => bulkActivate.mutate()}
        loading={bulkActivate.isPending}
      >
        Activar
      </Button>
      <Button
        variant="outline"
        size="sm"
        leftIcon={<EyeOff className="h-4 w-4" />}
        onClick={() => bulkDeactivate.mutate()}
        loading={bulkDeactivate.isPending}
      >
        Desactivar
      </Button>
      <Button
        variant="danger"
        size="sm"
        leftIcon={<Trash2 className="h-4 w-4" />}
        onClick={() => setConfirmDelete(true)}
      >
        Eliminar
      </Button>
    </div>
  ) : null;

  const filterPanel = (
    <div className="flex flex-wrap gap-3">
      <Select
        options={categoryOptions}
        value={category}
        onChange={setCategory}
        placeholder="Categoría"
        className="w-48"
      />
      <Select
        options={STATUS_OPTIONS}
        value={status}
        onChange={setStatus}
        placeholder="Estado"
        className="w-44"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Productos</h1>
          <p className="text-sm text-neutral-500 mt-1">Gestiona el catálogo de productos</p>
        </div>
        <Button
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => router.push('/admin/productos/nuevo')}
        >
          Nuevo Producto
        </Button>
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
        searchPlaceholder="Buscar por nombre, SKU..."
        selectable
        selectedIds={selectedIds}
        onSelectChange={setSelectedIds}
        getRowId={(row) => row.id}
        bulkActions={bulkActions}
        onExport={handleExport}
        filterPanel={filterPanel}
        emptyMessage="No hay productos"
      />

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Eliminar productos"
        description={`¿Estás seguro de que deseas eliminar ${selectedIds.length} producto(s)? Esta acción no se puede deshacer.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => bulkDelete.mutate()}
              loading={bulkDelete.isPending}
            >
              Eliminar
            </Button>
          </div>
        }
      >
        <p className="text-sm text-neutral-600">
          Se eliminarán permanentemente {selectedIds.length} producto(s) seleccionados.
        </p>
      </Modal>
    </div>
  );
}
