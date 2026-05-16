import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'outline' | 'destructive' | 'secondary';
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variant === 'default' && 'bg-slate-900 text-white',
        variant === 'secondary' && 'bg-slate-100 text-slate-700',
        variant === 'outline' && 'border border-slate-300 text-slate-700',
        variant === 'destructive' && 'bg-red-100 text-red-700',
        className
      )}
    >
      {children}
    </span>
  );
}
