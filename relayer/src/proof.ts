import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Contract, keccak256, solidityPacked } from 'ethers';
import type { JsonRpcProvider } from 'ethers';
import { blockProver, proofProvider } from '@gluwa/usc-sdk';
import { loadInterface } from './abi/index.js';
import {
  BLOCK_PROVER_PRECOMPILE,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_CHAIN_LABEL,
  resolveSepoliaChainKey,
} from './chains.js';
import { ConfigurationError, proverUrl, tryReadDeployment } from './config.js';
import type { AttestcoinProof, ProofFixture, ProofFixtureSource } from './types.js';

export class ProofError extends Error {}

const INVOICE_REPAID_EVENT = 'InvoiceRepaid';

export function deriveAttestationId(chainKey: number, height: number, txIndex: number): string {
  return keccak256(solidityPacked(['uint64', 'uint64', 'uint64'], [chainKey, height, txIndex]));
}

export function deriveAscBaseQueryId(chainKey: number, height: number, txIndex: number): string {
  return keccak256(solidityPacked(['uint256', 'uint64', 'uint256'], [chainKey, height, txIndex]));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normaliseProof(raw: unknown): AttestcoinProof {
  if (!isPlainObject(raw)) {
    throw new ProofError('The prover returned a proof payload that is not an object.');
  }
  const merkleProof = raw['merkleProof'];
  const continuityProof = raw['continuityProof'];
  if (!isPlainObject(merkleProof) || !isPlainObject(continuityProof)) {
    throw new ProofError('The prover response is missing merkleProof or continuityProof.');
  }
  const siblings = merkleProof['siblings'];
  const roots = continuityProof['roots'];
  if (!Array.isArray(siblings) || !Array.isArray(roots)) {
    throw new ProofError('The prover response has a malformed merkleProof.siblings or continuityProof.roots.');
  }
  const chainKey = raw['chainKey'];
  const headerNumber = raw['headerNumber'];
  const txIndex = raw['txIndex'];
  const txHash = raw['txHash'];
  const txBytes = raw['txBytes'];
  const root = merkleProof['root'];
  const lowerEndpointDigest = continuityProof['lowerEndpointDigest'];
  if (
    typeof chainKey !== 'number' ||
    typeof headerNumber !== 'number' ||
    typeof txIndex !== 'number' ||
    typeof txHash !== 'string' ||
    typeof txBytes !== 'string' ||
    typeof root !== 'string' ||
    typeof lowerEndpointDigest !== 'string'
  ) {
    throw new ProofError('The prover response is missing one of chainKey, headerNumber, txIndex, txHash, txBytes, merkleProof.root, continuityProof.lowerEndpointDigest.');
  }
  return {
    chainKey,
    headerNumber,
    txIndex,
    txHash,
    txBytes,
    merkleProof: {
      root,
      siblings: siblings.map((entry): { hash: string; isLeft: boolean } => {
        if (!isPlainObject(entry) || typeof entry['hash'] !== 'string' || typeof entry['isLeft'] !== 'boolean') {
          throw new ProofError('A merkleProof sibling entry is not { hash: string, isLeft: boolean }.');
        }
        return { hash: entry['hash'], isLeft: entry['isLeft'] };
      }),
    },
    continuityProof: {
      lowerEndpointDigest,
      roots: roots.map((entry): string => {
        if (typeof entry !== 'string') {
          throw new ProofError('A continuityProof root entry is not a string.');
        }
        return entry;
      }),
    },
  };
}

export interface FetchProofOptions {
  sepolia: JsonRpcProvider;
  creditcoin: JsonRpcProvider;
  txHash: string;
  pollIntervalMs: number;
  waitTimeoutMs: number;
  onWaiting: (message: string) => void;
}

export interface FetchedProof {
  proof: AttestcoinProof;
  source: ProofFixtureSource;
  cached: boolean;
  fetchedAt: string;
  attestationId: string;
  precompileTxIndex: number;
}

function decodeInvoiceRepaid(
  logs: readonly { address: string; topics: readonly string[]; data: string; index: number }[],
): { logIndex: number; invoiceId: string; amount: string } | null {
  const registry = tryReadDeployment('invoiceRegistry');
  if (registry === null) {
    return null;
  }
  let iface;
  try {
    iface = loadInterface('InvoiceRegistry');
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return null;
    }
    throw error;
  }
  for (const log of logs) {
    if (log.address.toLowerCase() !== registry.address.toLowerCase()) {
      continue;
    }
    const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
    if (parsed === null || parsed.name !== INVOICE_REPAID_EVENT) {
      continue;
    }
    const invoiceId = parsed.args['invoiceId'] as unknown;
    const amount = (parsed.args['amount'] ?? parsed.args['repaymentAmount']) as unknown;
    if (typeof invoiceId !== 'bigint' || typeof amount !== 'bigint') {
      throw new ProofError(
        `${INVOICE_REPAID_EVENT} was found but its invoiceId/amount arguments are not uint256. Signature seen: ${parsed.signature}`,
      );
    }
    return { logIndex: log.index, invoiceId: invoiceId.toString(), amount: amount.toString() };
  }
  return null;
}

