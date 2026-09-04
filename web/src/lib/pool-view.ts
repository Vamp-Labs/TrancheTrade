import { createCachedPoolClient } from '@/lib/chains';
import { deployments, trancheWaterfallAddress } from '@/lib/contracts';
import { resolveManifest, type ResolvedManifest } from '@/lib/manifest';
import {
  DOCUMENTED_RATES,
  DOCUMENTED_STRUCTURE,
  derivePoolSnapshotFromManifest,
  readPoolSnapshot,
  readTrancheRates,
  readTrancheStructure,
  type PoolOrigin,
  type PoolSnapshot,
  type TrancheRates,
  type TrancheStructure
} from '@/lib/pool';
import { buildRecordedTimeline, totalAttested, type RecordedTimeline } from '@/lib/timeline';
import { creditcoinCc3 } from '@/lib/networks';

export const POOL_REVALIDATE_SECONDS = 15;

const EMPTY_SNAPSHOT: PoolSnapshot = {
  seniorOutstanding: 0n,
  juniorOutstanding: 0n,
  seniorPrincipal: 0n,
  juniorPrincipal: 0n,
  seniorAllocatedTotal: 0n,
  juniorAllocatedTotal: 0n,
  seniorCap: deployments.configuredSeniorCap ?? 0n,
  juniorCap: deployments.configuredJuniorCap ?? 0n
};

export interface PoolView {
  snapshot: PoolSnapshot;
  snapshotOrigin: PoolOrigin;
  rates: TrancheRates;
  structure: TrancheStructure;
  resolved: ResolvedManifest;
  timeline: RecordedTimeline;
  attestedToDate: bigint;
  hashesAreLinkable: boolean;
  chainReadProblem: string | null;
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'The Creditcoin CC3 read did not return a usable result.';
}

export async function loadPoolView(): Promise<PoolView> {
  const resolved = resolveManifest();
  const timeline = buildRecordedTimeline(resolved.manifest);
  const attestedToDate = totalAttested(resolved.manifest);
  const hashesAreLinkable = resolved.origin === 'live';

  const fallbackSnapshot =
    derivePoolSnapshotFromManifest(
      resolved.manifest,
      DOCUMENTED_RATES,
      deployments.configuredSeniorCap,
      deployments.configuredJuniorCap
    ) ?? EMPTY_SNAPSHOT;

  if (trancheWaterfallAddress === null) {
    return {
      snapshot: fallbackSnapshot,
      snapshotOrigin: 'manifest',
      rates: DOCUMENTED_RATES,
      structure: DOCUMENTED_STRUCTURE,
      resolved,
      timeline,
      attestedToDate,
      hashesAreLinkable,
      chainReadProblem: null
    };
  }

  try {
    const client = createCachedPoolClient(POOL_REVALIDATE_SECONDS);
    const [snapshot, structure, rates] = await Promise.all([
      readPoolSnapshot(client, trancheWaterfallAddress),
      readTrancheStructure(client, trancheWaterfallAddress),
      readTrancheRates(client, trancheWaterfallAddress)
    ]);
    if (snapshot === null) {
      return {
        snapshot: fallbackSnapshot,
        snapshotOrigin: 'manifest',
        rates: rates ?? DOCUMENTED_RATES,
        structure: structure ?? DOCUMENTED_STRUCTURE,
        resolved,
        timeline,
        attestedToDate,
        hashesAreLinkable,
        chainReadProblem: `${creditcoinCc3.name} returned a snapshot the interface could not read.`
      };
    }
    return {
      snapshot,
      snapshotOrigin: 'chain',
      rates: rates ?? DOCUMENTED_RATES,
      structure: structure ?? DOCUMENTED_STRUCTURE,
      resolved,
      timeline,
      attestedToDate,
      hashesAreLinkable,
      chainReadProblem: null
    };
  } catch (error) {
    return {
      snapshot: fallbackSnapshot,
      snapshotOrigin: 'manifest',
      rates: DOCUMENTED_RATES,
      structure: DOCUMENTED_STRUCTURE,
      resolved,
      timeline,
      attestedToDate,
      hashesAreLinkable,
      chainReadProblem: describe(error)
    };
  }
}
