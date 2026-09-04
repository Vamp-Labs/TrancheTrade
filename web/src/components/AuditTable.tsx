import Link from 'next/link';
import { HashLink } from '@/components/HashLink';
import { StatusBadge, type StatusBadgeVariant } from '@/components/StatusBadge';
import { EMPTY_ALLOCATIONS_BODY, EMPTY_ALLOCATIONS_HEADLINE } from '@/lib/copy';
import { formatTimestamp, formatTokenAmount, truncateHash } from '@/lib/format';
import type { AttestationStatus, ManifestCycle } from '@/lib/manifest-schema';

const EM_DASH = '—';

const ATTESTATION_BADGE: Record<AttestationStatus, { variant: StatusBadgeVariant; copy: string }> =
  {
    pending: { variant: 'pending', copy: 'Awaiting attestation' },
    attested: { variant: 'allocated', copy: 'Attested' },
    failed: { variant: 'failed', copy: 'Attestation failed' },
    corrupted: { variant: 'rejected', copy: 'Corrupted proof' }
  };

interface AuditTableProps {
  cycles: readonly ManifestCycle[];
  hashesAreLinkable: boolean;
}

function resultLabel(cycle: ManifestCycle): string {
  if (cycle.rejection !== null) return `Rejected · ${cycle.rejection.reason}`;
  return 'Allocated';
}

function seniorCell(cycle: ManifestCycle): string {
  if (cycle.allocation === null) return EM_DASH;
  return formatTokenAmount(BigInt(cycle.allocation.seniorAllocation));
}

function juniorCell(cycle: ManifestCycle): string {
  if (cycle.allocation === null) return EM_DASH;
  return formatTokenAmount(BigInt(cycle.allocation.juniorAllocation));
}

function attestedCell(cycle: ManifestCycle): string {
  if (cycle.allocation !== null) {
    return formatTokenAmount(BigInt(cycle.allocation.attestedAmount));
  }
  return formatTokenAmount(BigInt(cycle.source.amount));
}

function AttestationCell({ cycle }: { cycle: ManifestCycle }) {
  const badge = ATTESTATION_BADGE[cycle.attestation.status];
  return (
    <span className="flex flex-col items-start gap-1">
      <span
        className="hash-mono text-khmGray"
        title={cycle.attestation.attestationId}
      >
        {truncateHash(cycle.attestation.attestationId)}
      </span>
      <StatusBadge variant={badge.variant}>{badge.copy}</StatusBadge>
    </span>
  );
}

