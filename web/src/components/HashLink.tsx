import { EXTERNAL_LINK_MARK, truncateHash } from '@/lib/format';
import { networkForChainId, transactionUrl } from '@/lib/networks';

interface HashLinkProps {
  hash: string;
  chainId: number;
  explorerUrl?: string | null;
  linkable: boolean;
  displayText?: string;
  className?: string;
}

export function HashLink({
  hash,
  chainId,
  explorerUrl = null,
  linkable,
  displayText,
  className = ''
}: HashLinkProps) {
  const network = networkForChainId(chainId);
  const resolvedUrl = explorerUrl ?? transactionUrl(chainId, hash);
  const text = displayText ?? truncateHash(hash);

  if (!linkable || resolvedUrl === null) {
    return (
      <span
        className={`hash-mono text-khmMuted ${className}`}
        title={`${hash} — fixture value, not a real transaction`}
      >
        {text}
      </span>
    );
  }

  return (
    <a
      className={`hash-mono text-khmDark hash-link ${className}`}
      href={resolvedUrl}
      rel="noopener noreferrer"
      target="_blank"
      title={`${hash} on ${network === null ? 'the block explorer' : network.explorerName}`}
    >
      {text} {EXTERNAL_LINK_MARK}
    </a>
  );
}
