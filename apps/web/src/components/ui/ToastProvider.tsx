"use client";
import { useEffect } from 'react';
import { ToastItem } from './Toast';
import { useToastState, registerToastHandler } from './useToast';

export function ToastProvider() {
  const { toasts, addToast, removeToast } = useToastState();

  useEffect(() => {
    const unregister = registerToastHandler(addToast);
    return unregister;
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onRemove={removeToast} />
        </div>
      ))}
    </div>
  );
}
