import { createPublicClient, defineChain, http, type PublicClient } from 'viem';
import { creditcoinCc3, ethereumSepolia } from '@/lib/networks';

export const creditcoinCc3Chain = defineChain({
  id: creditcoinCc3.chainId,
  name: creditcoinCc3.name,
  nativeCurrency: {
    name: creditcoinCc3.currencyName,
    symbol: creditcoinCc3.currencySymbol,
    decimals: 18
  },
  rpcUrls: { default: { http: [creditcoinCc3.rpcUrl] } },
  blockExplorers: {
    default: { name: creditcoinCc3.explorerName, url: creditcoinCc3.explorerBaseUrl }
  },
  testnet: true
});

export const ethereumSepoliaChain = defineChain({
  id: ethereumSepolia.chainId,
  name: ethereumSepolia.name,
  nativeCurrency: {
    name: ethereumSepolia.currencyName,
    symbol: ethereumSepolia.currencySymbol,
    decimals: 18
  },
  rpcUrls: { default: { http: [ethereumSepolia.rpcUrl] } },
  blockExplorers: {
    default: { name: ethereumSepolia.explorerName, url: ethereumSepolia.explorerBaseUrl }
  },
  testnet: true
});

export function createCachedPoolClient(revalidateSeconds: number): PublicClient {
  return createPublicClient({
    chain: creditcoinCc3Chain,
    transport: http(creditcoinCc3.rpcUrl, {
      fetchOptions: { next: { revalidate: revalidateSeconds } }
    })
  });
}

export function createLiveClient(): PublicClient {
  return createPublicClient({
    chain: creditcoinCc3Chain,
    transport: http(creditcoinCc3.rpcUrl, { fetchOptions: { cache: 'no-store' } })
  });
}
