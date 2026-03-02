"use client";
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Toast as ToastType, type ToastVariant } from './useToast';

const icons: Record<ToastVariant, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const variantStyles: Record<ToastVariant, string> = {
  success: 'bg-success-50 border-success-500 text-success-700',
  error: 'bg-error-50 border-error-500 text-error-700',
  warning: 'bg-warning-50 border-warning-500 text-warning-700',
  info: 'bg-brand-50 border-brand-500 text-brand-700',
};

const iconStyles: Record<ToastVariant, string> = {
  success: 'text-success-500',
  error: 'text-error-500',
  warning: 'text-warning-500',
  info: 'text-brand-500',
};

interface ToastItemProps {
  toast: ToastType;
  onRemove: (id: string) => void;
}

export function ToastItem({ toast, onRemove }: ToastItemProps) {
  const Icon = icons[toast.variant];

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 shadow-md transition-all duration-300 animate-slide-up',
        variantStyles[toast.variant]
      )}
      role="alert"
    >
      <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', iconStyles[toast.variant])} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{toast.title}</p>
        {toast.description && (
          <p className="text-sm opacity-80 mt-0.5">{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 focus:outline-none"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
