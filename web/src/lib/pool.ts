import type { PublicClient } from 'viem';
import protocol from '@config/protocol.json';
import { trancheWaterfallAbi, type EvmAddress } from '@/lib/contracts';
import { reverseRateBps } from '@/lib/format';
import type { TransactionManifest } from '@/lib/manifest-schema';

export interface PoolSnapshot {
  seniorOutstanding: bigint;
  juniorOutstanding: bigint;
  seniorPrincipal: bigint;
  juniorPrincipal: bigint;
  seniorAllocatedTotal: bigint;
  juniorAllocatedTotal: bigint;
  seniorCap: bigint;
  juniorCap: bigint;
}

export type SerializedPoolSnapshot = Record<keyof PoolSnapshot, string>;

export interface InvestorPosition {
  senior: bigint;
  junior: bigint;
}

export type PoolOrigin = 'chain' | 'manifest';

export interface TrancheRates {
  seniorRateBps: bigint;
  juniorRateBps: bigint;
  origin: 'chain' | 'documented';
}

export interface TrancheStructure {
  count: number;
  origin: 'chain' | 'documented';
}

export const DOCUMENTED_RATES: TrancheRates = {
  seniorRateBps: BigInt(protocol.documentedSeniorRateBps),
  juniorRateBps: BigInt(protocol.documentedJuniorRateBps),
  origin: 'documented'
};

export const DOCUMENTED_STRUCTURE: TrancheStructure = {
  count: protocol.documentedTrancheCount,
  origin: 'documented'
};

export const LIVE_POLL_INTERVAL_MS = protocol.livePollIntervalMs;

export function serializePoolSnapshot(snapshot: PoolSnapshot): SerializedPoolSnapshot {
  return {
    seniorOutstanding: snapshot.seniorOutstanding.toString(),
    juniorOutstanding: snapshot.juniorOutstanding.toString(),
    seniorPrincipal: snapshot.seniorPrincipal.toString(),
    juniorPrincipal: snapshot.juniorPrincipal.toString(),
    seniorAllocatedTotal: snapshot.seniorAllocatedTotal.toString(),
    juniorAllocatedTotal: snapshot.juniorAllocatedTotal.toString(),
    seniorCap: snapshot.seniorCap.toString(),
    juniorCap: snapshot.juniorCap.toString()
  };
}

export function deserializePoolSnapshot(snapshot: SerializedPoolSnapshot): PoolSnapshot {
  return {
    seniorOutstanding: BigInt(snapshot.seniorOutstanding),
    juniorOutstanding: BigInt(snapshot.juniorOutstanding),
    seniorPrincipal: BigInt(snapshot.seniorPrincipal),
    juniorPrincipal: BigInt(snapshot.juniorPrincipal),
    seniorAllocatedTotal: BigInt(snapshot.seniorAllocatedTotal),
    juniorAllocatedTotal: BigInt(snapshot.juniorAllocatedTotal),
    seniorCap: BigInt(snapshot.seniorCap),
    juniorCap: BigInt(snapshot.juniorCap)
  };
}

function asBigintList(value: unknown): readonly bigint[] | null {
  if (!Array.isArray(value)) return null;
  const items: readonly unknown[] = value;
  const result: bigint[] = [];
  for (const item of items) {
    if (typeof item !== 'bigint') return null;
    result.push(item);
  }
  return result;
}

export async function readPoolSnapshot(
  client: PublicClient,
  address: EvmAddress
): Promise<PoolSnapshot | null> {
  const raw = await client.readContract({
    address,
    abi: trancheWaterfallAbi,
    functionName: 'snapshot'
  });
  const values = asBigintList(raw);
  if (values === null || values.length !== 8) return null;
  const [
    seniorOutstanding,
    juniorOutstanding,
    seniorPrincipal,
    juniorPrincipal,
    seniorAllocatedTotal,
    juniorAllocatedTotal,
    seniorCap,
    juniorCap
  ] = values;
  if (
    seniorOutstanding === undefined ||
    juniorOutstanding === undefined ||
    seniorPrincipal === undefined ||
    juniorPrincipal === undefined ||
    seniorAllocatedTotal === undefined ||
    juniorAllocatedTotal === undefined ||
    seniorCap === undefined ||
    juniorCap === undefined
  ) {
    return null;
  }
  return {
    seniorOutstanding,
    juniorOutstanding,
    seniorPrincipal,
    juniorPrincipal,
    seniorAllocatedTotal,
    juniorAllocatedTotal,
    seniorCap,
    juniorCap
  };
}

