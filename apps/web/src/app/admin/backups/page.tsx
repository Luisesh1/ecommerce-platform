"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HardDrive, Play, RotateCcw, AlertTriangle } from 'lucide-react';
import { DataTable } from '@/components/admin/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Column } from '@/components/ui/Table';
import { useToast } from '@/components/ui/useToast';
import { api } from '@/lib/api';

interface Backup {
  id: string;
  createdAt: string;
  sizeMb: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  checksum: string | null;
}

interface BackupsResponse {
  data: Backup[];
  total: number;
}

const statusVariant: Record<Backup['status'], 'info' | 'success' | 'error'> = {
  RUNNING: 'info',
  COMPLETED: 'success',
  FAILED: 'error',
};

const statusLabel: Record<Backup['status'], string> = {
  RUNNING: 'Ejecutando',
  COMPLETED: 'Completado',
  FAILED: 'Fallido',
};

export default function BackupsPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError, info } = useToast();
  const [page, setPage] = useState(1);
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);

  const { data, isLoading } = useQuery<BackupsResponse>({
    queryKey: ['admin-backups', page],
    queryFn: () => api.get<BackupsResponse>('/admin/backups', { page, pageSize: 25 }),
    refetchInterval: 15_000,
  });

  const backups = data?.data ?? [];
  const total = data?.total ?? 0;

  const createBackup = useMutation({
    mutationFn: () => api.post('/admin/backups'),
    onSuccess: () => {
      info('Backup iniciado', 'El proceso puede tardar varios minutos');
      queryClient.invalidateQueries({ queryKey: ['admin-backups'] });
    },
    onError: () => toastError('Error al iniciar backup'),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/backups/${id}/restore`),
    onSuccess: () => {
      success('Restauración iniciada', 'El sistema se restaurará al estado del backup seleccionado');
      setRestoreTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-backups'] });
    },
    onError: () => {
      toastError('Error al restaurar backup');
      setRestoreTarget(null);
    },
  });

  const columns: Column<Backup>[] = [
    {
      key: 'createdAt',
      header: 'Fecha',
      render: (row) => (
        <span className="text-sm">{new Date(row.createdAt).toLocaleString('es')}</span>
      ),
    },
    {
      key: 'sizeMb',
      header: 'Tamaño',
      render: (row) => (
        <span className="text-sm text-neutral-700">{row.sizeMb.toFixed(1)} MB</span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <Badge variant={statusVariant[row.status]} size="sm">
          {statusLabel[row.status]}
        </Badge>
      ),
    },
    {
      key: 'checksum',
      header: 'Checksum',
      render: (row) =>
        row.checksum ? (
          <span className="font-mono text-xs text-neutral-500 truncate max-w-[120px] block">
            {row.checksum}
          </span>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          disabled={row.status !== 'COMPLETED'}
          leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
          onClick={() => setRestoreTarget(row)}
        >
          Restaurar
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Backups</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Gestiona los respaldos de la base de datos
          </p>
        </div>
        <Button
          leftIcon={<Play className="h-4 w-4" />}
          loading={createBackup.isPending}
          onClick={() => createBackup.mutate()}
        >
          Backup Ahora
        </Button>
      </div>

      <DataTable
        data={backups}
        columns={columns}
        isLoading={isLoading}
        totalCount={total}
        page={page}
        pageSize={25}
        onPageChange={setPage}
        getRowId={(row) => row.id}
        emptyMessage="No hay backups registrados"
        actions={
          <div className="flex items-center gap-1 text-neutral-400">
            <HardDrive className="h-4 w-4" />
            <span className="text-sm">{total} backups</span>
          </div>
        }
      />

      {/* Restore confirm modal */}
      <Modal
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        title="Confirmar restauración"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setRestoreTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={restoreMutation.isPending}
              leftIcon={<RotateCcw className="h-4 w-4" />}
              onClick={() => restoreTarget && restoreMutation.mutate(restoreTarget.id)}
            >
              Restaurar
            </Button>
          </div>
        }
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 rounded-full bg-error-100 p-2">
            <AlertTriangle className="h-5 w-5 text-error-600" />
          </div>
          <div>
            <p className="text-sm text-neutral-700">
              ¿Restaurar backup de{' '}
              <strong>
                {restoreTarget &&
                  new Date(restoreTarget.createdAt).toLocaleString('es')}
              </strong>
              ?
            </p>
            <p className="text-sm text-error-600 font-semibold mt-2">
              Esta acción es irreversible.
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              El sistema revertirá todos los datos al estado del backup seleccionado. Asegúrate de
              tener un backup reciente antes de proceder.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
