"use client";
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, File, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface UploadedFile {
  file: File;
  preview?: string;
  progress: number;
  error?: string;
  id: string;
}

export interface FileUploadProps {
  accept?: Record<string, string[]>;
  maxSize?: number;
  maxFiles?: number;
  onFilesChange?: (files: File[]) => void;
  onUpload?: (file: File) => Promise<string>;
  className?: string;
  label?: string;
}

export function FileUpload({
  accept,
  maxSize = 10 * 1024 * 1024,
  maxFiles = 10,
  onFilesChange,
  onUpload,
  className,
  label,
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
        file,
        id: Math.random().toString(36).slice(2),
        progress: 0,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      }));

      setFiles((prev) => [...prev, ...newFiles]);
      onFilesChange?.(acceptedFiles);

      if (onUpload) {
        newFiles.forEach(async (f) => {
          try {
            setFiles((prev) =>
              prev.map((p) => (p.id === f.id ? { ...p, progress: 30 } : p))
            );
            await onUpload(f.file);
            setFiles((prev) =>
              prev.map((p) => (p.id === f.id ? { ...p, progress: 100 } : p))
            );
          } catch (err) {
            setFiles((prev) =>
              prev.map((p) =>
                p.id === f.id ? { ...p, error: 'Error al subir archivo' } : p
              )
            );
          }
        });
      }
    },
    [onFilesChange, onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    maxFiles,
  });

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const removed = prev.find((f) => f.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  return (
    <div className={cn('space-y-3', className)}>
      {label && <label className="text-sm font-medium text-neutral-700">{label}</label>}
      <div
        {...getRootProps()}
        className={cn(
          'rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-brand-500 bg-brand-50'
            : 'border-neutral-200 hover:border-brand-300 hover:bg-neutral-50'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-10 w-10 mx-auto mb-3 text-neutral-300" />
        {isDragActive ? (
          <p className="text-sm text-brand-600 font-medium">Suelta los archivos aqui</p>
        ) : (
          <>
            <p className="text-sm text-neutral-600">
              <span className="font-medium text-brand-600">Haz clic para subir</span> o arrastra y suelta
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              Max {Math.round(maxSize / (1024 * 1024))}MB por archivo
            </p>
          </>
        )}
      </div>
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3"
            >
              {f.preview ? (
                <img src={f.preview} alt="" className="h-10 w-10 rounded object-cover" />
              ) : (
                <File className="h-10 w-10 text-neutral-400" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-700 truncate">{f.file.name}</p>
                {f.error ? (
                  <p className="text-xs text-error-500">{f.error}</p>
                ) : (
                  <div className="mt-1 h-1.5 w-full rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all"
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>
                )}
              </div>
              <button
                onClick={() => removeFile(f.id)}
                className="shrink-0 text-neutral-400 hover:text-neutral-600"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
