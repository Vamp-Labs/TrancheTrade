import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { HashLink } from '@/components/HashLink';
import { RejectionBeat } from '@/components/RejectionBeat';
import { StatusBadge, type StatusBadgeVariant } from '@/components/StatusBadge';
import { ALLOCATION_NATURE_SENTENCE, SYNTHETIC_DATA_DISCLOSURE } from '@/lib/copy';
import { formatTimestamp, formatTokenAmount } from '@/lib/format';
import { resolveManifest } from '@/lib/manifest';
import type { AttestationStatus, ManifestCycle } from '@/lib/manifest-schema';
import { creditcoinCc3, networkForChainId } from '@/lib/networks';

const ATTESTATION_BADGE: Record<AttestationStatus, { variant: StatusBadgeVariant; copy: string }> =
  {
    pending: { variant: 'pending', copy: 'Awaiting attestation' },
    attested: { variant: 'allocated', copy: 'Attested' },
    failed: { variant: 'failed', copy: 'Attestation failed' },
    corrupted: { variant: 'rejected', copy: 'Corrupted proof' }
  };

export function generateStaticParams() {
  const resolved = resolveManifest();
  return resolved.manifest.cycles.map((cycle) => ({ cycleId: cycle.id }));
}

interface HopProps {
  index: string;
  title: string;
  amountLabel: string;
  amount: bigint;
  children: ReactNode;
}

function Hop({ index, title, amountLabel, amount, children }: HopProps) {
  return (
    <article className="border-t border-khmBorder py-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="md:col-span-3">
          <span aria-hidden="true" className="font-serif text-[2rem] leading-none text-khmGray">
            {index}
          </span>
          <p className="label-utility mt-3 text-khmDark">{title}</p>
        </div>
        <div className="md:col-span-5">{children}</div>
        <div className="md:col-span-4 md:text-right">
          <p className="label-utility text-khmGray">{amountLabel}</p>
          <p className="figure-md mt-2 text-khmDark">
            {formatTokenAmount(amount)} {creditcoinCc3.currencySymbol}
          </p>
        </div>
      </div>
    </article>
  );
}

interface DetailRowProps {
  label: string;
  children: ReactNode;
}

function DetailRow({ label, children }: DetailRowProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-1">
      <span className="label-utility w-[17ch] shrink-0 text-khmGray">{label}</span>
      <span className="text-[15px] text-khmDark">{children}</span>
    </div>
  );
}

function AllocationSummary({ cycle }: { cycle: ManifestCycle }) {
  const allocation = cycle.allocation;
  if (allocation === null) return null;
  return (
    <div className="border border-khmPositive/30 bg-khmPositiveBg p-8">
      <p className="label-utility text-khmPositive">Allocated</p>
      <div className="mt-6">
        <DetailRow label="Senior allocation">
          <span className="figure-sm">
            {formatTokenAmount(BigInt(allocation.seniorAllocation))}
          </span>
        </DetailRow>
        <DetailRow label="Junior allocation">
          <span className="figure-sm">
            {formatTokenAmount(BigInt(allocation.juniorAllocation))}
          </span>
        </DetailRow>
        <DetailRow label="Senior outstanding">
          <span className="figure-sm">
            {formatTokenAmount(BigInt(allocation.seniorOutstandingBefore))} to{' '}
            {formatTokenAmount(BigInt(allocation.seniorOutstandingAfter))}
          </span>
        </DetailRow>
        <DetailRow label="Junior outstanding">
          <span className="figure-sm">
            {formatTokenAmount(BigInt(allocation.juniorOutstandingBefore))} to{' '}
            {formatTokenAmount(BigInt(allocation.juniorOutstandingAfter))}
          </span>
        </DetailRow>
      </div>
    </div>
  );
}

