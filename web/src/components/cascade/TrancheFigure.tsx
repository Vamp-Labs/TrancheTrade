'use client';

import { useCascadeView, type TrancheFigureField } from '@/components/cascade/CascadeContext';
import { formatTokenAmount } from '@/lib/format';

const FIGURE_CLASS = {
  lg: 'figure-lg',
  md: 'figure-md',
  sm: 'figure-sm'
} as const;

interface TrancheFigureProps {
  field: TrancheFigureField;
  fallback: string;
  variant: keyof typeof FIGURE_CLASS;
  className?: string;
}

export function TrancheFigure({
  field,
  fallback,
  variant,
  className = ''
}: TrancheFigureProps) {
  const view = useCascadeView();
  const value = view === null ? BigInt(fallback) : view.values[field];
  return (
    <span className={`${FIGURE_CLASS[variant]} tabular-nums ${className}`}>
      {formatTokenAmount(value)}
    </span>
  );
}
