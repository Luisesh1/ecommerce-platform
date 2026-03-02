"use client";
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface DiffViewerProps {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  className?: string;
}

type DiffType = 'added' | 'removed' | 'changed' | 'unchanged';

interface DiffLine {
  key: string;
  type: DiffType;
  beforeValue?: unknown;
  afterValue?: unknown;
}

function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): DiffLine[] {
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const lines: DiffLine[] = [];

  allKeys.forEach((key) => {
    const beforeVal = before[key];
    const afterVal = after[key];

    if (!(key in before)) {
      lines.push({ key, type: 'added', afterValue: afterVal });
    } else if (!(key in after)) {
      lines.push({ key, type: 'removed', beforeValue: beforeVal });
    } else if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      lines.push({ key, type: 'changed', beforeValue: beforeVal, afterValue: afterVal });
    } else {
      lines.push({ key, type: 'unchanged', beforeValue: beforeVal });
    }
  });

  return lines.sort((a, b) => {
    const order = { changed: 0, added: 1, removed: 2, unchanged: 3 };
    return order[a.type] - order[b.type];
  });
}

function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

const lineStyles: Record<DiffType, string> = {
  added: 'bg-success-50 border-l-4 border-success-500',
  removed: 'bg-error-50 border-l-4 border-error-500',
  changed: 'bg-warning-50 border-l-4 border-warning-500',
  unchanged: 'border-l-4 border-transparent',
};

const prefixes: Record<DiffType, string> = {
  added: '+',
  removed: '-',
  changed: '~',
  unchanged: ' ',
};

export function DiffViewer({ before, after, className }: DiffViewerProps) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const diffs = computeDiff(before, after);
  const filteredDiffs = showUnchanged ? diffs : diffs.filter((d) => d.type !== 'unchanged');

  return (
    <div className={cn('rounded-lg overflow-hidden border border-neutral-200', className)}>
      <div className="flex items-center justify-between bg-neutral-100 px-4 py-2">
        <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
          Diferencias
        </span>
        <label className="flex items-center gap-2 text-xs text-neutral-500">
          <input
            type="checkbox"
            checked={showUnchanged}
            onChange={(e) => setShowUnchanged(e.target.checked)}
            className="rounded"
          />
          Mostrar sin cambios
        </label>
      </div>
      <div className="font-mono text-xs overflow-x-auto">
        {filteredDiffs.length === 0 ? (
          <p className="px-4 py-6 text-center text-neutral-400">Sin cambios relevantes</p>
        ) : (
          filteredDiffs.map((diff) => (
            <div key={diff.key} className={cn('px-4 py-2', lineStyles[diff.type])}>
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'font-bold shrink-0',
                    diff.type === 'added' && 'text-success-600',
                    diff.type === 'removed' && 'text-error-600',
                    diff.type === 'changed' && 'text-warning-700',
                    diff.type === 'unchanged' && 'text-neutral-300'
                  )}
                >
                  {prefixes[diff.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-neutral-700">{diff.key}: </span>
                  {diff.type === 'changed' ? (
                    <span>
                      <span className="line-through text-error-500 mr-2">
                        {formatValue(diff.beforeValue)}
                      </span>
                      <span className="text-success-600">{formatValue(diff.afterValue)}</span>
                    </span>
                  ) : diff.type === 'added' ? (
                    <span className="text-success-700">{formatValue(diff.afterValue)}</span>
                  ) : diff.type === 'removed' ? (
                    <span className="text-error-600">{formatValue(diff.beforeValue)}</span>
                  ) : (
                    <span className="text-neutral-500">{formatValue(diff.beforeValue)}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
