"use client";
import * as RadixTabs from '@radix-ui/react-tabs';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id?: string;
  value?: string;
  label: string;
  content?: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  /** Simple tab bar mode: controlled via activeTab/onTabChange */
  activeTab?: string;
  onTabChange?: (id: string) => void;
  className?: string;
  contentClassName?: string;
}

export function Tabs({
  tabs,
  defaultValue,
  value,
  onValueChange,
  activeTab,
  onTabChange,
  className,
  contentClassName,
}: TabsProps) {
  // Simple tab bar mode (no RadixTabs content panels)
  if (onTabChange !== undefined || activeTab !== undefined) {
    return (
      <div className={cn('flex border-b border-neutral-200', className)}>
        {tabs.map((tab) => {
          const tabId = tab.id ?? tab.value ?? tab.label;
          const isActive = activeTab === tabId;
          return (
            <button
              key={tabId}
              type="button"
              disabled={tab.disabled}
              onClick={() => onTabChange?.(tabId)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                isActive
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    );
  }

  const rootProps = value !== undefined
    ? { value, onValueChange }
    : { defaultValue: defaultValue ?? tabs[0]?.value ?? tabs[0]?.id };

  return (
    <RadixTabs.Root {...rootProps} className={cn('flex flex-col', className)}>
      <RadixTabs.List className="flex border-b border-neutral-200">
        {tabs.map((tab) => {
          const tabValue = tab.value ?? tab.id ?? tab.label;
          return (
            <RadixTabs.Trigger
              key={tabValue}
              value={tabValue}
              disabled={tab.disabled}
              className={cn(
                'px-4 py-2.5 text-sm font-medium text-neutral-500 transition-colors',
                'border-b-2 border-transparent -mb-px',
                'hover:text-neutral-900',
                'data-[state=active]:border-brand-500 data-[state=active]:text-brand-600',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
              )}
            >
              {tab.label}
            </RadixTabs.Trigger>
          );
        })}
      </RadixTabs.List>
      {tabs.map((tab) => {
        const tabValue = tab.value ?? tab.id ?? tab.label;
        return (
          <RadixTabs.Content
            key={tabValue}
            value={tabValue}
            className={cn('mt-4 focus:outline-none', contentClassName)}
          >
            {tab.content}
          </RadixTabs.Content>
        );
      })}
    </RadixTabs.Root>
  );
}
