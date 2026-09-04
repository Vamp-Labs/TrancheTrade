import { JsonRpcProvider, Wallet } from 'ethers';
import { chainInfo } from '@gluwa/usc-sdk';
import {
  ConfigurationError,
  creditcoinRpcUrl,
  requireRelayerPrivateKey,
  requireSepoliaRpcUrl,
} from './config.js';

export const SEPOLIA_CHAIN_ID = 11155111;
export const CREDITCOIN_TESTNET_CHAIN_ID = 102031;
export const CREDITCOIN_MAINNET_CHAIN_ID = 102030;

export const SEPOLIA_CHAIN_KEY = 1;
export const ETHEREUM_MAINNET_CHAIN_KEY = 3;

export const BLOCK_PROVER_PRECOMPILE = '0x0000000000000000000000000000000000000FD2';
export const CHAIN_INFO_PRECOMPILE = '0x0000000000000000000000000000000000000fd3';

export const SEPOLIA_EXPLORER = 'https://sepolia.etherscan.io';
export const CREDITCOIN_TESTNET_EXPLORER = 'https://creditcoin-testnet.blockscout.com';

export const SEPOLIA_CHAIN_LABEL = 'ethereum-sepolia';
export const CREDITCOIN_CHAIN_LABEL = 'creditcoin-cc3-testnet';

export class ChainAssertionError extends Error {}

export function sepoliaProvider(): JsonRpcProvider {
  return new JsonRpcProvider(requireSepoliaRpcUrl(), SEPOLIA_CHAIN_ID, { staticNetwork: true });
}

export function creditcoinProvider(): JsonRpcProvider {
  return new JsonRpcProvider(creditcoinRpcUrl(), CREDITCOIN_TESTNET_CHAIN_ID, { staticNetwork: true });
}

export async function assertChainId(provider: JsonRpcProvider, expected: number, label: string): Promise<void> {
  const network = await provider.getNetwork();
  const actual = Number(network.chainId);
  if (actual === CREDITCOIN_MAINNET_CHAIN_ID) {
    throw new ChainAssertionError(
      `Refusing to continue: the RPC endpoint reports Creditcoin mainnet (${CREDITCOIN_MAINNET_CHAIN_ID}). This tool is testnet only.`,
    );
  }
  if (actual !== expected) {
    throw new ChainAssertionError(
      `Expected ${label} chain id ${expected}, but the configured RPC endpoint reports ${actual}. Refusing to broadcast.`,
    );
  }
}

export async function sepoliaSigner(provider: JsonRpcProvider): Promise<Wallet> {
  await assertChainId(provider, SEPOLIA_CHAIN_ID, 'Ethereum Sepolia');
  return new Wallet(requireRelayerPrivateKey(), provider);
}

export async function creditcoinSigner(provider: JsonRpcProvider): Promise<Wallet> {
  await assertChainId(provider, CREDITCOIN_TESTNET_CHAIN_ID, 'Creditcoin CC3 testnet');
  return new Wallet(requireRelayerPrivateKey(), provider);
}

export async function resolveSepoliaChainKey(provider: JsonRpcProvider): Promise<number> {
  const infoProvider = new chainInfo.PrecompileChainInfoProvider(provider);
  const chains = await infoProvider.getSupportedChains();
  const entry = chains.find((candidate) => candidate.chainId === SEPOLIA_CHAIN_ID);
  if (entry === undefined) {
    const summary = chains.map((candidate) => `${candidate.chainKey}=>${candidate.chainId}`).join(', ');
    throw new ChainAssertionError(
      `The Creditcoin ChainInfo precompile does not list Ethereum Sepolia (chain id ${SEPOLIA_CHAIN_ID}). Supported chainKey=>chainId pairs: ${summary}`,
    );
  }
  if (entry.chainKey !== SEPOLIA_CHAIN_KEY) {
    throw new ChainAssertionError(
      `The ChainInfo precompile maps Ethereum Sepolia to chainKey ${entry.chainKey}, not the expected ${SEPOLIA_CHAIN_KEY}. Update the constant rather than guessing.`,
    );
  }
  return entry.chainKey;
}

export function sepoliaTransactionUrl(txHash: string): string {
  return `${SEPOLIA_EXPLORER}/tx/${txHash}`;
}

export function creditcoinTransactionUrl(txHash: string): string {
  return `${CREDITCOIN_TESTNET_EXPLORER}/tx/${txHash}`;
}

export function sepoliaAddressUrl(address: string): string {
  return `${SEPOLIA_EXPLORER}/address/${address}`;
}

export function creditcoinAddressUrl(address: string): string {
  return `${CREDITCOIN_TESTNET_EXPLORER}/address/${address}`;
}

export function decodeChainName(hexOrText: string): string {
  if (!/^0x[0-9a-fA-F]*$/.test(hexOrText)) {
    return hexOrText;
  }
  const body = hexOrText.slice(2);
  const bytes = new Uint8Array(body.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(body.slice(index * 2, index * 2 + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

export function assertNotConfigurationGap(condition: boolean, message: string): void {
  if (!condition) {
    throw new ConfigurationError(message);
  }
}
