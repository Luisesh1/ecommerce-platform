'use client';
import { forwardRef, InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  containerClassName?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, prefix, suffix, containerClassName, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-neutral-700"
          >
            {label}
            {props.required && <span className="ml-1 text-error-500">*</span>}
          </label>
        )}
        <div
          className={cn(
            'flex items-center rounded border bg-white transition-colors',
            error
              ? 'border-error-500 focus-within:ring-2 focus-within:ring-error-500/20'
              : 'border-neutral-300 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20',
            props.disabled && 'cursor-not-allowed bg-neutral-50 opacity-60'
          )}
        >
          {prefix && (
            <div className="flex items-center pl-3 text-neutral-500">{prefix}</div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'flex-1 bg-transparent px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none disabled:cursor-not-allowed',
              prefix && 'pl-2',
              suffix && 'pr-2',
              className
            )}
            {...props}
          />
          {suffix && (
            <div className="flex items-center pr-3 text-neutral-500">{suffix}</div>
          )}
        </div>
        {error && (
          <p className="text-xs text-error-500" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs text-neutral-500">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
