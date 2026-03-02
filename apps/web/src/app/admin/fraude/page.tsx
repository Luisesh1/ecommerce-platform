"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ToggleLeft, ToggleRight, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/useToast';
import { api } from '@/lib/api';

interface FraudRule {
  id: string;
  name: string;
  condition: string;
  action: string;
  active: boolean;
}

interface BlacklistEntry {
  id: string;
  type: 'IP' | 'EMAIL';
  value: string;
  reason: string;
  addedAt: string;
}

interface FraudEvent {
  id: string;
  event: string;
  userId: string | null;
  ip: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
  createdAt: string;
}

const riskVariant: Record<FraudEvent['risk'], 'success' | 'warning' | 'error' | 'neutral'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'error',
  BLOCKED: 'neutral',
};

const riskStyles: Record<FraudEvent['risk'], string> = {
  LOW: 'text-success-700 bg-success-50',
  MEDIUM: 'text-warning-700 bg-warning-50',
  HIGH: 'text-error-700 bg-error-50',
  BLOCKED: 'text-neutral-700 bg-neutral-100',
};

const blacklistTypeOptions = [
  { value: 'IP', label: 'Dirección IP' },
  { value: 'EMAIL', label: 'Email' },
];

export default function FraudePage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const [blacklistModal, setBlacklistModal] = useState(false);
  const [blacklistForm, setBlacklistForm] = useState({
    type: 'IP' as 'IP' | 'EMAIL',
    value: '',
    reason: '',
  });

  // Rules
  const { data: rules = [], isLoading: rulesLoading } = useQuery<FraudRule[]>({
    queryKey: ['admin-fraud-rules'],
    queryFn: () => api.get<FraudRule[]>('/admin/fraud/rules'),
  });

  // Blacklist
  const { data: blacklist = [], isLoading: blacklistLoading } = useQuery<BlacklistEntry[]>({
    queryKey: ['admin-fraud-blacklist'],
    queryFn: () => api.get<BlacklistEntry[]>('/admin/fraud/blacklist'),
  });

  // Events feed
  const { data: events = [], isLoading: eventsLoading } = useQuery<FraudEvent[]>({
    queryKey: ['admin-fraud-events'],
    queryFn: () => api.get<FraudEvent[]>('/admin/fraud/events', { limit: 20 }),
    refetchInterval: 30_000,
  });

  const toggleRule = useMutation({
    mutationFn: (rule: FraudRule) =>
      api.patch(`/admin/fraud/rules/${rule.id}`, { active: !rule.active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-fraud-rules'] }),
  });

  const addBlacklist = useMutation({
    mutationFn: () => api.post('/admin/fraud/blacklist', blacklistForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-fraud-blacklist'] });
      success('Entrada añadida a la lista negra');
      setBlacklistModal(false);
      setBlacklistForm({ type: 'IP', value: '', reason: '' });
    },
    onError: () => toastError('Error al añadir entrada'),
  });

  const removeBlacklist = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/fraud/blacklist/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-fraud-blacklist'] });
      success('Entrada eliminada');
    },
    onError: () => toastError('Error al eliminar'),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Detección de Fraude</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Gestiona reglas, listas negras y monitorea eventos sospechosos
        </p>
      </div>

      {/* Section 1: Rules */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-neutral-800">Reglas Activas</h2>
        <div className="rounded-lg border border-neutral-200 overflow-hidden">
          {rulesLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
            </div>
          ) : rules.length === 0 ? (
            <EmptyState
              icon={ShieldAlert}
              title="Sin reglas"
              description="No hay reglas de fraude configuradas"
              className="py-10"
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Condición</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Acción</th>
                  <th className="px-4 py-3 text-center font-medium text-neutral-600">Activo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-900">{rule.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-600 max-w-[200px] truncate">
                      {rule.condition}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          rule.action === 'BLOCK'
                            ? 'error'
                            : rule.action === 'FLAG'
                            ? 'warning'
                            : 'info'
                        }
                        size="sm"
                      >
                        {rule.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleRule.mutate(rule)}>
                        {rule.active ? (
                          <ToggleRight className="h-5 w-5 text-success-500 mx-auto" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-neutral-300 mx-auto" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Section 2: Blacklist */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-800">Lista Negra</h2>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setBlacklistModal(true)}
          >
            Añadir
          </Button>
        </div>
        <div className="rounded-lg border border-neutral-200 overflow-hidden">
          {blacklistLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
            </div>
          ) : blacklist.length === 0 ? (
            <EmptyState title="Lista negra vacía" className="py-10" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Valor</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Razón</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Fecha</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {blacklist.map((entry) => (
                  <tr key={entry.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Badge variant={entry.type === 'IP' ? 'info' : 'warning'} size="sm">
                        {entry.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-neutral-800">{entry.value}</td>
                    <td className="px-4 py-3 text-neutral-600 text-xs">{entry.reason}</td>
                    <td className="px-4 py-3 text-neutral-400 text-xs">
                      {new Date(entry.addedAt).toLocaleDateString('es')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => removeBlacklist.mutate(entry.id)}
                        className="text-neutral-400 hover:text-error-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Section 3: Events feed */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-neutral-800">Eventos Recientes</h2>
        <div className="rounded-lg border border-neutral-200 overflow-hidden">
          {eventsLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
            </div>
          ) : events.length === 0 ? (
            <EmptyState title="Sin eventos" className="py-10" />
          ) : (
            <div className="divide-y divide-neutral-100">
              {events.map((evt) => (
                <div key={evt.id} className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-50">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${riskStyles[evt.risk]}`}
                  >
                    {evt.risk}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{evt.event}</p>
                    <p className="text-xs text-neutral-400">
                      IP: {evt.ip}
                      {evt.userId && ` · Usuario: ${evt.userId}`}
                    </p>
                  </div>
                  <span className="text-xs text-neutral-400 whitespace-nowrap">
                    {new Date(evt.createdAt).toLocaleString('es')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Blacklist modal */}
      <Modal
        open={blacklistModal}
        onClose={() => setBlacklistModal(false)}
        title="Añadir a Lista Negra"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setBlacklistModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => addBlacklist.mutate()} loading={addBlacklist.isPending}>
              Añadir
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            label="Tipo"
            options={blacklistTypeOptions}
            value={blacklistForm.type}
            onChange={(v) =>
              setBlacklistForm((p) => ({ ...p, type: v as 'IP' | 'EMAIL' }))
            }
          />
          <Input
            label={blacklistForm.type === 'IP' ? 'Dirección IP' : 'Email'}
            placeholder={
              blacklistForm.type === 'IP' ? '192.168.1.100' : 'spam@example.com'
            }
            value={blacklistForm.value}
            onChange={(e) => setBlacklistForm((p) => ({ ...p, value: e.target.value }))}
          />
          <Input
            label="Razón"
            placeholder="Ej: Múltiples intentos fallidos de pago"
            value={blacklistForm.reason}
            onChange={(e) => setBlacklistForm((p) => ({ ...p, reason: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
