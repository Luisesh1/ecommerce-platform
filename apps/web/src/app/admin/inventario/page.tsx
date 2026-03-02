"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable } from '@/components/admin/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Drawer } from '@/components/ui/Drawer';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/useToast';
import type { Column } from '@/components/ui/Table';

interface InventoryItem {
  id: string;
  sku: string;
  productName: string;
  variantName?: string;
  stock: number;
  minStock: number;
}

interface StockMovement {
  id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN' | 'RESERVED' | 'RELEASED';
  quantity: number;
  reason?: string;
  createdAt: string;
  user?: string;
}

interface InventoryResponse {
  data: InventoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

const MOVEMENT_LABEL: Record<string, string> = {
  IN: 'Entrada',
  OUT: 'Salida',
  ADJUSTMENT: 'Ajuste',
  RETURN: 'Devolución',
  RESERVED: 'Reservado',
  RELEASED: 'Liberado',
};

function formatDate(s: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(s));
}

export default function InventarioPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const { data, isLoading } = useQuery<InventoryResponse>({
    queryKey: ['admin-inventory', page, search],
    queryFn: () =>
      api.get<InventoryResponse>('/inventory', { page, search, pageSize: 50 }),
  });

  const { data: movements = [], isLoading: movementsLoading } = useQuery<StockMovement[]>({
    queryKey: ['admin-inventory-movements', selectedItem?.id],
    queryFn: () => api.get<StockMovement[]>(`/inventory/${selectedItem!.id}/movements`),
    enabled: !!selectedItem && showHistoryDrawer,
  });

  const adjustStock = useMutation({
    mutationFn: () =>
      api.post(`/inventory/${selectedItem!.id}/adjust`, {
        quantity: parseInt(adjustQuantity, 10),
        reason: adjustReason,
      }),
    onSuccess: () => {
      toast({ title: 'Stock ajustado', variant: 'success' });
      setShowAdjustModal(false);
      setAdjustQuantity('');
      setAdjustReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['admin-inventory-movements', selectedItem?.id] });
    },
    onError: () => toast({ title: 'Error al ajustar stock', variant: 'error' }),
  });

  const openHistory = (item: InventoryItem) => {
    setSelectedItem(item);
    setShowHistoryDrawer(true);
  };

  const openAdjust = (item: InventoryItem) => {
    setSelectedItem(item);
    setAdjustQuantity('');
    setAdjustReason('');
    setShowAdjustModal(true);
  };

  const columns: Column<InventoryItem>[] = [
    {
      key: 'sku',
      header: 'SKU',
      render: (row) => (
        <span className="font-mono text-sm font-medium text-neutral-700">{row.sku}</span>
      ),
    },
    {
      key: 'productName',
      header: 'Producto',
      render: (row) => (
        <div>
          <div className="font-medium text-neutral-900">{row.productName}</div>
          {row.variantName && (
            <div className="text-xs text-neutral-500">{row.variantName}</div>
          )}
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Stock actual',
      render: (row) => (
        <span
          className={
            row.stock <= row.minStock
              ? 'font-bold text-error-600'
              : row.stock <= row.minStock * 2
              ? 'font-semibold text-warning-600'
              : 'text-neutral-900'
          }
        >
          {row.stock}
        </span>
      ),
    },
    {
      key: 'minStock',
      header: 'Stock mínimo',
      render: (row) => (
        <span className="text-neutral-600">{row.minStock}</span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        row.stock <= row.minStock ? (
          <Badge variant="error" size="sm">Stock bajo</Badge>
        ) : row.stock === 0 ? (
          <Badge variant="error" size="sm">Sin stock</Badge>
        ) : (
          <Badge variant="success" size="sm">OK</Badge>
        )
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => openHistory(row)}>
            Historial
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openAdjust(row)}>
            Ajustar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Inventario</h1>
        <p className="text-sm text-neutral-500 mt-1">Control de stock por SKU y variante</p>
      </div>

      <DataTable
        data={data?.data ?? []}
        columns={columns}
        isLoading={isLoading}
        totalCount={data?.total ?? 0}
        page={page}
        pageSize={data?.pageSize ?? 50}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Buscar por SKU, producto..."
        getRowId={(row) => row.id}
        emptyMessage="No hay items de inventario"
      />

      {/* History Drawer */}
      <Drawer
        open={showHistoryDrawer}
        onClose={() => setShowHistoryDrawer(false)}
        title={`Historial: ${selectedItem?.sku ?? ''}`}
        footer={
          <Button
            variant="outline"
            fullWidth
            onClick={() => {
              setShowHistoryDrawer(false);
              if (selectedItem) openAdjust(selectedItem);
            }}
          >
            Ajuste manual
          </Button>
        }
      >
        {movementsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
          </div>
        ) : movements.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-8">Sin movimientos registrados</p>
        ) : (
          <div className="space-y-3">
            {movements.map((mov) => (
              <div key={mov.id} className="flex items-start gap-3 p-3 rounded-lg bg-neutral-50">
                <div
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${
                    mov.quantity > 0
                      ? 'bg-success-100 text-success-700'
                      : 'bg-error-100 text-error-700'
                  }`}
                >
                  {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-neutral-900">
                    {MOVEMENT_LABEL[mov.type] ?? mov.type}
                  </div>
                  {mov.reason && (
                    <div className="text-xs text-neutral-500 truncate">{mov.reason}</div>
                  )}
                  <div className="text-xs text-neutral-400 mt-0.5">
                    {formatDate(mov.createdAt)}
                    {mov.user && ` · ${mov.user}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Drawer>

      {/* Adjust Modal */}
      <Modal
        open={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title={`Ajuste de stock: ${selectedItem?.sku ?? ''}`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowAdjustModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => adjustStock.mutate()}
              loading={adjustStock.isPending}
              disabled={!adjustQuantity || !adjustReason}
            >
              Aplicar ajuste
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {selectedItem && (
            <p className="text-sm text-neutral-600">
              Stock actual: <strong>{selectedItem.stock}</strong>
            </p>
          )}
          <Input
            label="Cantidad (+/-)"
            type="number"
            value={adjustQuantity}
            onChange={(e) => setAdjustQuantity(e.target.value)}
            placeholder="Ej: +10 o -5"
            hint="Usa valores positivos para agregar, negativos para restar"
            required
          />
          <Input
            label="Razón del ajuste"
            value={adjustReason}
            onChange={(e) => setAdjustReason(e.target.value)}
            placeholder="Ej: Conteo físico, producto dañado..."
            required
          />
        </div>
      </Modal>
    </div>
  );
}
