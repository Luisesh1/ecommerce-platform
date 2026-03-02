"use client";
import { ReactNode, ElementType } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  footer?: ReactNode;
  clickable?: boolean;
  onClick?: () => void;
  as?: ElementType;
}

export function Card({
  children,
  className,
  header,
  footer,
  clickable,
  onClick,
  as: Tag = 'div',
}: CardProps) {
  return (
    <Tag
      className={cn(
        'rounded-lg border border-neutral-200 bg-white shadow-xs overflow-hidden',
        clickable && 'cursor-pointer transition-shadow hover:shadow-md hover:-translate-y-0.5 transition-transform',
        className
      )}
      onClick={onClick}
    >
      {header && (
        <div className="border-b border-neutral-200 px-6 py-4">{header}</div>
      )}
      <div className="px-6 py-4">{children}</div>
      {footer && (
        <div className="border-t border-neutral-200 px-6 py-4 bg-neutral-50">{footer}</div>
      )}
    </Tag>
  );
}