export function AuditTable({ cycles, hashesAreLinkable }: AuditTableProps) {
  if (cycles.length === 0) {
    return (
      <div className="border-y border-khmBorder py-16 text-center">
        <p className="font-serif text-[20px] text-khmGray">{EMPTY_ALLOCATIONS_HEADLINE}</p>
        <p className="label-utility mt-3 text-khmGray">{EMPTY_ALLOCATIONS_BODY}</p>
      </div>
    );
  }

  return (
    <>
      <table className="hidden w-full border-collapse text-left md:table">
        <thead>
          <tr className="border-b border-khmBorder">
            <th className="label-utility pb-3 pr-6 font-normal text-khmGray" scope="col">
              When
            </th>
            <th className="label-utility pb-3 pr-6 font-normal text-khmGray" scope="col">
              Cycle
            </th>
            <th
              className="label-utility hidden pb-3 pr-6 font-normal text-khmGray lg:table-cell"
              scope="col"
            >
              Invoice
            </th>
            <th className="label-utility pb-3 pr-6 text-right font-normal text-khmGray" scope="col">
              Attested
            </th>
            <th className="label-utility pb-3 pr-6 text-right font-normal text-khmGray" scope="col">
              Senior
            </th>
            <th className="label-utility pb-3 pr-6 text-right font-normal text-khmGray" scope="col">
              Junior
            </th>
            <th className="label-utility pb-3 pr-6 font-normal text-khmGray" scope="col">
              Result
            </th>
            <th
              className="label-utility hidden pb-3 pr-6 font-normal text-khmGray lg:table-cell"
              scope="col"
            >
              Sepolia
            </th>
            <th
              className="label-utility hidden pb-3 pr-6 font-normal text-khmGray lg:table-cell"
              scope="col"
            >
              Attestation
            </th>
            <th
              className="label-utility hidden pb-3 font-normal text-khmGray lg:table-cell"
              scope="col"
            >
              Creditcoin
            </th>
          </tr>
        </thead>
        <tbody>
          {cycles.map((cycle) => {
            const isRejected = cycle.rejection !== null;
            return (
              <tr
                className="border-b border-khmBorder/60 transition-colors hover:bg-khmDark/[0.02]"
                key={cycle.id}
              >
                <td
                  className={`label-utility border-l-[3px] py-4 pl-4 pr-6 align-top text-khmGray ${
                    isRejected ? 'border-l-khmAlert' : 'border-l-transparent'
                  }`}
                >
                  {formatTimestamp(cycle.occurredAt)}
                </td>
                <td className="py-4 pr-6 align-top text-[15px]">
                  <Link
                    className="hash-link text-khmDark transition-opacity hover:opacity-70"
                    href={`/activity/${cycle.id}`}
                  >
                    {cycle.id}
                  </Link>
                  <span className="label-utility mt-1 block text-khmGray">{cycle.label}</span>
                </td>
                <td className="hidden py-4 pr-6 align-top text-[15px] text-khmDark lg:table-cell">
                  {cycle.invoiceId}
                </td>
                <td className="figure-sm py-4 pr-6 text-right align-top text-khmDark">
                  {attestedCell(cycle)}
                </td>
                <td
                  className={`figure-sm py-4 pr-6 text-right align-top ${
                    isRejected ? 'text-khmMuted' : 'text-khmDark'
                  }`}
                >
                  {seniorCell(cycle)}
                </td>
                <td
                  className={`figure-sm py-4 pr-6 text-right align-top ${
                    isRejected ? 'text-khmMuted' : 'text-khmDark'
                  }`}
                >
                  {juniorCell(cycle)}
                </td>
                <td
                  className={`label-utility py-4 pr-6 align-top ${
                    isRejected ? 'text-khmAlert' : 'text-khmPositive'
                  }`}
                >
                  {resultLabel(cycle)}
                </td>
                <td className="hidden py-4 pr-6 align-top lg:table-cell">
                  <HashLink
                    chainId={cycle.source.chainId}
                    explorerUrl={cycle.source.explorerUrl}
                    hash={cycle.source.txHash}
                    linkable={hashesAreLinkable}
                  />
                </td>
                <td className="hidden py-4 pr-6 align-top lg:table-cell">
                  <AttestationCell cycle={cycle} />
                </td>
                <td className="hidden py-4 align-top lg:table-cell">
                  <HashLink
                    chainId={cycle.destination.chainId}
                    explorerUrl={cycle.destination.explorerUrl}
                    hash={cycle.destination.txHash}
                    linkable={hashesAreLinkable}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="md:hidden">
        {cycles.map((cycle) => {
          const isRejected = cycle.rejection !== null;
          return (
            <li
              className={`border-b border-khmBorder/60 border-l-[3px] py-4 pl-4 ${
                isRejected ? 'border-l-khmAlert' : 'border-l-transparent'
              }`}
              key={cycle.id}
            >
              <div className="flex items-baseline justify-between gap-4">
                <Link
                  className="hash-link text-[15px] text-khmDark transition-opacity hover:opacity-70"
                  href={`/activity/${cycle.id}`}
                >
                  {cycle.id}
                </Link>
                <span
                  className={`label-utility ${isRejected ? 'text-khmAlert' : 'text-khmPositive'}`}
                >
                  {resultLabel(cycle)}
                </span>
              </div>
              <p className="label-utility mt-2 text-khmGray">{formatTimestamp(cycle.occurredAt)}</p>
              <p className="mt-2 text-[15px] text-khmGray">{cycle.label}</p>
              <dl className="mt-3">
                <div className="flex items-baseline justify-between gap-4 py-1">
                  <dt className="label-utility text-khmGray">Invoice</dt>
                  <dd className="figure-sm text-khmDark">{cycle.invoiceId}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-1">
                  <dt className="label-utility text-khmGray">Attested</dt>
                  <dd className="figure-sm text-khmDark">{attestedCell(cycle)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-1">
                  <dt className="label-utility text-khmGray">Senior</dt>
                  <dd className={`figure-sm ${isRejected ? 'text-khmMuted' : 'text-khmDark'}`}>
                    {seniorCell(cycle)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-1">
                  <dt className="label-utility text-khmGray">Junior</dt>
                  <dd className={`figure-sm ${isRejected ? 'text-khmMuted' : 'text-khmDark'}`}>
                    {juniorCell(cycle)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-1">
                  <dt className="label-utility text-khmGray">Sepolia</dt>
                  <dd>
                    <HashLink
                      chainId={cycle.source.chainId}
                      explorerUrl={cycle.source.explorerUrl}
                      hash={cycle.source.txHash}
                      linkable={hashesAreLinkable}
                    />
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-1">
                  <dt className="label-utility text-khmGray">Attestation</dt>
                  <dd>
                    <AttestationCell cycle={cycle} />
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-1">
                  <dt className="label-utility text-khmGray">Creditcoin</dt>
                  <dd>
                    <HashLink
                      chainId={cycle.destination.chainId}
                      explorerUrl={cycle.destination.explorerUrl}
                      hash={cycle.destination.txHash}
                      linkable={hashesAreLinkable}
                    />
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
    </>
  );
}
