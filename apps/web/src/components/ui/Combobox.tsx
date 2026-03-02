"use client";
import { useState, ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  label,
  error,
  disabled,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const selected = options.find((o) => o.value === value);

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <label className="text-sm font-medium text-neutral-700">{label}</label>}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            disabled={disabled}
            className={cn(
              'flex h-10 w-full items-center justify-between rounded border bg-white px-3 py-2 text-sm transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500',
              error ? 'border-error-500' : 'border-neutral-300',
              disabled && 'cursor-not-allowed opacity-60',
              !selected && 'text-neutral-400'
            )}
          >
            {selected ? selected.label : placeholder}
            <ChevronsUpDown className="h-4 w-4 text-neutral-400" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border border-neutral-200 bg-white shadow-md"
            sideOffset={4}
          >
            <div className="flex items-center border-b border-neutral-100 px-3">
              <Search className="h-4 w-4 text-neutral-400 mr-2 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="flex-1 py-2 text-sm outline-none placeholder:text-neutral-400"
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-neutral-400">Sin resultados</p>
              ) : (
                filtered.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onChange?.(option.value);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left',
                      'hover:bg-brand-50 hover:text-brand-700',
                      value === option.value && 'text-brand-700 bg-brand-50'
                    )}
                  >
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0',
                        value === option.value ? 'opacity-100 text-brand-600' : 'opacity-0'
                      )}
                    />
                    {option.label}
                  </button>
                ))
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {error && <p className="text-xs text-error-500" role="alert">{error}</p>}
    </div>
  );
}
