import type { ManifestCycle, TransactionManifest } from '@/lib/manifest-schema';

export interface AllocatedTotalsSnapshot {
  senior: string;
  junior: string;
}

export interface TrancheStateSlice {
  seniorOutstanding: string;
  juniorOutstanding: string;
  seniorAllocatedTotal: string;
  juniorAllocatedTotal: string;
}

export interface RecordedTimeline {
  cycles: readonly ManifestCycle[];
  allocatedTotalsBefore: readonly AllocatedTotalsSnapshot[];
  opening: TrancheStateSlice | null;
}

export function buildRecordedTimeline(manifest: TransactionManifest): RecordedTimeline {
  const cycles = [...manifest.cycles].sort((left, right) =>
    left.occurredAt.localeCompare(right.occurredAt)
  );

  const allocatedTotalsBefore: AllocatedTotalsSnapshot[] = [];
  let seniorAllocatedTotal = 0n;
  let juniorAllocatedTotal = 0n;

  for (const cycle of cycles) {
    allocatedTotalsBefore.push({
      senior: seniorAllocatedTotal.toString(),
      junior: juniorAllocatedTotal.toString()
    });
    if (cycle.allocation !== null) {
      seniorAllocatedTotal += BigInt(cycle.allocation.seniorAllocation);
      juniorAllocatedTotal += BigInt(cycle.allocation.juniorAllocation);
    }
  }

  const first = cycles[0];
  const firstState = first === undefined ? null : (first.allocation ?? first.rejection);

  return {
    cycles,
    allocatedTotalsBefore,
    opening:
      firstState === null || firstState === undefined
        ? null
        : {
            seniorOutstanding: firstState.seniorOutstandingBefore,
            juniorOutstanding: firstState.juniorOutstandingBefore,
            seniorAllocatedTotal: '0',
            juniorAllocatedTotal: '0'
          }
  };
}

export function totalAttested(manifest: TransactionManifest): bigint {
  let total = 0n;
  for (const cycle of manifest.cycles) {
    if (cycle.allocation !== null) total += BigInt(cycle.allocation.attestedAmount);
  }
  return total;
}
