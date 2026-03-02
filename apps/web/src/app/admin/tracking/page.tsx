"use client";

import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Save, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/useToast';
import { api } from '@/lib/api';

interface TrackingSettings {
  ga4MeasurementId: string;
  ga4ApiSecret: string;
  ga4Enabled: boolean;
  metaPixelId: string;
  metaAccessToken: string;
  metaEnabled: boolean;
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? 'bg-brand-600' : 'bg-neutral-300'
        }`}
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-1'
          }`}
        />
      </div>
      <span className="text-sm font-medium text-neutral-700">{label}</span>
    </label>
  );
}

const defaultSettings: TrackingSettings = {
  ga4MeasurementId: '',
  ga4ApiSecret: '',
  ga4Enabled: false,
  metaPixelId: '',
  metaAccessToken: '',
  metaEnabled: false,
};

export default function TrackingPage() {
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState<TrackingSettings>(defaultSettings);
  const [showSecrets, setShowSecrets] = useState({ ga4: false, meta: false });
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const { data, isLoading } = useQuery<TrackingSettings>({
    queryKey: ['admin-tracking'],
    queryFn: () => api.get<TrackingSettings>('/admin/settings/tracking'),
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.patch('/admin/settings/tracking', form),
    onSuccess: () => {
      setSavedStatus('saved');
      success('Configuración de tracking guardada');
      setTimeout(() => setSavedStatus('idle'), 3000);
    },
    onError: () => {
      setSavedStatus('error');
      toastError('Error al guardar tracking');
    },
  });

  const set = (key: keyof TrackingSettings, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Analytics & Tracking</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Configura integraciones de analítica y píxeles de conversión
        </p>
      </div>

      {/* GA4 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Google Analytics 4</h2>
            <p className="text-sm text-neutral-500">Mide el tráfico y conversiones con GA4</p>
          </div>
          <Toggle
            checked={form.ga4Enabled}
            onChange={(v) => set('ga4Enabled', v)}
            label={form.ga4Enabled ? 'Activo' : 'Inactivo'}
          />
        </div>

        <div className="space-y-4">
          <Input
            label="Measurement ID"
            placeholder="G-XXXXXXXXXX"
            value={form.ga4MeasurementId}
            onChange={(e) => set('ga4MeasurementId', e.target.value)}
            hint="Encuéntralo en GA4 > Administrar > Flujos de datos"
          />
          <Input
            label="API Secret"
            type={showSecrets.ga4 ? 'text' : 'password'}
            placeholder="••••••••••••••••"
            value={form.ga4ApiSecret}
            onChange={(e) => set('ga4ApiSecret', e.target.value)}
            suffix={
              <button
                type="button"
                onClick={() => setShowSecrets((s) => ({ ...s, ga4: !s.ga4 }))}
                className="text-neutral-400 hover:text-neutral-600"
              >
                {showSecrets.ga4 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
        </div>
      </Card>

      {/* Meta Pixel */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Meta Pixel (Facebook)</h2>
            <p className="text-sm text-neutral-500">Seguimiento de conversiones para anuncios Meta</p>
          </div>
          <Toggle
            checked={form.metaEnabled}
            onChange={(v) => set('metaEnabled', v)}
            label={form.metaEnabled ? 'Activo' : 'Inactivo'}
          />
        </div>

        <div className="space-y-4">
          <Input
            label="Pixel ID"
            placeholder="1234567890123456"
            value={form.metaPixelId}
            onChange={(e) => set('metaPixelId', e.target.value)}
            hint="Encuéntralo en Meta Business > Eventos Manager"
          />
          <Input
            label="Access Token"
            type={showSecrets.meta ? 'text' : 'password'}
            placeholder="••••••••••••••••"
            value={form.metaAccessToken}
            onChange={(e) => set('metaAccessToken', e.target.value)}
            suffix={
              <button
                type="button"
                onClick={() => setShowSecrets((s) => ({ ...s, meta: !s.meta }))}
                className="text-neutral-400 hover:text-neutral-600"
              >
                {showSecrets.meta ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            }
          />
        </div>
      </Card>

      {/* Save */}
      <div className="flex items-center justify-end gap-4">
        {savedStatus === 'saved' && (
          <span className="flex items-center gap-1 text-sm text-success-600">
            <CheckCircle className="h-4 w-4" /> Guardado
          </span>
        )}
        {savedStatus === 'error' && (
          <span className="text-sm text-error-600">Error al guardar</span>
        )}
        <Button
          onClick={() => saveMutation.mutate()}
          loading={saveMutation.isPending}
          leftIcon={<Save className="h-4 w-4" />}
        >
          Guardar configuración
        </Button>
      </div>
    </div>
  );
}
