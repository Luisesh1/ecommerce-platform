"use client";

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Database, Zap, Search, Globe, Clock, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

interface ServiceHealth {
  status: 'ok' | 'degraded' | 'down';
  latencyMs?: number;
  message?: string;
}

interface HealthData {
  services: {
    db: ServiceHealth;
    redis: ServiceHealth;
    meilisearch: ServiceHealth;
    api: ServiceHealth;
  };
  queues: {
    pendingJobs: number;
    failedJobs: number;
  };
  webhooks: {
    unprocessed: number;
  };
  payments: {
    pending: number;
  };
  backup: {
    lastBackupAt: string | null;
    status: 'COMPLETED' | 'RUNNING' | 'FAILED' | null;
  };
}

const SERVICES: { key: keyof HealthData['services']; label: string; icon: typeof Database }[] = [
  { key: 'db', label: 'Base de datos', icon: Database },
  { key: 'redis', label: 'Redis', icon: Zap },
  { key: 'meilisearch', label: 'Meilisearch', icon: Search },
  { key: 'api', label: 'API', icon: Globe },
];

const statusConfig = {
  ok: {
    color: 'bg-success-500',
    ring: 'ring-success-200',
    label: 'Operativo',
    badge: 'success' as const,
  },
  degraded: {
    color: 'bg-warning-400',
    ring: 'ring-warning-200',
    label: 'Degradado',
    badge: 'warning' as const,
  },
  down: {
    color: 'bg-error-500',
    ring: 'ring-error-200',
    label: 'Caído',
    badge: 'error' as const,
  },
};

const backupStatusVariant = {
  COMPLETED: 'success' as const,
  RUNNING: 'info' as const,
  FAILED: 'error' as const,
};

function ServiceLight({ service, health }: { service: (typeof SERVICES)[0]; health: ServiceHealth }) {
  const Icon = service.icon;
  const cfg = statusConfig[health.status];

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border border-neutral-200 bg-white">
      <div className={`relative flex-shrink-0 h-4 w-4 rounded-full ${cfg.color} ring-4 ${cfg.ring}`}>
        {health.status === 'ok' && (
          <span className="absolute inset-0 rounded-full bg-success-400 animate-ping opacity-60" />
        )}
      </div>
      <div className="flex-shrink-0 rounded-lg bg-neutral-100 p-2">
        <Icon className="h-5 w-5 text-neutral-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-900">{service.label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant={cfg.badge} size="sm">{cfg.label}</Badge>
          {health.latencyMs != null && (
            <span className="text-xs text-neutral-400">{health.latencyMs}ms</span>
          )}
        </div>
        {health.message && (
          <p className="text-xs text-neutral-500 mt-1">{health.message}</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color = 'text-neutral-600' }: {
  label: string;
  value: number | string;
  icon: typeof Clock;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-neutral-100 p-2">
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div>
          <p className="text-xs text-neutral-500">{label}</p>
          <p className="text-2xl font-bold text-neutral-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

const REFRESH_INTERVAL = 30_000;

export default function SaludPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<HealthData>('/health/detailed');
      setData(result);
      setLastRefreshed(new Date());
      setCountdown(REFRESH_INTERVAL / 1000);
    } catch {
      // Keep previous data on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : REFRESH_INTERVAL / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastRefreshed]);

  const defaultService: ServiceHealth = { status: 'down' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Salud del Sistema</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Monitoreo en tiempo real — actualiza en {countdown}s
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
          onClick={fetchHealth}
          disabled={loading}
        >
          Actualizar
        </Button>
      </div>

      {lastRefreshed && (
        <p className="text-xs text-neutral-400 flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          Última actualización: {lastRefreshed.toLocaleTimeString('es')}
        </p>
      )}

      {/* Services semáforos */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-600 uppercase tracking-wider mb-3">
          Servicios
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SERVICES.map((svc) => (
            <ServiceLight
              key={svc.key}
              service={svc}
              health={data?.services?.[svc.key] ?? defaultService}
            />
          ))}
        </div>
      </div>

      {/* Counters */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-600 uppercase tracking-wider mb-3">
          Métricas operativas
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Trabajos en cola"
            value={data?.queues.pendingJobs ?? '—'}
            icon={RefreshCw}
            color={(data?.queues.pendingJobs ?? 0) > 100 ? 'text-warning-500' : 'text-neutral-600'}
          />
          <StatCard
            label="Trabajos fallidos"
            value={data?.queues.failedJobs ?? '—'}
            icon={RefreshCw}
            color={(data?.queues.failedJobs ?? 0) > 0 ? 'text-error-500' : 'text-neutral-600'}
          />
          <StatCard
            label="Webhooks sin procesar"
            value={data?.webhooks.unprocessed ?? '—'}
            icon={Globe}
            color={(data?.webhooks.unprocessed ?? 0) > 10 ? 'text-warning-500' : 'text-neutral-600'}
          />
          <StatCard
            label="Pagos pendientes"
            value={data?.payments.pending ?? '—'}
            icon={Clock}
            color={(data?.payments.pending ?? 0) > 0 ? 'text-warning-500' : 'text-neutral-600'}
          />
        </div>
      </div>

      {/* Backup */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-600 uppercase tracking-wider mb-3">
          Último Backup
        </h2>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 flex items-center gap-4">
          <div className="rounded-lg bg-neutral-100 p-2">
            <HardDrive className="h-5 w-5 text-neutral-600" />
          </div>
          <div className="flex-1">
            {data?.backup.lastBackupAt ? (
              <>
                <p className="text-sm font-medium text-neutral-900">
                  {new Date(data.backup.lastBackupAt).toLocaleString('es')}
                </p>
                <div className="mt-1">
                  {data.backup.status && (
                    <Badge variant={backupStatusVariant[data.backup.status]} size="sm">
                      {data.backup.status}
                    </Badge>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-neutral-400">Sin backup registrado</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
