import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Step {
  label: string;
  description?: string;
}

export interface StepperProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <nav className={cn('flex items-center', className)} aria-label="Progress">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;
        const isLast = index === steps.length - 1;

        return (
          <div key={index} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                  isCompleted && 'border-brand-600 bg-brand-600 text-white',
                  isActive && 'border-brand-600 bg-white text-brand-600',
                  !isCompleted && !isActive && 'border-neutral-300 bg-white text-neutral-400'
                )}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : index + 1}
              </div>
              <div className="mt-2 text-center">
                <p
                  className={cn(
                    'text-xs font-medium',
                    isActive ? 'text-brand-600' : isCompleted ? 'text-neutral-900' : 'text-neutral-400'
                  )}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-neutral-400">{step.description}</p>
                )}
              </div>
            </div>
            {!isLast && (
              <div
                className={cn(
                  'mx-2 h-0.5 flex-1 transition-colors',
                  isCompleted ? 'bg-brand-600' : 'bg-neutral-200'
                )}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