export async function readTrancheStructure(
  client: PublicClient,
  address: EvmAddress
): Promise<TrancheStructure | null> {
  const raw = await client.readContract({
    address,
    abi: trancheWaterfallAbi,
    functionName: 'trancheCount'
  });
  if (typeof raw !== 'bigint') return null;
  return { count: Number(raw), origin: 'chain' };
}

export async function readTrancheRates(
  client: PublicClient,
  address: EvmAddress
): Promise<TrancheRates | null> {
  const [senior, junior] = await Promise.all([
    client.readContract({ address, abi: trancheWaterfallAbi, functionName: 'SENIOR_RATE_BPS' }),
    client.readContract({ address, abi: trancheWaterfallAbi, functionName: 'JUNIOR_RATE_BPS' })
  ]);
  if (typeof senior !== 'bigint' || typeof junior !== 'bigint') return null;
  return { seniorRateBps: senior, juniorRateBps: junior, origin: 'chain' };
}

export async function readInvestorPosition(
  client: PublicClient,
  address: EvmAddress,
  investor: EvmAddress
): Promise<InvestorPosition | null> {
  const raw = await client.readContract({
    address,
    abi: trancheWaterfallAbi,
    functionName: 'positionOf',
    args: [investor]
  });
  const values = asBigintList(raw);
  if (values === null || values.length !== 2) return null;
  const [senior, junior] = values;
  if (senior === undefined || junior === undefined) return null;
  return { senior, junior };
}

export function derivePoolSnapshotFromManifest(
  manifest: TransactionManifest,
  rates: TrancheRates,
  configuredSeniorCap: bigint | null,
  configuredJuniorCap: bigint | null
): PoolSnapshot | null {
  const ordered = [...manifest.cycles].sort((left, right) =>
    left.occurredAt.localeCompare(right.occurredAt)
  );
  const first = ordered[0];
  if (first === undefined) return null;

  const firstState = first.allocation ?? first.rejection;
  if (firstState === null || firstState === undefined) return null;

  let seniorOutstanding = BigInt(firstState.seniorOutstandingBefore);
  let juniorOutstanding = BigInt(firstState.juniorOutstandingBefore);
  const initialSeniorOutstanding = seniorOutstanding;
  const initialJuniorOutstanding = juniorOutstanding;
  let seniorAllocatedTotal = 0n;
  let juniorAllocatedTotal = 0n;

  for (const cycle of ordered) {
    const state = cycle.allocation ?? cycle.rejection;
    if (state === null) continue;
    seniorOutstanding = BigInt(state.seniorOutstandingAfter);
    juniorOutstanding = BigInt(state.juniorOutstandingAfter);
    if (cycle.allocation !== null) {
      seniorAllocatedTotal += BigInt(cycle.allocation.seniorAllocation);
      juniorAllocatedTotal += BigInt(cycle.allocation.juniorAllocation);
    }
  }

  const seniorPrincipal = reverseRateBps(initialSeniorOutstanding, rates.seniorRateBps);
  const juniorPrincipal = reverseRateBps(initialJuniorOutstanding, rates.juniorRateBps);

  return {
    seniorOutstanding,
    juniorOutstanding,
    seniorPrincipal,
    juniorPrincipal,
    seniorAllocatedTotal,
    juniorAllocatedTotal,
    seniorCap: configuredSeniorCap ?? seniorPrincipal,
    juniorCap: configuredJuniorCap ?? juniorPrincipal
  };
}
