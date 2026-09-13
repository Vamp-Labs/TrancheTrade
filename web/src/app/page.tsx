import Link from 'next/link';
import { AuditTable } from '@/components/AuditTable';
import { CascadeController } from '@/components/CascadeController';
import { DepositForm } from '@/components/DepositForm';
import { TranchePanel } from '@/components/TranchePanel';
import { trancheWaterfallAddress } from '@/lib/contracts';
import {
  ALLOCATION_NATURE_SENTENCE,
  JUNIOR_SENTENCE,
  ORIGINALITY_CLAIM,
  SENIOR_SENTENCE,
  SYNTHETIC_DATA_DISCLOSURE,
  TRANCHE_STRUCTURE_SUFFIX
} from '@/lib/copy';
import { formatTokenAmount } from '@/lib/format';
import { creditcoinCc3, ethereumSepolia } from '@/lib/networks';
import { LIVE_POLL_INTERVAL_MS, serializePoolSnapshot } from '@/lib/pool';
import { loadPoolView } from '@/lib/pool-view';
import { cyclesNewestFirst } from '@/lib/manifest';

export const revalidate = 15;

export default async function PoolPage() {
  const view = await loadPoolView();
  const snapshot = serializePoolSnapshot(view.snapshot);
  const recentCycles = cyclesNewestFirst(view.resolved.manifest).slice(0, 5);

  return (
    <>
      <section className="mx-auto grid w-full max-w-container grid-cols-1 items-baseline gap-6 px-6 pb-16 md:grid-cols-12 md:px-12 md:pb-24">
        <div className="md:col-span-3 md:pt-6">
          <p className="label-utility text-khmGray">Pool reference</p>
          <p className="mt-3 text-lg font-normal leading-tight tracking-normal text-khmDark md:text-xl">
            Synthetic invoice pool · {ethereumSepolia.name} to {creditcoinCc3.name}
          </p>
          <p className="label-utility mt-3 text-khmGray">{SYNTHETIC_DATA_DISCLOSURE}</p>
        </div>

        <h1 className="md:col-span-6">
          <span className="main-title block font-serif text-khmDark">Senior first,</span>
          <span className="main-title -mt-1 block font-serif text-khmDark">
            then junior.
          </span>
        </h1>

        <div className="text-left md:col-span-3 md:pt-6 md:text-right">
          <p className="label-utility text-khmGray">Attested to date</p>
          <p className="figure-md mt-3 text-khmDark">
            {formatTokenAmount(view.attestedToDate)} {creditcoinCc3.currencySymbol}
          </p>
          <p className="label-utility mt-3 text-khmGray">
            Balances read from {view.snapshotOrigin === 'chain' ? creditcoinCc3.name : 'the recorded manifest'}
          </p>
        </div>
      </section>

      <CascadeController
        allocatedTotalsBefore={view.timeline.allocatedTotalsBefore}
        currentSnapshot={snapshot}
        cycles={view.timeline.cycles}
        hashesAreLinkable={view.hashesAreLinkable}
        liveRead={
          trancheWaterfallAddress === null
            ? null
            : { address: trancheWaterfallAddress, pollIntervalMs: LIVE_POLL_INTERVAL_MS }
        }
        opening={view.timeline.opening}
      >
        <section
          aria-label="Tranche structure"
          className="mx-auto w-full max-w-container px-6 pb-12 md:px-12"
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <TranchePanel
              allocatedTotal={snapshot.seniorAllocatedTotal}
              cap={view.snapshot.seniorCap}
              label="Senior"
              ordinal="I"
              outstanding={snapshot.seniorOutstanding}
              principal={view.snapshot.seniorPrincipal}
              rateBps={view.rates.seniorRateBps}
              sentence={SENIOR_SENTENCE}
              tranche="senior"
            />
            <TranchePanel
              allocatedTotal={snapshot.juniorAllocatedTotal}
              cap={view.snapshot.juniorCap}
              label="Junior"
              ordinal="II"
              outstanding={snapshot.juniorOutstanding}
              principal={view.snapshot.juniorPrincipal}
              rateBps={view.rates.juniorRateBps}
              sentence={JUNIOR_SENTENCE}
              tranche="junior"
            />
          </div>

          <p className="label-utility mt-8 text-khmGray">
            Tranche structure — {view.structure.count} of {view.structure.count} ·{' '}
            {TRANCHE_STRUCTURE_SUFFIX}
          </p>
          <p className="label-utility mt-2 text-khmMuted">
            {view.structure.origin === 'chain'
              ? `Count read from trancheCount() on ${creditcoinCc3.name}`
              : 'Count taken from the frozen contract interface; no deployed contract to read yet'}
          </p>
        </section>
      </CascadeController>

      <DepositForm
        juniorRateBps={view.rates.juniorRateBps.toString()}
        seniorRateBps={view.rates.seniorRateBps.toString()}
        waterfallAddress={trancheWaterfallAddress}
      />

      <section
        aria-label="Recent activity"
        className="mx-auto w-full max-w-container px-6 pb-16 md:px-12 md:pb-24"
      >
        <div className="flex items-baseline justify-between gap-6 border-t border-khmBorder pt-6">
          <h2 className="label-utility text-khmDark">Recent activity</h2>
          <Link
            className="text-[15px] text-khmDark transition-opacity hover:opacity-70"
            href="/activity"
          >
            Full audit trail
          </Link>
        </div>
        <div className="mt-8">
          <AuditTable cycles={recentCycles} hashesAreLinkable={view.hashesAreLinkable} />
        </div>
        <p className="mt-8 max-w-[72ch] text-[15px] leading-snug text-khmGray">
          {ALLOCATION_NATURE_SENTENCE}
        </p>
        <p className="mt-3 max-w-[72ch] text-[15px] leading-snug text-khmGray">
          {ORIGINALITY_CLAIM}
        </p>
      </section>
    </>
  );
}
