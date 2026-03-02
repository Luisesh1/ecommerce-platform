"use client";
import { ReactNode, useState } from 'react';
import { Search, Filter, Download } from 'lucide-react';
import { Table, Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectChange?: (ids: string[]) => void;
  getRowId?: (row: T) => string;
  bulkActions?: ReactNode;
  actions?: ReactNode;
  onExport?: () => void;
  filterPanel?: ReactNode;
  emptyMessage?: string;
  className?: string;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSortChange?: (key: string, dir: 'asc' | 'desc') => void;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends object>({
  data,
  columns,
  isLoading,
  totalCount = 0,
  page = 1,
  pageSize = 25,
  onPageChange,
  onPageSizeChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  selectable,
  selectedIds,
  onSelectChange,
  getRowId,
  bulkActions,
  actions,
  onExport,
  filterPanel,
  emptyMessage,
  className,
  sortKey,
  sortDir,
  onSortChange,
}: DataTableProps<T>) {
  const [showFilters, setShowFilters] = useState(false);
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {onSearchChange && (
          <div className="flex-1 max-w-sm">
            <Input
              type="search"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              prefix={<Search className="h-4 w-4" />}
              containerClassName="mb-0"
            />
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {filterPanel && (
            <Button
              variant={showFilters ? 'primary' : 'outline'}
              size="sm"
              leftIcon={<Filter className="h-4 w-4" />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filtros
            </Button>
          )}
          {onExport && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="h-4 w-4" />}
              onClick={onExport}
            >
              Exportar
            </Button>
          )}
          {actions}
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && filterPanel && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          {filterPanel}
        </div>
      )}

      {/* Table */}
      <Table
        data={data}
        columns={columns}
        isLoading={isLoading}
        selectable={selectable}
        selectedIds={selectedIds}
        onSelectChange={onSelectChange}
        getRowId={getRowId}
        bulkActions={bulkActions}
        emptyMessage={emptyMessage}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={onSortChange}
      />

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            {totalCount} resultado{totalCount !== 1 ? 's' : ''}
          </p>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            pageSize={pageSize}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      )}
    </div>
  );
}
