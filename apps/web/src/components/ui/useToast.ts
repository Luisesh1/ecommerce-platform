'use client';
import { useState, useCallback } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration?: number;
}

let toastQueue: ((toast: Omit<Toast, 'id'>) => void)[] = [];

export function addToast(toast: Omit<Toast, 'id'>) {
  toastQueue.forEach((fn) => fn(toast));
}

export function useToastState() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToastInternal = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const newToast: Toast = { ...toast, id, duration: toast.duration ?? 4000 };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, newToast.duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast: addToastInternal, removeToast };
}

export function useToast() {
  const toast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      addToast(toast);
    },
    []
  );

  return {
    toast,
    success: (title: string, description?: string) =>
      addToast({ title, description, variant: 'success' }),
    error: (title: string, description?: string) =>
      addToast({ title, description, variant: 'error' }),
    warning: (title: string, description?: string) =>
      addToast({ title, description, variant: 'warning' }),
    info: (title: string, description?: string) =>
      addToast({ title, description, variant: 'info' }),
  };
}

export function registerToastHandler(fn: (toast: Omit<Toast, 'id'>) => void) {
  toastQueue.push(fn);
  return () => {
    toastQueue = toastQueue.filter((f) => f !== fn);
  };
}
