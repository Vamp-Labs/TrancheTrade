'use client';

import { createContext, useContext } from 'react';
import type { TrancheKey } from '@/lib/beats';

export type TrancheFigureField =
  | 'seniorOutstanding'
  | 'juniorOutstanding'
  | 'seniorAllocatedTotal'
  | 'juniorAllocatedTotal';

export type TrancheFigureValues = Record<TrancheFigureField, bigint>;

export interface CascadeViewState {
  values: TrancheFigureValues;
  animatingTranche: TrancheKey | null;
}

export const CascadeContext = createContext<CascadeViewState | null>(null);

export function useCascadeView(): CascadeViewState | null {
  return useContext(CascadeContext);
}
