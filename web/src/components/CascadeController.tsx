'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CascadeContext, type TrancheFigureValues } from '@/components/cascade/CascadeContext';
import { HashLink } from '@/components/HashLink';
import { RejectionBeat } from '@/components/RejectionBeat';
import { StatusBadge } from '@/components/StatusBadge';
import {
  cascadeEventFromRecordedCycle,
  type AllocationBeat,
  type CascadeEvent,
  type TrancheKey
} from '@/lib/beats';
import type { EvmAddress } from '@/lib/contracts';
import { EMPTY_ALLOCATIONS_BODY, EMPTY_ALLOCATIONS_HEADLINE } from '@/lib/copy';
import { beatEasing, interpolateBigint } from '@/lib/easing';
import { formatTokenAmount, formatTimestamp } from '@/lib/format';
import { createBrowserPoolClient, readCascadeWindow } from '@/lib/live-cascade';
import type { ManifestCycle } from '@/lib/manifest-schema';
import { creditcoinCc3, networkForChainId } from '@/lib/networks';
import type { SerializedPoolSnapshot } from '@/lib/pool';
import type { AllocatedTotalsSnapshot, TrancheStateSlice } from '@/lib/timeline';

const SWEEP_DURATION_MS = 900;
const HOLD_DURATION_MS = 300;
const REDUCED_HOLD_DURATION_MS = 700;

type BeatPhase = 'idle' | 'senior' | 'hold' | 'junior' | 'settled';

interface LiveRead {
  address: EvmAddress;
  pollIntervalMs: number;
}

export interface CascadeControllerProps {
  cycles: readonly ManifestCycle[];
  allocatedTotalsBefore: readonly AllocatedTotalsSnapshot[];
  opening: TrancheStateSlice | null;
  currentSnapshot: SerializedPoolSnapshot;
  hashesAreLinkable: boolean;
  liveRead: LiveRead | null;
  children: ReactNode;
}

function valuesFromSnapshot(snapshot: SerializedPoolSnapshot): TrancheFigureValues {
  return {
    seniorOutstanding: BigInt(snapshot.seniorOutstanding),
    juniorOutstanding: BigInt(snapshot.juniorOutstanding),
    seniorAllocatedTotal: BigInt(snapshot.seniorAllocatedTotal),
    juniorAllocatedTotal: BigInt(snapshot.juniorAllocatedTotal)
  };
}

function valuesFromSlice(slice: TrancheStateSlice): TrancheFigureValues {
  return {
    seniorOutstanding: BigInt(slice.seniorOutstanding),
    juniorOutstanding: BigInt(slice.juniorOutstanding),
    seniorAllocatedTotal: BigInt(slice.seniorAllocatedTotal),
    juniorAllocatedTotal: BigInt(slice.juniorAllocatedTotal)
  };
}

function beatFields(tranche: TrancheKey): {
  outstanding: keyof TrancheFigureValues;
  allocatedTotal: keyof TrancheFigureValues;
} {
  return tranche === 'senior'
    ? { outstanding: 'seniorOutstanding', allocatedTotal: 'seniorAllocatedTotal' }
    : { outstanding: 'juniorOutstanding', allocatedTotal: 'juniorAllocatedTotal' };
}

function announcementFor(beat: AllocationBeat, seniorOutstandingAfter: bigint): string {
  const amount = `${formatTokenAmount(beat.amount)} ${creditcoinCc3.currencySymbol}`;
  if (beat.tranche === 'senior') return `Senior allocated ${amount}`;
  if (beat.amount === 0n && seniorOutstandingAfter > 0n) {
    return `Junior allocated ${amount} — senior not yet exhausted`;
  }
  return `Junior allocated ${amount}`;
}

interface PlayedCycle {
  index: number;
  cycle: ManifestCycle;
}

