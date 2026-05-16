'use client';

import { cn } from '@/lib/utils';
import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className, children, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-slate-600">{label}</label>}
      <select
        className={cn(
          'h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900',
          'focus:outline-none focus:ring-2 focus:ring-slate-500',
          className
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-slate-600">{label}</label>}
      <input
        className={cn(
          'h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900',
          'focus:outline-none focus:ring-2 focus:ring-slate-500',
          className
        )}
        {...props}
      />
    </div>
  );
}

export function Textarea({
  label,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-slate-600">{label}</label>}
      <textarea
        className={cn(
          'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900',
          'focus:outline-none focus:ring-2 focus:ring-slate-500',
          className
        )}
        {...props}
      />
    </div>
  );
}
