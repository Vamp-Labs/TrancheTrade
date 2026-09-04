import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

export const relayerRoot = resolve(moduleDirectory, '..');
export const repositoryRoot = resolve(moduleDirectory, '..', '..');
export const evidenceDirectory = resolve(repositoryRoot, 'docs', 'evidence');
export const abiDirectory = resolve(evidenceDirectory, 'abi');
export const deploymentsPath = resolve(evidenceDirectory, 'deployments.json');
export const manifestPath = resolve(evidenceDirectory, 'transactions.json');
export const evidenceProofsDirectory = resolve(evidenceDirectory, 'proofs');
export const fixturesDirectory = resolve(relayerRoot, 'fixtures');
export const journalPath = resolve(fixturesDirectory, 'journal.json');

export const DEFAULT_CREDITCOIN_RPC_URL = 'https://rpc.cc3-testnet.creditcoin.network';
export const DEFAULT_PROVER_URL = 'https://prover.cc3-testnet.creditcoin.network';

export class ConfigurationError extends Error {}

function readEnvironment(name: string): string | null {
  const value = process.env[name];
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function requireSepoliaRpcUrl(): string {
  const value = readEnvironment('SEPOLIA_RPC_URL');
  if (value === null) {
    throw new ConfigurationError(
      'SEPOLIA_RPC_URL is not set. Export an Ethereum Sepolia JSON-RPC endpoint in your shell before running this command.',
    );
  }
  return value;
}

export function creditcoinRpcUrl(): string {
  return readEnvironment('CREDITCOIN_RPC_URL') ?? DEFAULT_CREDITCOIN_RPC_URL;
}

export function proverUrl(): string {
  return readEnvironment('PROVER_URL') ?? DEFAULT_PROVER_URL;
}

export function requireRelayerPrivateKey(): string {
  const value = readEnvironment('RELAYER_PRIVATE_KEY');
  if (value === null) {
    throw new ConfigurationError(
      'RELAYER_PRIVATE_KEY is not set. This command broadcasts a transaction and needs a funded testnet key exported in your shell. Read-only commands (prove, verify, snapshot, manifest) do not need it.',
    );
  }
  return value;
}

export function hasRelayerPrivateKey(): boolean {
  return readEnvironment('RELAYER_PRIVATE_KEY') !== null;
}

export type DeployedContractName = 'invoiceRegistry' | 'trancheWaterfall' | 'attestcoinVerifier';

export interface DeploymentRecord {
  chainId: number;
  address: string;
  deployTxHash: string | null;
  deployBlockNumber: number | null;
}

interface RawDeploymentRecord {
  chainId?: unknown;
  address?: unknown;
  deployTxHash?: unknown;
  deployBlockNumber?: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function readDeploymentsDocument(): Record<string, unknown> {
  if (!existsSync(deploymentsPath)) {
    throw new ConfigurationError(
      `${deploymentsPath} does not exist yet. It is produced by the Contracts Engineer. Wait for it, or point this command at a populated evidence bundle.`,
    );
  }
  const parsed: unknown = JSON.parse(readFileSync(deploymentsPath, 'utf8'));
  if (!isPlainObject(parsed)) {
    throw new ConfigurationError(`${deploymentsPath} is not a JSON object.`);
  }
  const nested = parsed['contracts'];
  return isPlainObject(nested) ? nested : parsed;
}

export function readDeployment(name: DeployedContractName): DeploymentRecord {
  const document = readDeploymentsDocument();
  const entry = document[name];
  if (!isPlainObject(entry)) {
    throw new ConfigurationError(
      `${deploymentsPath} has no entry for "${name}". Expected either a top-level "${name}" key or "contracts.${name}", holding { chainId, address }.`,
    );
  }
  const record = entry as RawDeploymentRecord;
  const address = record.address;
  if (typeof address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(address) || address === ZERO_ADDRESS) {
    throw new ConfigurationError(
      `${deploymentsPath} entry "${name}" has no usable address (found ${JSON.stringify(address)}). The contract is not deployed yet.`,
    );
  }
  const chainId = record.chainId;
  if (typeof chainId !== 'number' || !Number.isInteger(chainId)) {
    throw new ConfigurationError(
      `${deploymentsPath} entry "${name}" has no integer chainId (found ${JSON.stringify(chainId)}).`,
    );
  }
  return {
    chainId,
    address,
    deployTxHash: typeof record.deployTxHash === 'string' ? record.deployTxHash : null,
    deployBlockNumber: typeof record.deployBlockNumber === 'number' ? record.deployBlockNumber : null,
  };
}

export function tryReadDeployment(name: DeployedContractName): DeploymentRecord | null {
  try {
    return readDeployment(name);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return null;
    }
    throw error;
  }
}
