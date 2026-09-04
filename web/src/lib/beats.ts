import { decodeErrorResult, decodeEventLog, type Log } from 'viem';
import { trancheWaterfallAbi } from '@/lib/contracts';
import {
  REJECTION_REASONS_BY_ORDINAL,
  type ManifestCycle,
  type RejectionReason
} from '@/lib/manifest-schema';

export type TrancheKey = 'senior' | 'junior';

export interface AllocationBeat {
  tranche: TrancheKey;
  logIndex: number;
  amount: bigint;
  outstandingBefore: bigint;
  outstandingAfter: bigint;
}

export type BeatDerivation = 'event-log-order' | 'recorded-cycle-order';

export interface CascadeEvent {
  key: string;
  attestationId: string;
  invoiceId: string | null;
  attestedAmount: bigint;
  orderedBeats: readonly AllocationBeat[];
  seniorAllocatedTotalBefore: bigint | null;
  juniorAllocatedTotalBefore: bigint | null;
  derivation: BeatDerivation;
  destinationChainId: number | null;
  destinationTxHash: string | null;
  sourceChainId: number | null;
  sourceTxHash: string | null;
  destinationExplorerUrl: string | null;
  sourceExplorerUrl: string | null;
  label: string | null;
}

export interface SerializedAllocationBeat {
  tranche: TrancheKey;
  logIndex: number;
  amount: string;
  outstandingBefore: string;
  outstandingAfter: string;
}

export interface SerializedCascadeEvent {
  key: string;
  attestationId: string;
  invoiceId: string | null;
  attestedAmount: string;
  orderedBeats: readonly SerializedAllocationBeat[];
  seniorAllocatedTotalBefore: string | null;
  juniorAllocatedTotalBefore: string | null;
  derivation: BeatDerivation;
  destinationChainId: number | null;
  destinationTxHash: string | null;
  sourceChainId: number | null;
  sourceTxHash: string | null;
  destinationExplorerUrl: string | null;
  sourceExplorerUrl: string | null;
  label: string | null;
}

export function serializeCascadeEvent(event: CascadeEvent): SerializedCascadeEvent {
  return {
    ...event,
    attestedAmount: event.attestedAmount.toString(),
    seniorAllocatedTotalBefore: event.seniorAllocatedTotalBefore?.toString() ?? null,
    juniorAllocatedTotalBefore: event.juniorAllocatedTotalBefore?.toString() ?? null,
    orderedBeats: event.orderedBeats.map((beat) => ({
      tranche: beat.tranche,
      logIndex: beat.logIndex,
      amount: beat.amount.toString(),
      outstandingBefore: beat.outstandingBefore.toString(),
      outstandingAfter: beat.outstandingAfter.toString()
    }))
  };
}

