"use client";

import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/useToast';
import { api } from '@/lib/api';

interface GatewayConfig {
  name: string;
  enabled: boolean;
  sandbox: boolean;
  credentials: Record<string, string>;
}

interface GatewaysResponse {
  stripe: GatewayConfig;
  mercadopago: GatewayConfig;
  paypal: GatewayConfig;
}

const GATEWAY_FIELDS: Record<string, { key: string; label: string; masked: boolean }[]> = {
  stripe: [
    { key: 'publishable_key', label: 'Publishable Key', masked: false },
    { key: 'secret_key', label: 'Secret Key', masked: true },
    { key: 'webhook_secret', label: 'Webhook Secret', masked: true },
  ],
  mercadopago: [
    { key: 'access_token', label: 'Access Token', masked: true },
    { key: 'public_key', label: 'Public Key', masked: false },
    { key: 'webhook_secret', label: 'Webhook Secret', masked: true },
  ],
  paypal: [
    { key: 'client_id', label: 'Client ID', masked: false },
    { key: 'client_secret', label: 'Client Secret', masked: true },
    { key: 'webhook_id', label: 'Webhook ID', masked: false },
  ],
};

const GATEWAY_LABELS: Record<string, string> = {
  stripe: 'Stripe',
  mercadopago: 'MercadoPago',
  paypal: 'PayPal',
};

const GATEWAY_COLORS: Record<string, string> = {
  stripe: 'bg-indigo-50 border-indigo-200',
  mercadopago: 'bg-sky-50 border-sky-200',
  paypal: 'bg-yellow-50 border-yellow-200',
};

type TestStatus = 'idle' | 'testing' | 'success' | 'error';
type SaveStatus = 'idle' | 'saved' | 'error';

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
      <span className="text-sm text-neutral-600">{label}</span>
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
    </label>
  );
}

function GatewayCard({ gatewayKey, initial }: { gatewayKey: string; initial: GatewayConfig }) {
  const { success, error: toastError } = useToast();
  const fields = GATEWAY_FIELDS[gatewayKey] ?? [];
  const [enabled, setEnabled] = useState(initial.enabled);
  const [sandbox, setSandbox] = useState(initial.sandbox);
  const [credentials, setCredentials] = useState<Record<string, string>>(initial.credentials ?? {});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const patchToggle = async (field: 'enabled' | 'sandbox', value: boolean) => {
    try {
      await api.patch(`/admin/settings/gateways/${gatewayKey}`, { [field]: value });
    } catch {
      toastError(`Error al actualizar ${gatewayKey}`);
    }
  };

  const handleEnabled = (v: boolean) => {
    setEnabled(v);
    patchToggle('enabled', v);
  };

  const handleSandbox = (v: boolean) => {
    setSandbox(v);
    patchToggle('sandbox', v);
  };

  const handleTest = async () => {
    setTestStatus('testing');
    try {
      await api.post(`/admin/settings/gateways/${gatewayKey}/test`);
      setTestStatus('success');
    } catch {
      setTestStatus('error');
    }
  };

  const handleSave = async () => {
    try {
      await api.patch(`/admin/settings/gateways/${gatewayKey}`, { credentials });
      setSaveStatus('saved');
      success(`${GATEWAY_LABELS[gatewayKey]} guardado`);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      toastError(`Error al guardar ${GATEWAY_LABELS[gatewayKey]}`);
    }
  };

  return (
    <Card className={`p-6 border ${GATEWAY_COLORS[gatewayKey]}`}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-neutral-900">{GATEWAY_LABELS[gatewayKey]}</h2>
        <div className="flex items-center gap-4">
          <Toggle checked={sandbox} onChange={handleSandbox} label="Sandbox" />
          <Toggle checked={enabled} onChange={handleEnabled} label="Activo" />
        </div>
      </div>

      <div className="space-y-4">
        {fields.map((field) => (
          <Input
            key={field.key}
            label={field.label}
            type={field.masked && !visible[field.key] ? 'password' : 'text'}
            value={credentials[field.key] ?? ''}
            onChange={(e) =>
              setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
            }
            suffix={
              field.masked ? (
                <button
                  type="button"
                  onClick={() =>
                    setVisible((prev) => ({ ...prev, [field.key]: !prev[field.key] }))
                  }
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  {visible[field.key] ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              ) : undefined
            }
          />
        ))}
      </div>

      <div className="flex items-center justify-between mt-5 pt-4 border-t border-neutral-200">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testStatus === 'testing'}
            leftIcon={
              testStatus === 'testing' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : undefined
            }
          >
            {testStatus === 'testing' ? 'Probando...' : 'Test Conexión'}
          </Button>
          {testStatus === 'success' && (
            <span className="flex items-center gap-1 text-sm text-success-600">
              <CheckCircle className="h-4 w-4" /> Conexión OK
            </span>
          )}
          {testStatus === 'error' && (
            <span className="flex items-center gap-1 text-sm text-error-600">
              <XCircle className="h-4 w-4" /> Error de conexión
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {saveStatus === 'saved' && (
            <span className="text-sm text-success-600 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" /> Guardado
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-sm text-error-600">Error al guardar</span>
          )}
          <Button size="sm" onClick={handleSave}>
            Guardar
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function PasarelasPage() {
  const { data, isLoading } = useQuery<GatewaysResponse>({
    queryKey: ['admin-gateways'],
    queryFn: () => api.get<GatewaysResponse>('/admin/settings/gateways'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const defaultGateway = (name: string): GatewayConfig => ({
    name,
    enabled: false,
    sandbox: true,
    credentials: {},
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Pasarelas de Pago</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Configura tus métodos de cobro y credenciales de acceso
        </p>
      </div>

      <div className="space-y-6">
        <GatewayCard
          gatewayKey="stripe"
          initial={data?.stripe ?? defaultGateway('stripe')}
        />
        <GatewayCard
          gatewayKey="mercadopago"
          initial={data?.mercadopago ?? defaultGateway('mercadopago')}
        />
        <GatewayCard
          gatewayKey="paypal"
          initial={data?.paypal ?? defaultGateway('paypal')}
        />
      </div>
    </div>
  );
}
