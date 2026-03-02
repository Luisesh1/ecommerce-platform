"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ToggleLeft, ToggleRight, Flag } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/useToast';
import { api } from '@/lib/api';

interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
}

const KNOWN_FLAGS: { key: string; name: string; description: string }[] = [
  {
    key: 'maintenance_mode',
    name: 'Modo mantenimiento',
    description: 'Muestra una página de mantenimiento a todos los visitantes',
  },
  {
    key: 'new_checkout',
    name: 'Nuevo checkout',
    description: 'Activa el flujo de checkout rediseñado con pasos optimizados',
  },
  {
    key: 'loyalty_points',
    name: 'Puntos de lealtad',
    description: 'Permite a los clientes acumular y canjear puntos en sus compras',
  },
  {
    key: 'back_in_stock',
    name: 'Notificación de disponibilidad',
    description: 'Los clientes pueden suscribirse para ser notificados cuando un producto vuelva a estar disponible',
  },
  {
    key: 'reviews_enabled',
    name: 'Reseñas de productos',
    description: 'Permite a los clientes dejar reseñas y calificaciones en productos',
  },
  {
    key: 'chat_enabled',
    name: 'Chat de soporte',
    description: 'Muestra el widget de chat en la tienda para soporte en tiempo real',
  },
];

function FlagSkeleton() {
  return (
    <div className="flex items-start justify-between p-5 border border-neutral-200 rounded-lg">
      <div className="flex items-start gap-4 flex-1">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-72" />
        </div>
      </div>
      <Skeleton className="h-6 w-12 rounded-full" />
    </div>
  );
}

export default function FeaturesPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const { data: flags = [], isLoading } = useQuery<FeatureFlag[]>({
    queryKey: ['admin-features'],
    queryFn: () => api.get<FeatureFlag[]>('/admin/features'),
    select: (data) => {
      // Merge with known flags to ensure all are shown
      const map = new Map(data.map((f) => [f.key, f]));
      return KNOWN_FLAGS.map((kf) => ({
        ...kf,
        enabled: map.get(kf.key)?.enabled ?? false,
      }));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      api.patch(`/admin/features/${key}`, { enabled }),
    onMutate: async ({ key, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-features'] });
      const previous = queryClient.getQueryData<FeatureFlag[]>(['admin-features']);
      queryClient.setQueryData<FeatureFlag[]>(['admin-features'], (old = []) =>
        old.map((f) => (f.key === key ? { ...f, enabled } : f))
      );
      return { previous };
    },
    onSuccess: (_, { key, enabled }) => {
      const flag = KNOWN_FLAGS.find((f) => f.key === key);
      success(`${flag?.name ?? key} ${enabled ? 'activado' : 'desactivado'}`);
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['admin-features'], context.previous);
      }
      toastError('Error al cambiar el estado');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-features'] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Feature Flags</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Activa o desactiva funcionalidades de la tienda en tiempo real
        </p>
      </div>

      <div className="space-y-3">
        {isLoading
          ? KNOWN_FLAGS.map((f) => <FlagSkeleton key={f.key} />)
          : flags.map((flag) => (
              <div
                key={flag.key}
                className="flex items-start justify-between p-5 border border-neutral-200 rounded-lg bg-white hover:border-neutral-300 transition-colors"
              >
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div
                    className={`flex-shrink-0 rounded-lg p-2 ${
                      flag.enabled ? 'bg-brand-50' : 'bg-neutral-100'
                    }`}
                  >
                    <Flag
                      className={`h-5 w-5 ${flag.enabled ? 'text-brand-600' : 'text-neutral-400'}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-sm font-semibold text-neutral-900">{flag.name}</h3>
                      <Badge variant={flag.enabled ? 'success' : 'neutral'} size="sm">
                        {flag.enabled ? 'ON' : 'OFF'}
                      </Badge>
                    </div>
                    <p className="text-sm text-neutral-500">{flag.description}</p>
                    <p className="text-xs text-neutral-400 mt-1 font-mono">{flag.key}</p>
                  </div>
                </div>

                <button
                  onClick={() =>
                    toggleMutation.mutate({ key: flag.key, enabled: !flag.enabled })
                  }
                  disabled={toggleMutation.isPending}
                  className="ml-4 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-full"
                  aria-label={flag.enabled ? 'Desactivar' : 'Activar'}
                >
                  {flag.enabled ? (
                    <ToggleRight className="h-8 w-8 text-brand-600" />
                  ) : (
                    <ToggleLeft className="h-8 w-8 text-neutral-300" />
                  )}
                </button>
              </div>
            ))}
      </div>
    </div>
  );
}