export function deserializeCascadeEvent(event: SerializedCascadeEvent): CascadeEvent {
  return {
    ...event,
    attestedAmount: BigInt(event.attestedAmount),
    seniorAllocatedTotalBefore:
      event.seniorAllocatedTotalBefore === null
        ? null
        : BigInt(event.seniorAllocatedTotalBefore),
    juniorAllocatedTotalBefore:
      event.juniorAllocatedTotalBefore === null
        ? null
        : BigInt(event.juniorAllocatedTotalBefore),
    orderedBeats: event.orderedBeats.map((beat) => ({
      tranche: beat.tranche,
      logIndex: beat.logIndex,
      amount: BigInt(beat.amount),
      outstandingBefore: BigInt(beat.outstandingBefore),
      outstandingAfter: BigInt(beat.outstandingAfter)
    }))
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readBigint(source: Record<string, unknown>, key: string): bigint | null {
  const value = source[key];
  return typeof value === 'bigint' ? value : null;
}

interface DecodedTrancheLog {
  eventName: string;
  logIndex: number;
  amount: bigint;
  outstandingAfter: bigint;
  attestationId: string;
}

function decodeTrancheLog(log: Log): DecodedTrancheLog | null {
  if (log.logIndex === null) return null;
  let decoded: { eventName: string; args: unknown };
  try {
    decoded = decodeEventLog({
      abi: trancheWaterfallAbi,
      data: log.data,
      topics: log.topics
    });
  } catch {
    return null;
  }
  if (decoded.eventName !== 'SeniorAllocated' && decoded.eventName !== 'JuniorAllocated') {
    return null;
  }
  const args = asRecord(decoded.args);
  if (args === null) return null;
  const amount = readBigint(args, 'amount');
  const attestationId = args['attestationId'];
  const outstandingAfter =
    decoded.eventName === 'SeniorAllocated'
      ? readBigint(args, 'seniorOutstandingAfter')
      : readBigint(args, 'juniorOutstandingAfter');
  if (amount === null || outstandingAfter === null || typeof attestationId !== 'string') {
    return null;
  }
  return {
    eventName: decoded.eventName,
    logIndex: log.logIndex,
    amount,
    outstandingAfter,
    attestationId
  };
}

export function deriveBeatsFromEventLogOrder(logs: readonly Log[]): readonly AllocationBeat[] {
  const decoded = logs
    .map(decodeTrancheLog)
    .filter((entry): entry is DecodedTrancheLog => entry !== null)
    .sort((left, right) => left.logIndex - right.logIndex);

  return decoded.map((entry) => ({
    tranche: entry.eventName === 'SeniorAllocated' ? 'senior' : 'junior',
    logIndex: entry.logIndex,
    amount: entry.amount,
    outstandingBefore: entry.outstandingAfter + entry.amount,
    outstandingAfter: entry.outstandingAfter
  }));
}

export interface AllocatedTotalsBefore {
  senior: bigint;
  junior: bigint;
}

export function cascadeEventFromRecordedCycle(
  cycle: ManifestCycle,
  allocatedTotalsBefore: AllocatedTotalsBefore | null = null
): CascadeEvent | null {
  const allocation = cycle.allocation;
  if (allocation === null) return null;
  return {
    key: cycle.id,
    attestationId: cycle.attestation.attestationId,
    invoiceId: cycle.invoiceId,
    attestedAmount: BigInt(allocation.attestedAmount),
    seniorAllocatedTotalBefore: allocatedTotalsBefore?.senior ?? null,
    juniorAllocatedTotalBefore: allocatedTotalsBefore?.junior ?? null,
    derivation: 'recorded-cycle-order',
    orderedBeats: [
      {
        tranche: 'senior',
        logIndex: 0,
        amount: BigInt(allocation.seniorAllocation),
        outstandingBefore: BigInt(allocation.seniorOutstandingBefore),
        outstandingAfter: BigInt(allocation.seniorOutstandingAfter)
      },
      {
        tranche: 'junior',
        logIndex: 1,
        amount: BigInt(allocation.juniorAllocation),
        outstandingBefore: BigInt(allocation.juniorOutstandingBefore),
        outstandingAfter: BigInt(allocation.juniorOutstandingAfter)
      }
    ],
    destinationChainId: cycle.destination.chainId,
    destinationTxHash: cycle.destination.txHash,
    sourceChainId: cycle.source.chainId,
    sourceTxHash: cycle.source.txHash,
    destinationExplorerUrl: cycle.destination.explorerUrl,
    sourceExplorerUrl: cycle.source.explorerUrl,
    label: cycle.label
  };
}

export interface DecodedAttestationFailure {
  attestationId: string;
  reason: RejectionReason | null;
  reasonOrdinal: number | null;
}

export function decodeAttestationFailure(
  revertData: string | null
): DecodedAttestationFailure | null {
  if (revertData === null || !revertData.startsWith('0x')) return null;
  let decoded: { errorName: string; args: unknown };
  try {
    decoded = decodeErrorResult({
      abi: trancheWaterfallAbi,
      data: revertData as `0x${string}`
    });
  } catch {
    return null;
  }
  if (decoded.errorName !== 'AttestationFailed') return null;
  if (!Array.isArray(decoded.args)) return null;
  const args: readonly unknown[] = decoded.args;
  const attestationId = args[0];
  const reasonValue = args[1];
  if (typeof attestationId !== 'string') return null;
  const ordinal =
    typeof reasonValue === 'number'
      ? reasonValue
      : typeof reasonValue === 'bigint'
        ? Number(reasonValue)
        : null;
  const reason = ordinal === null ? null : (REJECTION_REASONS_BY_ORDINAL[ordinal] ?? null);
  return { attestationId, reason, reasonOrdinal: ordinal };
}