export default async function CycleTracePage({
  params
}: {
  params: Promise<{ cycleId: string }>;
}) {
  const { cycleId } = await params;
  const resolved = resolveManifest();
  const cycle = resolved.manifest.cycles.find((entry) => entry.id === cycleId);
  if (cycle === undefined) notFound();

  const hashesAreLinkable = resolved.origin === 'live';
  const sourceNetwork = networkForChainId(cycle.source.chainId);
  const destinationNetwork = networkForChainId(cycle.destination.chainId);
  const attestationBadge = ATTESTATION_BADGE[cycle.attestation.status];
  const settlementAmount =
    cycle.allocation === null
      ? BigInt(cycle.source.amount)
      : BigInt(cycle.allocation.attestedAmount);

  return (
    <section
      aria-label={`Cycle ${cycle.id}`}
      className="mx-auto w-full max-w-container px-6 pb-16 md:px-12 md:pb-24"
    >
      <div className="grid grid-cols-1 items-baseline gap-6 pb-16 md:grid-cols-12 md:pb-24">
        <div className="md:col-span-3 md:pt-6">
          <Link
            className="text-[15px] text-khmDark transition-opacity hover:opacity-70"
            href="/activity"
          >
            Audit trail
          </Link>
          <p className="label-utility mt-3 text-khmGray">{cycle.id}</p>
          <p className="label-utility mt-3 text-khmGray">{SYNTHETIC_DATA_DISCLOSURE}</p>
        </div>
        <h1 className="main-title font-serif text-khmDark md:col-span-6">One trace.</h1>
        <div className="text-left md:col-span-3 md:pt-6 md:text-right">
          <p className="label-utility text-khmGray">Recorded</p>
          <p className="figure-md mt-3 text-khmDark">{formatTimestamp(cycle.occurredAt)}</p>
          <p className="label-utility mt-3 text-khmGray">{cycle.label}</p>
        </div>
      </div>

      <Hop
        amount={BigInt(cycle.source.amount)}
        amountLabel="Repayment amount on the source chain"
        index="1"
        title={sourceNetwork === null ? `Chain ${cycle.source.chainId}` : sourceNetwork.name}
      >
        <DetailRow label="Event">{cycle.source.event}</DetailRow>
        <DetailRow label="Invoice">{cycle.invoiceId}</DetailRow>
        <DetailRow label="Block">{cycle.source.blockNumber}</DetailRow>
        <DetailRow label="Log index">{cycle.source.logIndex}</DetailRow>
        <DetailRow label="Transaction">
          <HashLink
            chainId={cycle.source.chainId}
            explorerUrl={cycle.source.explorerUrl}
            hash={cycle.source.txHash}
            linkable={hashesAreLinkable}
          />
        </DetailRow>
      </Hop>

      <Hop
        amount={BigInt(cycle.source.amount)}
        amountLabel="Amount carried by the attestation"
        index="2"
        title="Attestcoin attestation"
      >
        <DetailRow label="Status">
          <StatusBadge variant={attestationBadge.variant}>{attestationBadge.copy}</StatusBadge>
        </DetailRow>
        <DetailRow label="Attestation id">
          <span className="hash-mono">{cycle.attestation.attestationId}</span>
        </DetailRow>
        <DetailRow label="Chain key">{cycle.attestation.chainKey}</DetailRow>
        <DetailRow label="Attested height">{cycle.attestation.attestedHeight}</DetailRow>
        <DetailRow label="Continuity hashes">{cycle.attestation.continuityHashCount}</DetailRow>
        <DetailRow label="Cached">{cycle.attestation.cached ? 'yes' : 'no'}</DetailRow>
        {cycle.attestation.corruptionMode === null ? null : (
          <DetailRow label="Corruption mode">{cycle.attestation.corruptionMode}</DetailRow>
        )}
      </Hop>

      <Hop
        amount={settlementAmount}
        amountLabel="Attested amount applied on the settlement chain"
        index="3"
        title={
          destinationNetwork === null
            ? `Chain ${cycle.destination.chainId}`
            : destinationNetwork.name
        }
      >
        <DetailRow label="Result">
          {cycle.destination.status === 'reverted' ? 'reverted' : 'success'}
        </DetailRow>
        <DetailRow label="Block">{cycle.destination.blockNumber}</DetailRow>
        <DetailRow label="Transaction">
          <HashLink
            chainId={cycle.destination.chainId}
            explorerUrl={cycle.destination.explorerUrl}
            hash={cycle.destination.txHash}
            linkable={hashesAreLinkable}
          />
        </DetailRow>
      </Hop>

      <div className="mt-12">
        {cycle.rejection === null ? (
          <AllocationSummary cycle={cycle} />
        ) : (
          <RejectionBeat
            attestationId={cycle.attestation.attestationId}
            destinationChainId={cycle.destination.chainId}
            destinationExplorerUrl={cycle.destination.explorerUrl}
            destinationTxHash={cycle.destination.txHash}
            hashIsLinkable={hashesAreLinkable}
            juniorOutstandingAfter={cycle.rejection.juniorOutstandingAfter}
            juniorOutstandingBefore={cycle.rejection.juniorOutstandingBefore}
            reason={cycle.rejection.reason}
            revertData={cycle.rejection.revertData}
            seniorOutstandingAfter={cycle.rejection.seniorOutstandingAfter}
            seniorOutstandingBefore={cycle.rejection.seniorOutstandingBefore}
          />
        )}
      </div>

      <p className="mt-8 max-w-[72ch] text-[15px] leading-snug text-khmGray">
        {ALLOCATION_NATURE_SENTENCE}
      </p>
      <p className="label-utility mt-3 text-khmGray">Source · {resolved.sourcePath}</p>
    </section>
  );
}