export async function fetchProof(options: FetchProofOptions): Promise<FetchedProof> {
  const chainKey = await resolveSepoliaChainKey(options.creditcoin);

  const receipt = await options.sepolia.getTransactionReceipt(options.txHash);
  if (receipt === null) {
    throw new ProofError(
      `Ethereum Sepolia has no receipt for ${options.txHash}. The transaction does not exist or is not mined yet.`,
    );
  }
  if (receipt.status !== 1) {
    throw new ProofError(
      `Ethereum Sepolia transaction ${options.txHash} reverted (receipt status ${String(receipt.status)}). Attestcoin proves inclusion, not success, so a reverted source transaction must never be relayed.`,
    );
  }

  const builder = new proofProvider.service.ProofBuilder(chainKey, proverUrl());
  options.onWaiting(
    `Waiting for Attestcoin to attest Sepolia height ${receipt.blockNumber} (chainKey ${chainKey}, polling every ${options.pollIntervalMs / 1000}s, giving up after ${options.waitTimeoutMs / 60000} minutes).`,
  );
  await builder.waitUntilHeightAttested(
    chainKey,
    receipt.blockNumber,
    options.pollIntervalMs,
    options.waitTimeoutMs,
  );

  const result = await builder.getProof(options.txHash);
  if (!result.success || result.data === undefined) {
    throw new ProofError(
      `The proof service at ${proverUrl()} did not return a proof for ${options.txHash}: ${result.error ?? 'no error message supplied'}`,
    );
  }
  const raw: unknown = result.data;
  const proof = normaliseProof(raw);

  if (proof.chainKey !== chainKey) {
    throw new ProofError(
      `The prover returned chainKey ${proof.chainKey} but Sepolia is chainKey ${chainKey} on this Creditcoin network.`,
    );
  }
  if (proof.headerNumber !== receipt.blockNumber) {
    throw new ProofError(
      `The prover returned headerNumber ${proof.headerNumber} but the Sepolia receipt reports block ${receipt.blockNumber}.`,
    );
  }

  const precompileTxIndex = await readPrecompileTxIndex(options.creditcoin, proof);
  if (precompileTxIndex !== proof.txIndex) {
    throw new ProofError(
      `calculateTxIndex on the Creditcoin precompile returned ${precompileTxIndex} but the prover reported txIndex ${proof.txIndex}.`,
    );
  }

  const repaid = decodeInvoiceRepaid(
    receipt.logs.map((log) => ({ address: log.address, topics: log.topics, data: log.data, index: log.index })),
  );

  const cachedFlag = isPlainObject(raw) ? raw['cached'] : undefined;

  return {
    proof,
    cached: cachedFlag === true,
    fetchedAt: new Date().toISOString(),
    attestationId: deriveAttestationId(proof.chainKey, proof.headerNumber, proof.txIndex),
    precompileTxIndex,
    source: {
      chain: SEPOLIA_CHAIN_LABEL,
      chainId: SEPOLIA_CHAIN_ID,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      transactionIndex: receipt.index,
      receiptStatus: receipt.status,
      event: repaid === null ? null : INVOICE_REPAID_EVENT,
      logIndex: repaid?.logIndex ?? null,
      invoiceId: repaid?.invoiceId ?? null,
      amount: repaid?.amount ?? null,
    },
  };
}