export function CascadeController({
  cycles,
  allocatedTotalsBefore,
  opening,
  currentSnapshot,
  hashesAreLinkable,
  liveRead,
  children
}: CascadeControllerProps) {
  const settledValues = useMemo(() => valuesFromSnapshot(currentSnapshot), [currentSnapshot]);

  const [values, setValues] = useState<TrancheFigureValues>(settledValues);
  const [animatingTranche, setAnimatingTranche] = useState<TrancheKey | null>(null);
  const [phase, setPhase] = useState<BeatPhase>('idle');
  const [statusLines, setStatusLines] = useState<readonly string[]>([]);
  const [activeCascade, setActiveCascade] = useState<CascadeEvent | null>(null);
  const [playedCycle, setPlayedCycle] = useState<PlayedCycle | null>(null);
  const [liveEvents, setLiveEvents] = useState<readonly CascadeEvent[]>([]);

  const prefersReducedMotion = useRef(false);
  const frameRef = useRef<number | null>(null);
  const timeoutsRef = useRef<number[]>([]);
  const playedLiveKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.current = query.matches;
    const onChange = (event: MediaQueryListEvent) => {
      prefersReducedMotion.current = event.matches;
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const clearScheduled = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    for (const handle of timeoutsRef.current) window.clearTimeout(handle);
    timeoutsRef.current = [];
  }, []);

  useEffect(() => clearScheduled, [clearScheduled]);

  const schedule = useCallback((task: () => void, delayMs: number) => {
    const handle = window.setTimeout(task, delayMs);
    timeoutsRef.current.push(handle);
  }, []);

  const runBeat = useCallback(
    (
      beat: AllocationBeat,
      allocatedTotalBefore: bigint | null,
      seniorOutstandingAfter: bigint,
      onDone: () => void
    ) => {
      const fields = beatFields(beat.tranche);
      const totalBefore = allocatedTotalBefore;

      setStatusLines((lines) => [...lines, announcementFor(beat, seniorOutstandingAfter)]);

      const settle = () => {
        setValues((current) => ({
          ...current,
          [fields.outstanding]: beat.outstandingAfter,
          [fields.allocatedTotal]:
            totalBefore === null ? current[fields.allocatedTotal] : totalBefore + beat.amount
        }));
      };

      if (prefersReducedMotion.current) {
        setAnimatingTranche(null);
        settle();
        onDone();
        return;
      }

      setAnimatingTranche(beat.tranche);
      const startedAt = performance.now();

      const step = (now: number) => {
        const progress = Math.min((now - startedAt) / SWEEP_DURATION_MS, 1);
        const eased = beatEasing(progress);
        setValues((current) => ({
          ...current,
          [fields.outstanding]: interpolateBigint(
            beat.outstandingBefore,
            beat.outstandingAfter,
            eased
          ),
          [fields.allocatedTotal]:
            totalBefore === null
              ? current[fields.allocatedTotal]
              : interpolateBigint(totalBefore, totalBefore + beat.amount, eased)
        }));
        if (progress < 1) {
          frameRef.current = window.requestAnimationFrame(step);
          return;
        }
        frameRef.current = null;
        settle();
        setAnimatingTranche(null);
        onDone();
      };

      frameRef.current = window.requestAnimationFrame(step);
    },
    []
  );

  const playCascade = useCallback(
    (event: CascadeEvent, startValues: TrancheFigureValues) => {
      clearScheduled();
      setStatusLines([]);
      setActiveCascade(event);
      setValues(startValues);

      const firstBeat = event.orderedBeats[0] ?? null;
      const secondBeat = event.orderedBeats[1] ?? null;
      const seniorBeat = event.orderedBeats.find((beat) => beat.tranche === 'senior') ?? null;
      const seniorOutstandingAfter =
        seniorBeat === null ? startValues.seniorOutstanding : seniorBeat.outstandingAfter;

      const allocatedTotalBefore = (beat: AllocationBeat): bigint | null =>
        beat.tranche === 'senior'
          ? event.seniorAllocatedTotalBefore
          : event.juniorAllocatedTotalBefore;

      const settleCascade = () => {
        setPhase('settled');
      };

      const runSecondBeat = () => {
        if (secondBeat === null) {
          settleCascade();
          return;
        }
        setPhase(secondBeat.tranche);
        runBeat(
          secondBeat,
          allocatedTotalBefore(secondBeat),
          seniorOutstandingAfter,
          settleCascade
        );
      };

      const enterHold = () => {
        setPhase('hold');
        schedule(
          runSecondBeat,
          prefersReducedMotion.current ? REDUCED_HOLD_DURATION_MS : HOLD_DURATION_MS
        );
      };

      if (firstBeat === null) {
        settleCascade();
        return;
      }
      setPhase(firstBeat.tranche);
      runBeat(firstBeat, allocatedTotalBefore(firstBeat), seniorOutstandingAfter, enterHold);
    },
    [clearScheduled, runBeat, schedule]
  );

  const showRejection = useCallback(
    (cycle: ManifestCycle, index: number, startValues: TrancheFigureValues) => {
      clearScheduled();
      setActiveCascade(null);
      setAnimatingTranche(null);
      setStatusLines([]);
      setValues(startValues);
      setPhase('settled');
      setPlayedCycle({ index, cycle });
    },
    [clearScheduled]
  );

  const valuesBeforeCycle = useCallback(
    (index: number): TrancheFigureValues => {
      const cycle = cycles[index];
      const totals = allocatedTotalsBefore[index];
      if (cycle === undefined || totals === undefined) {
        return opening === null ? settledValues : valuesFromSlice(opening);
      }
      const state = cycle.allocation ?? cycle.rejection;
      if (state === null || state === undefined) {
        return opening === null ? settledValues : valuesFromSlice(opening);
      }
      return {
        seniorOutstanding: BigInt(state.seniorOutstandingBefore),
        juniorOutstanding: BigInt(state.juniorOutstandingBefore),
        seniorAllocatedTotal: BigInt(totals.senior),
        juniorAllocatedTotal: BigInt(totals.junior)
      };
    },
    [allocatedTotalsBefore, cycles, opening, settledValues]
  );

  const playRecordedCycle = useCallback(
    (index: number) => {
      const cycle = cycles[index];
      const totals = allocatedTotalsBefore[index];
      if (cycle === undefined || totals === undefined) return;
      const startValues = valuesBeforeCycle(index);

      if (cycle.kind === 'rejection') {
        showRejection(cycle, index, startValues);
        return;
      }

      const event = cascadeEventFromRecordedCycle(cycle, {
        senior: BigInt(totals.senior),
        junior: BigInt(totals.junior)
      });
      if (event === null) return;
      setPlayedCycle({ index, cycle });
      playCascade(event, startValues);
    },
    [allocatedTotalsBefore, cycles, playCascade, showRejection, valuesBeforeCycle]
  );

  const returnToCurrent = useCallback(() => {
    clearScheduled();
    setAnimatingTranche(null);
    setActiveCascade(null);
    setPlayedCycle(null);
    setStatusLines([]);
    setPhase('idle');
    setValues(settledValues);
  }, [clearScheduled, settledValues]);

  useEffect(() => {
    if (liveRead === null) return;
    const client = createBrowserPoolClient();
    let cancelled = false;
    let cursor: bigint | null = null;

    const tick = async () => {
      try {
        const window_ = await readCascadeWindow(client, liveRead.address, cursor);
        if (cancelled) return;
        cursor = window_.toBlock + 1n;
        const fresh = window_.events.filter(
          (event) => !playedLiveKeys.current.has(event.key)
        );
        if (fresh.length === 0) return;
        for (const event of fresh) playedLiveKeys.current.add(event.key);
        setLiveEvents((current) => [...current, ...fresh]);
      } catch {
        return;
      }
    };

    void tick();
    const handle = window.setInterval(() => void tick(), liveRead.pollIntervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [liveRead]);

  useEffect(() => {
    const latest = liveEvents[liveEvents.length - 1];
    if (latest === undefined) return;
    if (activeCascade !== null && activeCascade.key === latest.key) return;
    setPlayedCycle(null);
    playCascade(latest, {
      seniorOutstanding:
        latest.orderedBeats.find((beat) => beat.tranche === 'senior')?.outstandingBefore ??
        values.seniorOutstanding,
      juniorOutstanding:
        latest.orderedBeats.find((beat) => beat.tranche === 'junior')?.outstandingBefore ??
        values.juniorOutstanding,
      seniorAllocatedTotal: values.seniorAllocatedTotal,
      juniorAllocatedTotal: values.juniorAllocatedTotal
    });
  }, [liveEvents]);

  const viewState = useMemo(() => ({ values, animatingTranche }), [values, animatingTranche]);

  const nextIndex = playedCycle === null ? 0 : playedCycle.index + 1;
  const hasRecordedCycles = cycles.length > 0;
  const hasNextRecordedCycle = nextIndex < cycles.length;
  const isBusy = phase === 'senior' || phase === 'hold' || phase === 'junior';

  return (
    <CascadeContext.Provider value={viewState}>
      {children}

      <section
        aria-label="Allocation beat"
        className="mx-auto w-full max-w-container px-6 pb-16 md:px-12 md:pb-24"
        id="beat-region"
      >
        <BeatHeader
          activeCascade={activeCascade}
          hashesAreLinkable={hashesAreLinkable}
          playedCycle={playedCycle}
        />

        {playedCycle !== null && playedCycle.cycle.rejection !== null ? (
          <RejectionBeat
            attestationId={playedCycle.cycle.attestation.attestationId}
            destinationChainId={playedCycle.cycle.destination.chainId}
            destinationExplorerUrl={playedCycle.cycle.destination.explorerUrl}
            destinationTxHash={playedCycle.cycle.destination.txHash}
            hashIsLinkable={hashesAreLinkable}
            juniorOutstandingAfter={playedCycle.cycle.rejection.juniorOutstandingAfter}
            juniorOutstandingBefore={playedCycle.cycle.rejection.juniorOutstandingBefore}
            reason={playedCycle.cycle.rejection.reason}
            revertData={playedCycle.cycle.rejection.revertData}
            seniorOutstandingAfter={playedCycle.cycle.rejection.seniorOutstandingAfter}
            seniorOutstandingBefore={playedCycle.cycle.rejection.seniorOutstandingBefore}
          />
        ) : null}

        {playedCycle === null && activeCascade === null && !hasRecordedCycles ? (
          <div className="border-y border-khmBorder py-16 text-center">
            <p className="font-serif text-[20px] text-khmGray">{EMPTY_ALLOCATIONS_HEADLINE}</p>
            <p className="label-utility mt-3 text-khmGray">{EMPTY_ALLOCATIONS_BODY}</p>
          </div>
        ) : null}

        <div
          aria-live="polite"
          className="mt-6 min-h-[3.5rem] border-t border-khmBorder/60 pt-4"
          role="status"
        >
          {statusLines.map((line) => (
            <p className="figure-sm text-khmDark" key={line}>
              {line}
            </p>
          ))}
          {statusLines.length === 0 && playedCycle === null ? (
            <p className="label-utility text-khmGray">
              Beat region — one allocation cascade or one rejection, never both at once
            </p>
          ) : null}
        </div>

        {hasRecordedCycles ? (
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              className="button-secondary"
              disabled={isBusy || !hasNextRecordedCycle}
              onClick={() => playRecordedCycle(nextIndex)}
              type="button"
            >
              {playedCycle === null
                ? 'Replay recorded sequence'
                : `Play recorded cycle ${nextIndex + 1}`}
            </button>
            <button
              className="button-secondary"
              disabled={isBusy || playedCycle === null}
              onClick={returnToCurrent}
              type="button"
            >
              Return to current balances
            </button>
            <span className="label-utility text-khmGray">
              {playedCycle === null
                ? `${cycles.length} recorded cycles · balances shown are the current state`
                : `Recorded cycle ${playedCycle.index + 1} of ${cycles.length} · balances shown are that cycle's recorded state`}
            </span>
          </div>
        ) : null}
      </section>
    </CascadeContext.Provider>
  );
}

interface BeatHeaderProps {
  activeCascade: CascadeEvent | null;
  playedCycle: PlayedCycle | null;
  hashesAreLinkable: boolean;
}

function BeatHeader({ activeCascade, playedCycle, hashesAreLinkable }: BeatHeaderProps) {
  if (activeCascade === null && playedCycle === null) return null;

  const cycle = playedCycle === null ? null : playedCycle.cycle;
  const attestationId =
    activeCascade === null
      ? (cycle?.attestation.attestationId ?? '')
      : activeCascade.attestationId;
  const attestedAmount =
    activeCascade === null
      ? cycle === null
        ? null
        : BigInt(cycle.source.amount)
      : activeCascade.attestedAmount;
  const destinationChainId =
    activeCascade?.destinationChainId ?? cycle?.destination.chainId ?? creditcoinCc3.chainId;
  const destinationTxHash =
    activeCascade?.destinationTxHash ?? cycle?.destination.txHash ?? null;
  const destinationExplorerUrl =
    activeCascade?.destinationExplorerUrl ?? cycle?.destination.explorerUrl ?? null;
  const sourceChainId = activeCascade?.sourceChainId ?? cycle?.source.chainId ?? null;
  const sourceTxHash = activeCascade?.sourceTxHash ?? cycle?.source.txHash ?? null;
  const sourceExplorerUrl = activeCascade?.sourceExplorerUrl ?? cycle?.source.explorerUrl ?? null;
  const sourceNetwork = sourceChainId === null ? null : networkForChainId(sourceChainId);
  const isRejection = cycle !== null && cycle.rejection !== null;

  return (
    <div className="mb-8 border-t border-khmBorder pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-4">
          <span className="label-utility text-khmGray">Attestation</span>
          <span className="hash-mono text-khmDark" title={attestationId}>
            {attestationId === '' ? '—' : attestationId}
          </span>
          <StatusBadge variant={isRejection ? 'rejected' : 'allocated'}>
            {isRejection ? 'Rejected' : 'Allocated'}
          </StatusBadge>
        </div>
        {cycle !== null ? (
          <span className="label-utility text-khmGray">{formatTimestamp(cycle.occurredAt)}</span>
        ) : null}
      </div>

      {attestedAmount !== null ? (
        <p className="mt-4">
          <span className="label-utility text-khmGray">Attested amount</span>{' '}
          <span className="figure-md text-khmDark">
            {formatTokenAmount(attestedAmount)} {creditcoinCc3.currencySymbol}
          </span>
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2">
        {destinationTxHash !== null ? (
          <span className="flex items-baseline gap-2">
            <span className="label-utility text-khmGray">{creditcoinCc3.shortName}</span>
            <HashLink
              chainId={destinationChainId}
              explorerUrl={destinationExplorerUrl}
              hash={destinationTxHash}
              linkable={hashesAreLinkable}
            />
          </span>
        ) : null}
        {sourceTxHash !== null && sourceChainId !== null ? (
          <span className="flex items-baseline gap-2">
            <span className="label-utility text-khmGray">
              {sourceNetwork === null ? `Chain ${sourceChainId}` : sourceNetwork.shortName}
            </span>
            <HashLink
              chainId={sourceChainId}
              explorerUrl={sourceExplorerUrl}
              hash={sourceTxHash}
              linkable={hashesAreLinkable}
            />
          </span>
        ) : null}
      </div>
    </div>
  );
}
