'use client';

import { useEffect, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { creditcoinCc3Chain } from '@/lib/chains';
import { creditcoinCc3 } from '@/lib/networks';
import { truncateHash } from '@/lib/format';

export function WalletButton() {
  const [hasMounted, setHasMounted] = useState(false);
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const injectedConnector = connectors[0];

  if (!hasMounted) {
    return <span className="label-utility text-khmGray">Wallet</span>;
  }

  if (!isConnected || address === undefined) {
    if (injectedConnector === undefined) {
      return (
        <span className="label-utility text-khmMuted" title="No injected wallet was detected">
          No wallet detected
        </span>
      );
    }
    return (
      <button
        className="label-utility text-khmDark transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:text-khmMuted"
        disabled={isPending}
        onClick={() => connect({ connector: injectedConnector })}
        type="button"
      >
        {isPending ? 'Connecting…' : 'Connect wallet'}
      </button>
    );
  }

  if (chainId !== creditcoinCc3Chain.id) {
    return (
      <span className="flex items-center gap-3">
        <button
          className="label-utility text-khmAlert transition-opacity hover:opacity-70"
          onClick={() => switchChain({ chainId: creditcoinCc3Chain.id })}
          type="button"
        >
          Switch to {creditcoinCc3.shortName}
        </button>
        <button
          className="label-utility text-khmGray transition-opacity hover:opacity-70"
          onClick={() => disconnect()}
          type="button"
        >
          Disconnect
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-3">
      <span className="hash-mono text-khmDark" title={address}>
        {truncateHash(address)}
      </span>
      <button
        className="label-utility text-khmGray transition-opacity hover:opacity-70"
        onClick={() => disconnect()}
        type="button"
      >
        Disconnect
      </button>
    </span>
  );
}