export async function readPrecompileTxIndex(
  creditcoin: JsonRpcProvider,
  proof: AttestcoinProof,
): Promise<number> {
  const prover = new blockProver.PrecompileBlockProver(creditcoin);
  const index = await prover.computeTransactionIndex(proof.merkleProof);
  return Number(index);
}

export async function verifyAgainstPrecompile(
  creditcoin: JsonRpcProvider,
  proof: AttestcoinProof,
): Promise<{ verified: boolean; revertReason: string | null }> {
  const contract = new Contract(
    BLOCK_PROVER_PRECOMPILE,
    [
      'function verify(uint64 chainKey, uint64 height, bytes encodedTransaction, tuple(bytes32 root, tuple(bytes32 hash, bool isLeft)[] siblings) merkleProof, tuple(bytes32 lowerEndpointDigest, bytes32[] roots) continuityProof) view returns (bool)',
    ],
    creditcoin,
  );
  try {
    const verified: unknown = await contract['verify']?.(
      proof.chainKey,
      proof.headerNumber,
      proof.txBytes,
      { root: proof.merkleProof.root, siblings: proof.merkleProof.siblings },
      { lowerEndpointDigest: proof.continuityProof.lowerEndpointDigest, roots: proof.continuityProof.roots },
    );
    return { verified: verified === true, revertReason: null };
  } catch (error) {
    return { verified: false, revertReason: extractRevertReason(error) };
  }
}

export function extractRevertReason(error: unknown): string {
  if (isPlainObject(error)) {
    const reason = error['reason'];
    if (typeof reason === 'string' && reason.length > 0) {
      return reason;
    }
    const shortMessage = error['shortMessage'];
    if (typeof shortMessage === 'string' && shortMessage.length > 0) {
      return shortMessage;
    }
  }
  return error instanceof Error ? error.message : String(error);
}

export function extractRevertData(error: unknown): string | null {
  if (!isPlainObject(error)) {
    return null;
  }
  const data = error['data'];
  if (typeof data === 'string' && data.startsWith('0x')) {
    return data;
  }
  const nested = error['error'];
  if (isPlainObject(nested)) {
    const nestedData = nested['data'];
    if (typeof nestedData === 'string' && nestedData.startsWith('0x')) {
      return nestedData;
    }
  }
  return null;
}

export function writeProofFixture(path: string, fixture: ProofFixture): void {
  const directory = dirname(resolve(path));
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
  writeFileSync(resolve(path), `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
}

export function readProofFixture(path: string): ProofFixture {
  const absolute = resolve(path);
  if (!existsSync(absolute)) {
    throw new ProofError(`Proof fixture ${absolute} does not exist. Create one with: relayer prove --tx <sepoliaTxHash> --out ${path}`);
  }
  const parsed: unknown = JSON.parse(readFileSync(absolute, 'utf8'));
  if (!isPlainObject(parsed) || !isPlainObject(parsed['proof']) || !isPlainObject(parsed['source']) || !isPlainObject(parsed['attestation'])) {
    throw new ProofError(`${absolute} is not a relayer proof fixture (expected { version, source, attestation, proof }).`);
  }
  const proof = normaliseProof(parsed['proof']);
  return {
    version: 1,
    source: parsed['source'] as unknown as ProofFixture['source'],
    attestation: parsed['attestation'] as unknown as ProofFixture['attestation'],
    proof,
  };
}
