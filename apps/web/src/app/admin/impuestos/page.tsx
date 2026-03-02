"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/useToast';
import { api } from '@/lib/api';

interface TaxRate {
  id: string;
  region: string;
  rate: number;
  method: 'INCLUSIVE' | 'EXCLUSIVE';
  active: boolean;
}

const methodOptions = [
  { value: 'INCLUSIVE', label: 'Incluido (INCLUSIVE)' },
  { value: 'EXCLUSIVE', label: 'Adicional (EXCLUSIVE)' },
];

const initialForm = { region: '', rate: '', method: 'EXCLUSIVE' as 'INCLUSIVE' | 'EXCLUSIVE' };

export default function ImpuestosPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<TaxRate | null>(null);
  const [form, setForm] = useState(initialForm);

  const { data: taxes = [], isLoading } = useQuery<TaxRate[]>({
    queryKey: ['admin-taxes'],
    queryFn: () => api.get<TaxRate[]>('/admin/tax'),
  });

  const openNew = () => {
    setEditing(null);
    setForm(initialForm);
    setModal(true);
  };

  const openEdit = (tax: TaxRate) => {
    setEditing(tax);
    setForm({ region: tax.region, rate: String(tax.rate), method: tax.method });
    setModal(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = { region: form.region, rate: parseFloat(form.rate), method: form.method };
      return editing
        ? api.patch(`/admin/tax/${editing.id}`, body)
        : api.post('/admin/tax', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-taxes'] });
      success(editing ? 'Tasa actualizada' : 'Tasa creada');
      setModal(false);
    },
    onError: () => toastError('Error al guardar'),
  });

  const toggleMutation = useMutation({
    mutationFn: (tax: TaxRate) =>
      api.patch(`/admin/tax/${tax.id}`, { active: !tax.active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-taxes'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/tax/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-taxes'] });
      success('Tasa eliminada');
    },
    onError: () => toastError('Error al eliminar'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Impuestos</h1>
          <p className="text-sm text-neutral-500 mt-1">Gestiona las tasas impositivas por región</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openNew}>
          Nueva Tasa
        </Button>
      </div>

      <div className="rounded-lg border border-neutral-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
          </div>
        ) : taxes.length === 0 ? (
          <EmptyState
            title="Sin tasas impositivas"
            description="Crea tu primera tasa de impuesto"
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-4 py-3 text-left font-medium text-neutral-600">Región</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600">Tasa (%)</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600">Método</th>
                <th className="px-4 py-3 text-center font-medium text-neutral-600">Activo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {taxes.map((tax) => (
                <tr key={tax.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-900">{tax.region}</td>
                  <td className="px-4 py-3 text-neutral-700">{tax.rate}%</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={tax.method === 'INCLUSIVE' ? 'info' : 'warning'}
                      size="sm"
                    >
                      {tax.method}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleMutation.mutate(tax)}>
                      {tax.active ? (
                        <ToggleRight className="h-5 w-5 text-success-500 mx-auto" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-neutral-300 mx-auto" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => openEdit(tax)}
                        className="text-neutral-400 hover:text-brand-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(tax.id)}
                        className="text-neutral-400 hover:text-error-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Editar Tasa' : 'Nueva Tasa Impositiva'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
              {editing ? 'Guardar cambios' : 'Crear Tasa'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Región"
            placeholder="Ej: Argentina, Buenos Aires, MX"
            value={form.region}
            onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))}
          />
          <Input
            label="Tasa (%)"
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder="21.00"
            value={form.rate}
            onChange={(e) => setForm((p) => ({ ...p, rate: e.target.value }))}
            suffix={<span className="text-neutral-500">%</span>}
          />
          <Select
            label="Método"
            options={methodOptions}
            value={form.method}
            onChange={(v) => setForm((p) => ({ ...p, method: v as 'INCLUSIVE' | 'EXCLUSIVE' }))}
          />
        </div>
      </Modal>
    </div>
  );
}
