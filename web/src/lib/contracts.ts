import type { Abi } from 'viem';
import trancheWaterfallAbiJson from '@evidence/abi/TrancheWaterfall.json';
import invoiceRegistryAbiJson from '@evidence/abi/InvoiceRegistry.json';
import attestcoinVerifierAbiJson from '@evidence/abi/AttestcoinVerifier.json';
import deploymentsJson from '@evidence/deployments.json';
import { creditcoinCc3, ethereumSepolia } from '@/lib/networks';

export const trancheWaterfallAbi = trancheWaterfallAbiJson as unknown as Abi;
export const invoiceRegistryAbi = invoiceRegistryAbiJson as unknown as Abi;
export const attestcoinVerifierAbi = attestcoinVerifierAbiJson as unknown as Abi;

export type EvmAddress = `0x${string}`;

export interface DeployedContract {
  name: string;
  chainId: number;
  address: EvmAddress | null;
  deployTxHash: string | null;
}

export interface DeploymentBook {
  status: string;
  invoiceRegistry: DeployedContract;
  attestcoinVerifier: DeployedContract;
  trancheWaterfall: DeployedContract;
  configuredSeniorCap: bigint | null;
  configuredJuniorCap: bigint | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readAddress(container: Record<string, unknown> | null): EvmAddress | null {
  if (container === null) return null;
  const value = container['address'];
  if (typeof value !== 'string') return null;
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) return null;
  return value as EvmAddress;
}

function readHash(container: Record<string, unknown> | null, key: string): string | null {
  if (container === null) return null;
  const value = container[key];
  return typeof value === 'string' && value.startsWith('0x') ? value : null;
}

function readCap(container: Record<string, unknown> | null, key: string): bigint | null {
  if (container === null) return null;
  const args = asRecord(container['constructorArgs']);
  if (args === null) return null;
  const value = args[key];
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  return BigInt(value);
}

function readDeploymentBook(source: unknown): DeploymentBook {
  const root = asRecord(source);
  const contracts = root === null ? null : asRecord(root['contracts']);
  const statusValue = root === null ? undefined : root['deploymentStatus'];
  const invoiceRegistry = contracts === null ? null : asRecord(contracts['InvoiceRegistry']);
  const attestcoinVerifier =
    contracts === null ? null : asRecord(contracts['AttestcoinVerifier']);
  const trancheWaterfall = contracts === null ? null : asRecord(contracts['TrancheWaterfall']);

  return {
    status: typeof statusValue === 'string' ? statusValue : 'unknown',
    invoiceRegistry: {
      name: 'InvoiceRegistry',
      chainId: ethereumSepolia.chainId,
      address: readAddress(invoiceRegistry),
      deployTxHash: readHash(invoiceRegistry, 'deployTxHash')
    },
    attestcoinVerifier: {
      name: 'AttestcoinVerifier',
      chainId: creditcoinCc3.chainId,
      address: readAddress(attestcoinVerifier),
      deployTxHash: readHash(attestcoinVerifier, 'deployTxHash')
    },
    trancheWaterfall: {
      name: 'TrancheWaterfall',
      chainId: creditcoinCc3.chainId,
      address: readAddress(trancheWaterfall),
      deployTxHash: readHash(trancheWaterfall, 'deployTxHash')
    },
    configuredSeniorCap: readCap(trancheWaterfall, 'seniorCap'),
    configuredJuniorCap: readCap(trancheWaterfall, 'juniorCap')
  };
}

export const deployments: DeploymentBook = readDeploymentBook(deploymentsJson as unknown);

export const trancheWaterfallAddress: EvmAddress | null = deployments.trancheWaterfall.address;

export const isTrancheWaterfallDeployed = trancheWaterfallAddress !== null;
