import {
  FIXTURE_BANNER_BODY,
  FIXTURE_BANNER_HEADLINE,
  NOT_DEPLOYED_BODY,
  NOT_DEPLOYED_HEADLINE
} from '@/lib/copy';
import type { ManifestOrigin } from '@/lib/manifest';

interface ProvenanceNoticeProps {
  manifestOrigin: ManifestOrigin;
  manifestSourcePath: string;
  isContractDeployed: boolean;
}

export function ProvenanceNotice({
  manifestOrigin,
  manifestSourcePath,
  isContractDeployed
}: ProvenanceNoticeProps) {
  if (manifestOrigin === 'live' && isContractDeployed) return null;

  return (
    <aside
      aria-label="Data provenance"
      className="w-full border-b border-khmAlert/40 bg-[#f9f8f4]"
    >
      <div className="mx-auto flex w-full max-w-container flex-col gap-2 px-6 py-4 md:px-12">
        <p className="label-utility text-khmAlert">
          {isContractDeployed ? FIXTURE_BANNER_HEADLINE : NOT_DEPLOYED_HEADLINE} — nothing on
          this screen is a record of a transaction
        </p>
        {!isContractDeployed ? (
          <p className="max-w-[92ch] text-[15px] leading-snug text-khmDark">
            {NOT_DEPLOYED_BODY}
          </p>
        ) : null}
        <p className="max-w-[92ch] text-[15px] leading-snug text-khmDark">
          {FIXTURE_BANNER_BODY}
        </p>
        <p className="label-utility text-khmGray">Source · {manifestSourcePath}</p>
      </div>
    </aside>
  );
}
