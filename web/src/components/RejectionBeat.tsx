import { HashLink } from '@/components/HashLink';
import { decodeAttestationFailure } from '@/lib/beats';
import { REJECTION_MESSAGE, REPLAY_SUPPORTING_LINE } from '@/lib/copy';
import { RIGHT_ARROW, formatTokenAmount, truncateHash } from '@/lib/format';
import type { RejectionReason } from '@/lib/manifest-schema';
import { networkForChainId } from '@/lib/networks';

export interface RejectionBeatProps {
  attestationId: string;
  reason: RejectionReason;
  revertData: string | null;
  seniorOutstandingBefore: string;
  seniorOutstandingAfter: string;
  juniorOutstandingBefore: string;
  juniorOutstandingAfter: string;
  destinationChainId: number;
  destinationTxHash: string;
  destinationExplorerUrl: string | null;
  hashIsLinkable: boolean;
}

interface HeldRowProps {
  label: string;
  before: string;
  after: string;
}

function HeldRow({ label, before, after }: HeldRowProps) {
  const beforeValue = BigInt(before);
  const afterValue = BigInt(after);
  const isUnchanged = beforeValue === afterValue;
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-1">
      <span className="label-utility w-[19ch] shrink-0 text-khmGray">{label}</span>
      <span className="figure-sm text-khmDark">{formatTokenAmount(beforeValue)}</span>
      <span aria-hidden="true" className="figure-sm text-khmMuted">
        {RIGHT_ARROW}
      </span>
      <span className="figure-sm text-khmDark">{formatTokenAmount(afterValue)}</span>
      <span className={`label-utility ${isUnchanged ? 'text-khmGray' : 'text-khmAlert'}`}>
        {isUnchanged ? 'unchanged' : 'state differs'}
      </span>
    </div>
  );
}

export function RejectionBeat({
  attestationId,
  reason,
  revertData,
  seniorOutstandingBefore,
  seniorOutstandingAfter,
  juniorOutstandingBefore,
  juniorOutstandingAfter,
  destinationChainId,
  destinationTxHash,
  destinationExplorerUrl,
  hashIsLinkable
}: RejectionBeatProps) {
  const decoded = decodeAttestationFailure(revertData);
  const decodedId = decoded === null ? attestationId : decoded.attestationId;
  const decodedReason = decoded === null || decoded.reason === null ? reason : decoded.reason;
  const network = networkForChainId(destinationChainId);
  const networkName = network === null ? `chain ${destinationChainId}` : network.name;

  return (
    <section
      aria-live="polite"
      className="border border-khmAlert/40 border-l-[3px] border-l-khmAlert bg-khmAlertBg p-8"
      role="status"
    >
      <p className="label-utility text-khmAlert">Rejected</p>

      <p className="mt-6 max-w-[62ch] text-[15px] leading-snug text-khmDark">
        {REJECTION_MESSAGE}
      </p>

      {decodedReason === 'AlreadyApplied' ? (
        <p className="mt-3 max-w-[62ch] text-[15px] leading-snug text-khmDark">
          {REPLAY_SUPPORTING_LINE}
        </p>
      ) : null}

      <p className="hash-mono mt-6 text-khmGray">
        {decoded === null
          ? `Reverted before reaching AttestationFailed: ${decodedReason}`
          : `AttestationFailed(${truncateHash(decodedId)}, ${decodedReason})`}
      </p>

      <div className="mt-8 border-t border-khmAlert/30 pt-6">
        <HeldRow
          after={seniorOutstandingAfter}
          before={seniorOutstandingBefore}
          label="Senior outstanding"
        />
        <HeldRow
          after={juniorOutstandingAfter}
          before={juniorOutstandingBefore}
          label="Junior outstanding"
        />
      </div>

      <p className="mt-8">
        <HashLink
          chainId={destinationChainId}
          className="font-sans text-[15px]"
          displayText={`Reverted transaction on ${networkName}`}
          explorerUrl={destinationExplorerUrl}
          hash={destinationTxHash}
          linkable={hashIsLinkable}
        />
      </p>
      <p className="hash-mono mt-2 text-khmGray">{truncateHash(destinationTxHash)}</p>
    </section>
  );
}
