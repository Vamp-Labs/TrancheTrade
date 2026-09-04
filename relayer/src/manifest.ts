import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import type { JsonRpcProvider } from 'ethers';
import { loadInterface } from './abi/index.js';
import {
  CREDITCOIN_CHAIN_LABEL,
  CREDITCOIN_TESTNET_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_CHAIN_KEY,
  SEPOLIA_CHAIN_LABEL,
  creditcoinTransactionUrl,
  sepoliaTransactionUrl,
} from './chains.js';
import {
  ConfigurationError,
  fixturesDirectory,
  journalPath,
  manifestPath,
  proverUrl,
  repositoryRoot,
  tryReadDeployment,
} from './config.js';
import { readProofFixture } from './proof.js';
import { REJECTION_REASONS } from './allocate.js';
import type {
  JournalEntry,
  Manifest,
  ManifestAllocation,
  ManifestAttestation,
  ManifestContractReference,
  ManifestCycle,
  ManifestDestination,
  ManifestRejection,
  ManifestSource,
} from './types.js';

export class ManifestError extends Error {}

const ALLOCATION_EVENT = 'RepaymentAllocated';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readJournal(): JournalEntry[] {
  if (!existsSync(journalPath)) {
    return [];
  }
  const parsed: unknown = JSON.parse(readFileSync(journalPath, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new ManifestError(`${journalPath} is not a JSON array of journal entries.`);
  }
  return parsed.map((entry) => {
    if (!isPlainObject(entry) || typeof entry['id'] !== 'string') {
      throw new ManifestError(`${journalPath} contains an entry without a string id.`);
    }
    return entry as unknown as JournalEntry;
  });
}

export function appendJournalEntry(entry: JournalEntry): void {
  if (!existsSync(fixturesDirectory)) {
    mkdirSync(fixturesDirectory, { recursive: true });
  }
  const entries = readJournal().filter((existing) => existing.id !== entry.id);
  entries.push(entry);
  writeFileSync(journalPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
}

export function nextCycleId(): string {
  const entries = readJournal();
  return `cycle-${entries.length + 1}`;
}

function currentCommit(): string | null {
  try {
    const output = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const trimmed = output.trim();
    return trimmed.length === 0 ? null : trimmed;
  } catch {
    return null;
  }
}

function contractReference(
  name: 'invoiceRegistry' | 'trancheWaterfall' | 'attestcoinVerifier',
  fallbackChainId: number,
): ManifestContractReference {
  const deployment = tryReadDeployment(name);
  if (deployment === null) {
    return { chainId: fallbackChainId, address: null };
  }
  return { chainId: deployment.chainId, address: deployment.address };
}

async function buildSource(
  sepolia: JsonRpcProvider | null,
  entry: JournalEntry,
): Promise<ManifestSource | null> {
  if (entry.sourceTxHash === null) {
    return null;
  }
  const base: ManifestSource = {
    chain: SEPOLIA_CHAIN_LABEL,
    chainId: SEPOLIA_CHAIN_ID,
    event: null,
    txHash: entry.sourceTxHash,
    blockNumber: null,
    logIndex: null,
    amount: null,
    explorerUrl: sepoliaTransactionUrl(entry.sourceTxHash),
  };
  if (entry.proofPath !== null) {
    const absolute = resolve(repositoryRoot, entry.proofPath);
    if (existsSync(absolute)) {
      const fixture = readProofFixture(absolute);
      base.event = fixture.source.event;
      base.blockNumber = fixture.source.blockNumber;
      base.logIndex = fixture.source.logIndex;
      base.amount = fixture.source.amount;
    }
  }
  if (sepolia !== null && base.blockNumber === null) {
    const receipt = await sepolia.getTransactionReceipt(entry.sourceTxHash);
    if (receipt !== null) {
      base.blockNumber = receipt.blockNumber;
    }
  }
  return base;
}

function buildAttestation(entry: JournalEntry): ManifestAttestation | null {
  if (entry.proofPath === null) {
    return null;
  }
  const absolute = resolve(repositoryRoot, entry.proofPath);
  if (!existsSync(absolute)) {
    return {
      chainKey: SEPOLIA_CHAIN_KEY,
      attestedHeight: null,
      attestationId: null,
      proverUrl: proverUrl(),
      fetchedAt: null,
      cached: false,
      continuityHashCount: null,
      status: 'failed',
    };
  }
  const fixture = readProofFixture(absolute);
  const attestation: ManifestAttestation = {
    chainKey: fixture.proof.chainKey,
    attestedHeight: fixture.proof.headerNumber,
    attestationId: fixture.attestation.attestationId,
    proverUrl: fixture.attestation.proverUrl,
    fetchedAt: fixture.attestation.fetchedAt,
    cached: fixture.attestation.cached,
    continuityHashCount: fixture.proof.continuityProof.roots.length,
    status: entry.corruptionMode === null ? fixture.attestation.status : 'corrupted',
  };
  if (entry.corruptionMode !== null) {
    attestation.corruptionMode = entry.corruptionMode;
  }
  return attestation;
}

async function buildDestination(
  creditcoin: JsonRpcProvider | null,
  entry: JournalEntry,
): Promise<ManifestDestination> {
  if (entry.destinationTxHash === null) {
    return {
      chain: CREDITCOIN_CHAIN_LABEL,
      chainId: CREDITCOIN_TESTNET_CHAIN_ID,
      txHash: null,
      blockNumber: null,
      status: 'not-broadcast',
      gasUsed: null,
      explorerUrl: null,
    };
  }
  const destination: ManifestDestination = {
    chain: CREDITCOIN_CHAIN_LABEL,
    chainId: CREDITCOIN_TESTNET_CHAIN_ID,
    txHash: entry.destinationTxHash,
    blockNumber: null,
    status: 'pending',
    gasUsed: null,
    explorerUrl: creditcoinTransactionUrl(entry.destinationTxHash),
  };
  if (creditcoin === null) {
    return destination;
  }
  const receipt = await creditcoin.getTransactionReceipt(entry.destinationTxHash);
  if (receipt === null) {
    return destination;
  }
  destination.blockNumber = receipt.blockNumber;
  destination.gasUsed = receipt.gasUsed.toString();
  destination.status = receipt.status === 1 ? 'success' : 'reverted';
  return destination;
}

async function buildAllocation(
  creditcoin: JsonRpcProvider | null,
  entry: JournalEntry,
): Promise<ManifestAllocation | null> {
  if (entry.kind !== 'allocation' || entry.destinationTxHash === null) {
    return null;
  }
  if (entry.snapshotBefore === null || entry.snapshotAfter === null) {
    throw new ManifestError(
      `Journal entry ${entry.id} is an allocation but carries no before/after snapshot. Re-run the allocation so the manifest can record real balances.`,
    );
  }
  let attestedAmount: string | null = null;
  let seniorAllocation: string | null = null;
  let juniorAllocation: string | null = null;

  if (creditcoin !== null) {
    const receipt = await creditcoin.getTransactionReceipt(entry.destinationTxHash);
    if (receipt !== null && receipt.status === 1) {
      const iface = loadInterface('TrancheWaterfall');
      for (const log of receipt.logs) {
        const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
        if (parsed === null || parsed.name !== ALLOCATION_EVENT) {
          continue;
        }
        const readArgument = (key: string): string | null => {
          const value: unknown = parsed.args[key];
          return typeof value === 'bigint' ? value.toString() : null;
        };
        attestedAmount = readArgument('attestedAmount');
        seniorAllocation = readArgument('seniorAllocation');
        juniorAllocation = readArgument('juniorAllocation');
        break;
      }
    }
  }

  if (attestedAmount === null || seniorAllocation === null || juniorAllocation === null) {
    throw new ManifestError(
      `Could not read a ${ALLOCATION_EVENT} event from Creditcoin transaction ${entry.destinationTxHash}. The manifest refuses to record allocation figures it did not read from the chain.`,
    );
  }

  return {
    attestedAmount,
    seniorAllocation,
    juniorAllocation,
    seniorOutstandingBefore: entry.snapshotBefore.seniorOutstanding,
    seniorOutstandingAfter: entry.snapshotAfter.seniorOutstanding,
    juniorOutstandingBefore: entry.snapshotBefore.juniorOutstanding,
    juniorOutstandingAfter: entry.snapshotAfter.juniorOutstanding,
  };
}

function buildRejection(entry: JournalEntry, rejection: JournalRejection | null): ManifestRejection | null {
  if (entry.kind !== 'rejection') {
    return null;
  }
  if (entry.snapshotBefore === null || entry.snapshotAfter === null) {
    throw new ManifestError(
      `Journal entry ${entry.id} is a rejection but carries no before/after snapshot. The fail-closed claim depends on both being read from the chain.`,
    );
  }
  const reason = rejection?.reason ?? null;
  const isNamedContractReason = reason !== null && REJECTION_REASONS.includes(reason);
  return {
    reason: isNamedContractReason ? reason : 'VerifierReverted',
    errorSignature: rejection?.errorSignature ?? 'unknown',
    revertData: rejection?.revertData ?? null,
    seniorOutstandingBefore: entry.snapshotBefore.seniorOutstanding,
    seniorOutstandingAfter: entry.snapshotAfter.seniorOutstanding,
    juniorOutstandingBefore: entry.snapshotBefore.juniorOutstanding,
    juniorOutstandingAfter: entry.snapshotAfter.juniorOutstanding,
  };
}

export interface JournalRejection {
  reason: string;
  errorSignature: string;
  revertData: string | null;
}

export interface JournalEntryWithRejection extends JournalEntry {
  rejection?: JournalRejection;
}

export interface RegenerateOptions {
  sepolia: JsonRpcProvider | null;
  creditcoin: JsonRpcProvider | null;
}

export async function regenerateManifest(options: RegenerateOptions): Promise<Manifest> {
  const entries = readJournal() as JournalEntryWithRejection[];
  const cycles: ManifestCycle[] = [];

  for (const entry of entries) {
    const source = await buildSource(options.sepolia, entry);
    const attestation = buildAttestation(entry);
    const destination = await buildDestination(options.creditcoin, entry);
    const allocation = await buildAllocation(options.creditcoin, entry);
    const rejection = buildRejection(entry, entry.rejection ?? null);
    cycles.push({
      id: entry.id,
      kind: entry.kind,
      label: entry.label,
      occurredAt: entry.occurredAt,
      invoiceId: entry.invoiceId,
      source,
      attestation,
      destination,
      allocation,
      rejection,
    });
  }

  cycles.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    commit: currentCommit(),
    contracts: {
      invoiceRegistry: contractReference('invoiceRegistry', SEPOLIA_CHAIN_ID),
      trancheWaterfall: contractReference('trancheWaterfall', CREDITCOIN_TESTNET_CHAIN_ID),
      attestcoinVerifier: contractReference('attestcoinVerifier', CREDITCOIN_TESTNET_CHAIN_ID),
    },
    cycles,
  };
}

export function writeManifest(manifest: Manifest): string {
  const directory = dirname(manifestPath);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifestPath;
}

export function readManifest(): Manifest {
  if (!existsSync(manifestPath)) {
    throw new ConfigurationError(`${manifestPath} does not exist yet. Generate it with: relayer manifest`);
  }
  const parsed: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!isPlainObject(parsed) || !Array.isArray(parsed['cycles'])) {
    throw new ManifestError(`${manifestPath} is not a TrancheTrade manifest.`);
  }
  return parsed as unknown as Manifest;
}

export function repositoryRelativePath(absolutePath: string): string {
  return relative(repositoryRoot, resolve(absolutePath));
}
