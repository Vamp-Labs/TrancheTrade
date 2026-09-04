'use client';

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http, injected } from 'wagmi';
import { creditcoinCc3Chain } from '@/lib/chains';
import { creditcoinCc3 } from '@/lib/networks';

export const wagmiConfig = createConfig({
  chains: [creditcoinCc3Chain],
  connectors: [injected({ shimDisconnect: true })],
  transports: { [creditcoinCc3Chain.id]: http(creditcoinCc3.rpcUrl) },
  ssr: true
});

const queryClient = new QueryClient();

export function WalletProviders({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
