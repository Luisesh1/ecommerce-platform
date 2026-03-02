"use client";
import { cn } from '@/lib/utils';

export interface VariantOption {
  name: string;
  values: {
    value: string;
    label: string;
    colorHex?: string;
    available?: boolean;
  }[];
}

interface VariantSelectorProps {
  options: VariantOption[];
  selectedValues: Record<string, string>;
  onChange: (optionName: string, value: string) => void;
}

export function VariantSelector({ options, selectedValues, onChange }: VariantSelectorProps) {
  return (
    <div className="space-y-4">
      {options.map((option) => (
        <div key={option.name}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-neutral-700">{option.name}</span>
            {selectedValues[option.name] && (
              <span className="text-sm text-neutral-500">{selectedValues[option.name]}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {option.values.map((val) => {
              const isSelected = selectedValues[option.name] === val.value;
              const isColor = !!val.colorHex;

              if (isColor) {
                return (
                  <button
                    key={val.value}
                    title={val.label}
                    onClick={() => val.available !== false && onChange(option.name, val.value)}
                    disabled={val.available === false}
                    className={cn(
                      'relative h-8 w-8 rounded-full border-2 transition-all',
                      isSelected ? 'border-brand-600 scale-110' : 'border-transparent',
                      val.available === false && 'opacity-40 cursor-not-allowed'
                    )}
                    style={{ backgroundColor: val.colorHex }}
                  >
                    {val.available === false && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-full">
                        <div className="h-[1px] w-full bg-neutral-400 rotate-45" />
                      </div>
                    )}
                  </button>
                );
              }

              return (
                <button
                  key={val.value}
                  onClick={() => val.available !== false && onChange(option.name, val.value)}
                  disabled={val.available === false}
                  className={cn(
                    'rounded border px-3 py-1.5 text-sm font-medium transition-all',
                    isSelected
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-neutral-200 text-neutral-700 hover:border-brand-300',
                    val.available === false &&
                      'opacity-40 cursor-not-allowed line-through'
                  )}
                >
                  {val.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
