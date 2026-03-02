"use client";
import { ReactNode, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  header?: string;
  title?: string;
  render?: (row: T, index: number) => ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
}

export interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectChange?: (ids: string[]) => void;
  getRowId?: (row: T) => string;
  bulkActions?: ReactNode;
  emptyMessage?: string;
  className?: string;
  onSortChange?: (key: string, dir: 'asc' | 'desc') => void;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
}

export function Table<T extends object>({
  data,
  columns,
  isLoading,
  selectable,
  selectedIds = [],
  onSelectChange,
  getRowId,
  bulkActions,
  emptyMessage = 'No hay datos',
  className,
  onSortChange,
  sortKey,
  sortDir,
}: TableProps<T>) {
  const allSelected = data.length > 0 && selectedIds.length === data.length;

  const toggleAll = () => {
    if (!getRowId || !onSelectChange) return;
    if (allSelected) {
      onSelectChange([]);
    } else {
      onSelectChange(data.map(getRowId));
    }
  };

  const toggleRow = (id: string) => {
    if (!onSelectChange) return;
    if (selectedIds.includes(id)) {
      onSelectChange(selectedIds.filter((s) => s !== id));
    } else {
      onSelectChange([...selectedIds, id]);
    }
  };

  const handleSort = (key: string) => {
    if (!onSortChange) return;
    if (sortKey === key) {
      onSortChange(key, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(key, 'asc');
    }
  };

  return (
    <div className={cn('overflow-hidden rounded-lg border border-neutral-200', className)}>
      {selectedIds.length > 0 && bulkActions && (
        <div className="flex items-center gap-3 bg-brand-50 px-4 py-2 border-b border-neutral-200">
          <span className="text-sm text-brand-700 font-medium">
            {selectedIds.length} seleccionados
          </span>
          {bulkActions}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              {selectable && (
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-neutral-300"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left font-semibold text-neutral-700',
                    col.sortable && 'cursor-pointer select-none hover:bg-neutral-100',
                    col.headerClassName
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <span className="text-neutral-400">
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-4 w-4" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="bg-white">
                    {selectable && (
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-4" />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : data.length === 0
              ? (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className="px-4 py-12 text-center text-neutral-400"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )
              : data.map((row, rowIndex) => {
                  const id = getRowId ? getRowId(row) : String(rowIndex);
                  const isSelected = selectedIds.includes(id);
                  return (
                    <tr
                      key={id}
                      className={cn(
                        'bg-white transition-colors hover:bg-neutral-50',
                        isSelected && 'bg-brand-50'
                      )}
                    >
                      {selectable && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(id)}
                            className="rounded border-neutral-300"
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn('px-4 py-3 text-neutral-700', col.className)}
                        >
                          {col.render
                            ? col.render(row, rowIndex)
                            : String((row as Record<string, unknown>)[col.key] ?? '')}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
