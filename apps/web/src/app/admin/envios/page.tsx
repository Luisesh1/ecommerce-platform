"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, MapPin, Truck, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/useToast';
import { api } from '@/lib/api';

interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
}

interface ShippingMethod {
  id: string;
  zoneId: string;
  name: string;
  type: 'FLAT_RATE' | 'FREE' | 'CALCULATED' | 'LOCAL_PICKUP';
  price: number | null;
  condition: string | null;
  active: boolean;
}

const methodTypeLabel: Record<ShippingMethod['type'], string> = {
  FLAT_RATE: 'Tarifa fija',
  FREE: 'Gratis',
  CALCULATED: 'Calculado',
  LOCAL_PICKUP: 'Recogida local',
};

const methodTypeVariant: Record<
  ShippingMethod['type'],
  'info' | 'success' | 'warning' | 'neutral'
> = {
  FLAT_RATE: 'info',
  FREE: 'success',
  CALCULATED: 'warning',
  LOCAL_PICKUP: 'neutral',
};

const methodTypeOptions = [
  { value: 'FLAT_RATE', label: 'Tarifa fija' },
  { value: 'FREE', label: 'Gratis' },
  { value: 'CALCULATED', label: 'Calculado' },
  { value: 'LOCAL_PICKUP', label: 'Recogida local' },
];

