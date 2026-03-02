"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Upload, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { FileUpload } from '@/components/ui/FileUpload';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/useToast';
import { api } from '@/lib/api';

interface ImportJob {
  id: string;
  createdAt: string;
  fileName: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: number;
  totalRows: number;
  processedRows: number;
  errors: ImportError[];
}

interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface JobsResponse {
  data: ImportJob[];
  total: number;
}

const statusVariant: Record<ImportJob['status'], 'neutral' | 'info' | 'success' | 'error'> = {
  PENDING: 'neutral',
  RUNNING: 'info',
  COMPLETED: 'success',
  FAILED: 'error',
};

const statusLabel: Record<ImportJob['status'], string> = {
  PENDING: 'Pendiente',
  RUNNING: 'Procesando',
  COMPLETED: 'Completado',
  FAILED: 'Fallido',
};

function parseCSVPreview(content: string, maxRows = 5): string[][] {
  const lines = content.split('\n').filter((l) => l.trim());
  return lines.slice(0, maxRows + 1).map((line) => line.split(',').map((c) => c.trim()));
}

export default function ImportarPage() {
  const { success, error: toastError } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<string[][] | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: jobsData, refetch: refetchJobs } = useQuery<JobsResponse>({
    queryKey: ['admin-import-jobs'],
    queryFn: () => api.get<JobsResponse>('/admin/import/jobs'),
  });

  const [activeJob, setActiveJob] = useState<ImportJob | null>(null);

  const fetchActiveJob = useCallback(async () => {
    if (!activeJobId) return;
    try {
      const job = await api.get<ImportJob>(`/admin/import/jobs/${activeJobId}`);
      setActiveJob(job);
      if (job.status === 'COMPLETED' || job.status === 'FAILED') {
        if (pollingRef.current) clearInterval(pollingRef.current);
        refetchJobs();
      }
    } catch {
      // ignore
    }
  }, [activeJobId, refetchJobs]);

  useEffect(() => {
    if (activeJobId) {
      pollingRef.current = setInterval(fetchActiveJob, 2000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeJobId, fetchActiveJob]);

  const handleFileChange = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setPreviewData(parseCSVPreview(text, 5));
    };
    reader.readAsText(file);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('No file');
      const formData = new FormData();
      formData.append('file', selectedFile);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/admin/import/products`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${
              typeof window !== 'undefined' ? localStorage.getItem('access_token') ?? '' : ''
            }`,
          },
          body: formData,
        }
      );
      if (!response.ok) throw new Error('Import failed');
      return response.json() as Promise<{ jobId: string }>;
    },
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
      setActiveJob(null);
      success('Importación iniciada', 'Procesando archivo CSV...');
    },
    onError: () => toastError('Error al iniciar la importación'),
  });

  const jobs = jobsData?.data ?? [];

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Importar Productos</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Sube un archivo CSV para importar productos masivamente
        </p>
      </div>

      {/* Upload */}
      <div className="rounded-lg border border-neutral-200 p-6 bg-white space-y-4">
        <h2 className="font-semibold text-neutral-900">1. Selecciona el archivo</h2>
        <FileUpload
          accept={{ 'text/csv': ['.csv'] }}
          maxFiles={1}
          onFilesChange={handleFileChange}
          label="Archivo CSV"
        />
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>Formato esperado: nombre, sku, precio, stock, categoría, descripción</span>
          <a
            href="/templates/products-import.csv"
            download
            className="text-brand-600 hover:underline"
          >
            Descargar plantilla
          </a>
        </div>
      </div>

      {/* Preview */}
      {previewData && previewData.length > 1 && (
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200">
            <h2 className="font-semibold text-neutral-900 text-sm">
              2. Vista previa (primeras {previewData.length - 1} filas)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  {previewData[0].map((header, i) => (
                    <th key={i} className="px-3 py-2 text-left font-medium text-neutral-600">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {previewData.slice(1).map((row, ri) => (
                  <tr key={ri} className="hover:bg-neutral-50">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-neutral-700">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-neutral-200 flex justify-end">
            <Button
              leftIcon={<Upload className="h-4 w-4" />}
              onClick={() => importMutation.mutate()}
              loading={importMutation.isPending}
              disabled={!selectedFile}
            >
              Importar productos
            </Button>
          </div>
        </div>
      )}

      {/* Active job progress */}
      {activeJob && (
        <div className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-neutral-900">Progreso de importación</h2>
            <Badge variant={statusVariant[activeJob.status]} size="sm">
              {statusLabel[activeJob.status]}
            </Badge>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-neutral-500">
              <span>{activeJob.processedRows} de {activeJob.totalRows} filas</span>
              <span>{activeJob.progress}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-neutral-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  activeJob.status === 'FAILED' ? 'bg-error-500' : 'bg-brand-500'
                }`}
                style={{ width: `${activeJob.progress}%` }}
              />
            </div>
          </div>

          {activeJob.status === 'COMPLETED' && (
            <div className="flex items-center gap-2 text-success-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              Importación completada exitosamente
            </div>
          )}

          {activeJob.errors.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-error-700 mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Errores ({activeJob.errors.length})
              </h3>
              <div className="rounded border border-error-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-error-50 border-b border-error-200">
                      <th className="px-3 py-2 text-left font-medium text-error-700">Fila</th>
                      <th className="px-3 py-2 text-left font-medium text-error-700">Campo</th>
                      <th className="px-3 py-2 text-left font-medium text-error-700">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-error-100">
                    {activeJob.errors.map((err, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono">{err.row}</td>
                        <td className="px-3 py-2 text-neutral-700">{err.field}</td>
                        <td className="px-3 py-2 text-error-600">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Jobs history */}
      {jobs.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200">
            <h2 className="font-semibold text-sm text-neutral-900">Historial de importaciones</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="px-4 py-2.5 text-left font-medium text-neutral-600">Archivo</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-600">Fecha</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-600">Estado</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-600">Filas</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-600">Errores</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className="hover:bg-neutral-50 cursor-pointer"
                  onClick={() => { setActiveJobId(job.id); setActiveJob(job); }}
                >
                  <td className="px-4 py-3 font-mono text-xs text-neutral-700">
                    {job.fileName}
                  </td>
                  <td className="px-4 py-3 text-neutral-500 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(job.createdAt).toLocaleString('es')}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[job.status]} size="sm">
                      {statusLabel[job.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{job.totalRows}</td>
                  <td className="px-4 py-3">
                    {job.errors.length > 0 ? (
                      <span className="text-error-600 font-medium">{job.errors.length}</span>
                    ) : (
                      <span className="text-neutral-400">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
