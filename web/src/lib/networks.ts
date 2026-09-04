import networks from '@config/networks.json';

export interface NetworkDescriptor {
  key: string;
  chainId: number;
  name: string;
  shortName: string;
  currencySymbol: string;
  currencyName: string;
  currencyDecimals: number;
  rpcUrl: string;
  explorerName: string;
  explorerBaseUrl: string;
  blockTimeSeconds: number;
}

export const creditcoinCc3: NetworkDescriptor = networks.creditcoinCc3Testnet;
export const ethereumSepolia: NetworkDescriptor = networks.ethereumSepolia;

const byChainId = new Map<number, NetworkDescriptor>([
  [creditcoinCc3.chainId, creditcoinCc3],
  [ethereumSepolia.chainId, ethereumSepolia]
]);

export function networkForChainId(chainId: number): NetworkDescriptor | null {
  return byChainId.get(chainId) ?? null;
}

export function transactionUrl(chainId: number, txHash: string): string | null {
  const network = networkForChainId(chainId);
  if (network === null) return null;
  return `${network.explorerBaseUrl}/tx/${txHash}`;
}

export function addressUrl(chainId: number, address: string): string | null {
  const network = networkForChainId(chainId);
  if (network === null) return null;
  return `${network.explorerBaseUrl}/address/${address}`;
}
