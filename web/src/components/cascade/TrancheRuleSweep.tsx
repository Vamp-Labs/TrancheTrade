'use client';

import { useCascadeView } from '@/components/cascade/CascadeContext';
import type { TrancheKey } from '@/lib/beats';

interface TrancheRuleSweepProps {
  tranche: TrancheKey;
}

export function TrancheRuleSweep({ tranche }: TrancheRuleSweepProps) {
  const view = useCascadeView();
  const isSweeping = view !== null && view.animatingTranche === tranche;
  return (
    <span
      aria-hidden="true"
      className={`beat-sweep ${tranche === 'senior' ? 'top-[2px] h-[2px]' : 'top-px h-px'}`}
      data-sweeping={isSweeping ? 'true' : 'false'}
      key={isSweeping ? 'sweeping' : 'still'}
    />
  );
}