export default function EnviosPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const [selectedZone, setSelectedZone] = useState<ShippingZone | null>(null);
  const [zoneModal, setZoneModal] = useState(false);
  const [methodModal, setMethodModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState<ShippingMethod | null>(null);
  const [zoneName, setZoneName] = useState('');
  const [zoneCountries, setZoneCountries] = useState('');
  const [methodForm, setMethodForm] = useState({
    name: '',
    type: 'FLAT_RATE' as ShippingMethod['type'],
    price: '',
    condition: '',
  });

  const { data: zones = [], isLoading: zonesLoading } = useQuery<ShippingZone[]>({
    queryKey: ['admin-shipping-zones'],
    queryFn: () => api.get<ShippingZone[]>('/admin/shipping/zones'),
  });

  const { data: methods = [], isLoading: methodsLoading } = useQuery<ShippingMethod[]>({
    queryKey: ['admin-shipping-methods', selectedZone?.id],
    queryFn: () =>
      api.get<ShippingMethod[]>(`/admin/shipping/zones/${selectedZone!.id}/methods`),
    enabled: !!selectedZone,
  });

  const createZone = useMutation({
    mutationFn: () =>
      api.post('/admin/shipping/zones', {
        name: zoneName,
        countries: zoneCountries.split(',').map((c) => c.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shipping-zones'] });
      success('Zona creada');
      setZoneModal(false);
      setZoneName('');
      setZoneCountries('');
    },
    onError: () => toastError('Error al crear zona'),
  });

  const deleteZone = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/shipping/zones/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shipping-zones'] });
      if (selectedZone) setSelectedZone(null);
      success('Zona eliminada');
    },
    onError: () => toastError('Error al eliminar zona'),
  });

  const saveMethod = useMutation({
    mutationFn: () => {
      const body = {
        name: methodForm.name,
        type: methodForm.type,
        price: methodForm.price ? parseFloat(methodForm.price) : null,
        condition: methodForm.condition || null,
      };
      if (editingMethod) {
        return api.patch(
          `/admin/shipping/zones/${selectedZone!.id}/methods/${editingMethod.id}`,
          body
        );
      }
      return api.post(`/admin/shipping/zones/${selectedZone!.id}/methods`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin-shipping-methods', selectedZone?.id],
      });
      success(editingMethod ? 'Método actualizado' : 'Método creado');
      setMethodModal(false);
      setEditingMethod(null);
      setMethodForm({ name: '', type: 'FLAT_RATE', price: '', condition: '' });
    },
    onError: () => toastError('Error al guardar método'),
  });

  const toggleMethod = useMutation({
    mutationFn: (m: ShippingMethod) =>
      api.patch(
        `/admin/shipping/zones/${selectedZone!.id}/methods/${m.id}`,
        { active: !m.active }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin-shipping-methods', selectedZone?.id],
      });
    },
  });

  const deleteMethod = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/admin/shipping/zones/${selectedZone!.id}/methods/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin-shipping-methods', selectedZone?.id],
      });
      success('Método eliminado');
    },
  });

  const openNewMethod = () => {
    setEditingMethod(null);
    setMethodForm({ name: '', type: 'FLAT_RATE', price: '', condition: '' });
    setMethodModal(true);
  };

  const openEditMethod = (m: ShippingMethod) => {
    setEditingMethod(m);
    setMethodForm({
      name: m.name,
      type: m.type,
      price: m.price?.toString() ?? '',
      condition: m.condition ?? '',
    });
    setMethodModal(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Envíos</h1>
        <p className="text-sm text-neutral-500 mt-1">Gestiona zonas y métodos de envío</p>
      </div>

      <div className="grid grid-cols-12 gap-6 min-h-[500px]">
        {/* Left: Zones */}
        <div className="col-span-4 border border-neutral-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-200">
            <h2 className="font-semibold text-sm text-neutral-700">Zonas de envío</h2>
            <Button size="sm" variant="outline" onClick={() => setZoneModal(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Nueva
            </Button>
          </div>

          {zonesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
            </div>
          ) : zones.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="Sin zonas"
              description="Crea tu primera zona de envío"
              className="py-10"
            />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {zones.map((zone) => (
                <li
                  key={zone.id}
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-neutral-50 transition-colors ${
                    selectedZone?.id === zone.id ? 'bg-brand-50 border-l-4 border-brand-500' : ''
                  }`}
                  onClick={() => setSelectedZone(zone)}
                >
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{zone.name}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {zone.countries.slice(0, 3).join(', ')}
                      {zone.countries.length > 3 && ` +${zone.countries.length - 3}`}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteZone.mutate(zone.id);
                    }}
                    className="text-neutral-300 hover:text-error-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: Methods */}
        <div className="col-span-8 border border-neutral-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-200">
            <h2 className="font-semibold text-sm text-neutral-700">
              {selectedZone ? `Métodos — ${selectedZone.name}` : 'Métodos de envío'}
            </h2>
            {selectedZone && (
              <Button size="sm" variant="outline" onClick={openNewMethod}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Nuevo Método
              </Button>
            )}
          </div>

          {!selectedZone ? (
            <EmptyState
              icon={Truck}
              title="Selecciona una zona"
              description="Haz clic en una zona para ver sus métodos de envío"
              className="py-16"
            />
          ) : methodsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
            </div>
          ) : methods.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="Sin métodos"
              description="Añade un método de envío a esta zona"
              className="py-12"
            />
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50">
                    <th className="px-4 py-2.5 text-left font-medium text-neutral-600">Nombre</th>
                    <th className="px-4 py-2.5 text-left font-medium text-neutral-600">Tipo</th>
                    <th className="px-4 py-2.5 text-left font-medium text-neutral-600">Precio</th>
                    <th className="px-4 py-2.5 text-left font-medium text-neutral-600">Condición</th>
                    <th className="px-4 py-2.5 text-center font-medium text-neutral-600">Activo</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {methods.map((m) => (
                    <tr key={m.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 font-medium text-neutral-900">{m.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant={methodTypeVariant[m.type]} size="sm">
                          {methodTypeLabel[m.type]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {m.price != null ? `$${m.price.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-neutral-500 text-xs">
                        {m.condition ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => toggleMethod.mutate(m)}>
                          {m.active ? (
                            <ToggleRight className="h-5 w-5 text-success-500" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-neutral-300" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => openEditMethod(m)}
                            className="text-neutral-400 hover:text-brand-600"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteMethod.mutate(m.id)}
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
            </div>
          )}
        </div>
      </div>

      {/* Zone Modal */}
      <Modal
        open={zoneModal}
        onClose={() => setZoneModal(false)}
        title="Nueva Zona de Envío"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setZoneModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createZone.mutate()}
              loading={createZone.isPending}
            >
              Crear Zona
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nombre de la zona"
            placeholder="Ej: América del Sur"
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
          />
          <Input
            label="Países / Regiones"
            placeholder="AR, CL, UY, PY (separados por coma)"
            value={zoneCountries}
            onChange={(e) => setZoneCountries(e.target.value)}
            hint="Usa códigos ISO de 2 letras separados por comas"
          />
        </div>
      </Modal>

      {/* Method Modal */}
      <Modal
        open={methodModal}
        onClose={() => setMethodModal(false)}
        title={editingMethod ? 'Editar Método' : 'Nuevo Método de Envío'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setMethodModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveMethod.mutate()} loading={saveMethod.isPending}>
              {editingMethod ? 'Guardar cambios' : 'Crear Método'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nombre"
            placeholder="Ej: Envío estándar"
            value={methodForm.name}
            onChange={(e) => setMethodForm((p) => ({ ...p, name: e.target.value }))}
          />
          <Select
            label="Tipo"
            options={methodTypeOptions}
            value={methodForm.type}
            onChange={(v) => setMethodForm((p) => ({ ...p, type: v as ShippingMethod['type'] }))}
          />
          {methodForm.type === 'FLAT_RATE' && (
            <Input
              label="Precio ($)"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={methodForm.price}
              onChange={(e) => setMethodForm((p) => ({ ...p, price: e.target.value }))}
            />
          )}
          <Input
            label="Condición (opcional)"
            placeholder="Ej: Gratis sobre $50"
            value={methodForm.condition}
            onChange={(e) => setMethodForm((p) => ({ ...p, condition: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
