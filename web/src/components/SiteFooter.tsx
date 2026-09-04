import { deployments, type DeployedContract } from '@/lib/contracts';
import { FOOTER_DISCLOSURE } from '@/lib/copy';
import { EXTERNAL_LINK_MARK, truncateHash } from '@/lib/format';
import { addressUrl, networkForChainId } from '@/lib/networks';

function ContractReference({ contract }: { contract: DeployedContract }) {
  const network = networkForChainId(contract.chainId);
  const networkLabel = network === null ? `chain ${contract.chainId}` : network.shortName;

  if (contract.address === null) {
    return (
      <span className="label-utility text-khmMuted">
        {contract.name} · {networkLabel} · not yet deployed
      </span>
    );
  }

  const url = addressUrl(contract.chainId, contract.address);

  return (
    <span className="label-utility text-khmGray">
      {contract.name} · {networkLabel} ·{' '}
      {url === null ? (
        <span className="hash-mono">{truncateHash(contract.address)}</span>
      ) : (
        <a
          className="hash-mono hash-link text-khmDark"
          href={url}
          rel="noopener noreferrer"
          target="_blank"
          title={contract.address}
        >
          {truncateHash(contract.address)} {EXTERNAL_LINK_MARK}
        </a>
      )}
    </span>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto w-full border-t border-khmBorder/60">
      <div className="mx-auto flex w-full max-w-container flex-col gap-3 px-6 py-6 md:flex-row md:items-baseline md:justify-between md:px-12">
        <div className="flex flex-col gap-2 md:flex-row md:gap-6">
          <ContractReference contract={deployments.invoiceRegistry} />
          <ContractReference contract={deployments.attestcoinVerifier} />
          <ContractReference contract={deployments.trancheWaterfall} />
        </div>
        <p className="label-utility max-w-[52ch] text-khmGray">{FOOTER_DISCLOSURE}</p>
      </div>
    </footer>
  );
}
