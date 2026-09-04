export type CycleKind = 'allocation' | 'rejection';

export type AttestationStatus = 'pending' | 'attested' | 'failed' | 'corrupted';

export type DestinationStatus = 'success' | 'reverted';

export type RejectionReason =
  | 'InvalidProof'
  | 'ExpiredProof'
  | 'StaleProof'
  | 'AlreadyApplied'
  | 'AmountZero'
  | 'ExceedsOutstanding'
  | 'VerifierReverted';

export const REJECTION_REASONS_BY_ORDINAL: readonly RejectionReason[] = [
  'InvalidProof',
  'ExpiredProof',
  'StaleProof',
  'AlreadyApplied',
  'AmountZero',
  'ExceedsOutstanding'
];

const ALL_REJECTION_REASONS: readonly RejectionReason[] = [
  ...REJECTION_REASONS_BY_ORDINAL,
  'VerifierReverted'
];

export interface ManifestContractRef {
  chainId: number;
  address: string | null;
}

export interface ManifestContracts {
  invoiceRegistry: ManifestContractRef;
  trancheWaterfall: ManifestContractRef;
  attestcoinVerifier: ManifestContractRef;
}

export interface CycleSource {
  chain: string;
  chainId: number;
  event: string;
  txHash: string;
  blockNumber: number;
  logIndex: number;
  amount: string;
  explorerUrl: string | null;
}

export interface CycleAttestation {
  chainKey: number;
  attestedHeight: number;
  attestationId: string;
  proverUrl: string;
  fetchedAt: string;
  cached: boolean;
  continuityHashCount: number;
  status: AttestationStatus;
  corruptionMode: string | null;
}

export interface CycleDestination {
  chain: string;
  chainId: number;
  txHash: string;
  blockNumber: number;
  status: DestinationStatus;
  gasUsed: string;
  explorerUrl: string | null;
}

export interface CycleAllocation {
  attestedAmount: string;
  seniorAllocation: string;
  juniorAllocation: string;
  seniorOutstandingBefore: string;
  seniorOutstandingAfter: string;
  juniorOutstandingBefore: string;
  juniorOutstandingAfter: string;
}

export interface CycleRejection {
  reason: RejectionReason;
  errorSignature: string;
  revertData: string | null;
  seniorOutstandingBefore: string;
  seniorOutstandingAfter: string;
  juniorOutstandingBefore: string;
  juniorOutstandingAfter: string;
}

export interface ManifestCycle {
  id: string;
  kind: CycleKind;
  label: string;
  occurredAt: string;
  invoiceId: string;
  source: CycleSource;
  attestation: CycleAttestation;
  destination: CycleDestination;
  allocation: CycleAllocation | null;
  rejection: CycleRejection | null;
}

export interface TransactionManifest {
  version: number;
  generatedAt: string;
  commit: string | null;
  contracts: ManifestContracts;
  cycles: readonly ManifestCycle[];
}

export type ManifestParseResult =
  | { ok: true; manifest: TransactionManifest }
  | { ok: false; problem: string };

class ManifestShapeError extends Error {}

function fail(path: string, expectation: string): never {
  throw new ManifestShapeError(`${path} ${expectation}`);
}

function readRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function readString(source: Record<string, unknown>, key: string, path: string): string {
  const value = source[key];
  if (typeof value !== 'string') fail(`${path}.${key}`, 'must be a string');
  return value;
}

function readNullableString(
  source: Record<string, unknown>,
  key: string,
  path: string
): string | null {
  const value = source[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') fail(`${path}.${key}`, 'must be a string or null');
  return value;
}

function readNumber(source: Record<string, unknown>, key: string, path: string): number {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${path}.${key}`, 'must be a finite number');
  }
  return value;
}

function readBoolean(source: Record<string, unknown>, key: string, path: string): boolean {
  const value = source[key];
  if (typeof value !== 'boolean') fail(`${path}.${key}`, 'must be a boolean');
  return value;
}

function readDecimalString(
  source: Record<string, unknown>,
  key: string,
  path: string
): string {
  const value = readString(source, key, path);
  if (!/^-?\d+$/.test(value)) fail(`${path}.${key}`, 'must be a decimal integer string');
  return value;
}

function readFromUnion<T extends string>(
  source: Record<string, unknown>,
  key: string,
  path: string,
  allowed: readonly T[]
): T {
  const value = readString(source, key, path);
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) fail(`${path}.${key}`, `must be one of ${allowed.join(', ')}`);
  return match;
}

function parseContractRef(value: unknown, path: string): ManifestContractRef {
  const record = readRecord(value, path);
  return {
    chainId: readNumber(record, 'chainId', path),
    address: readNullableString(record, 'address', path)
  };
}

function parseSource(value: unknown, path: string): CycleSource {
  const record = readRecord(value, path);
  return {
    chain: readString(record, 'chain', path),
    chainId: readNumber(record, 'chainId', path),
    event: readString(record, 'event', path),
    txHash: readString(record, 'txHash', path),
    blockNumber: readNumber(record, 'blockNumber', path),
    logIndex: readNumber(record, 'logIndex', path),
    amount: readDecimalString(record, 'amount', path),
    explorerUrl: readNullableString(record, 'explorerUrl', path)
  };
}

function parseAttestation(value: unknown, path: string): CycleAttestation {
  const record = readRecord(value, path);
  return {
    chainKey: readNumber(record, 'chainKey', path),
    attestedHeight: readNumber(record, 'attestedHeight', path),
    attestationId: readString(record, 'attestationId', path),
    proverUrl: readString(record, 'proverUrl', path),
    fetchedAt: readString(record, 'fetchedAt', path),
    cached: readBoolean(record, 'cached', path),
    continuityHashCount: readNumber(record, 'continuityHashCount', path),
    status: readFromUnion(record, 'status', path, [
      'pending',
      'attested',
      'failed',
      'corrupted'
    ] as const),
    corruptionMode: readNullableString(record, 'corruptionMode', path)
  };
}

function parseDestination(value: unknown, path: string): CycleDestination {
  const record = readRecord(value, path);
  return {
    chain: readString(record, 'chain', path),
    chainId: readNumber(record, 'chainId', path),
    txHash: readString(record, 'txHash', path),
    blockNumber: readNumber(record, 'blockNumber', path),
    status: readFromUnion(record, 'status', path, ['success', 'reverted'] as const),
    gasUsed: readDecimalString(record, 'gasUsed', path),
    explorerUrl: readNullableString(record, 'explorerUrl', path)
  };
}

function parseAllocation(value: unknown, path: string): CycleAllocation {
  const record = readRecord(value, path);
  return {
    attestedAmount: readDecimalString(record, 'attestedAmount', path),
    seniorAllocation: readDecimalString(record, 'seniorAllocation', path),
    juniorAllocation: readDecimalString(record, 'juniorAllocation', path),
    seniorOutstandingBefore: readDecimalString(record, 'seniorOutstandingBefore', path),
    seniorOutstandingAfter: readDecimalString(record, 'seniorOutstandingAfter', path),
    juniorOutstandingBefore: readDecimalString(record, 'juniorOutstandingBefore', path),
    juniorOutstandingAfter: readDecimalString(record, 'juniorOutstandingAfter', path)
  };
}

function parseRejection(value: unknown, path: string): CycleRejection {
  const record = readRecord(value, path);
  return {
    reason: readFromUnion(record, 'reason', path, ALL_REJECTION_REASONS),
    errorSignature: readString(record, 'errorSignature', path),
    revertData: readNullableString(record, 'revertData', path),
    seniorOutstandingBefore: readDecimalString(record, 'seniorOutstandingBefore', path),
    seniorOutstandingAfter: readDecimalString(record, 'seniorOutstandingAfter', path),
    juniorOutstandingBefore: readDecimalString(record, 'juniorOutstandingBefore', path),
    juniorOutstandingAfter: readDecimalString(record, 'juniorOutstandingAfter', path)
  };
}

function parseCycle(value: unknown, path: string): ManifestCycle {
  const record = readRecord(value, path);
  const kind = readFromUnion(record, 'kind', path, ['allocation', 'rejection'] as const);
  const allocationValue = record['allocation'];
  const rejectionValue = record['rejection'];
  const allocation =
    allocationValue === null || allocationValue === undefined
      ? null
      : parseAllocation(allocationValue, `${path}.allocation`);
  const rejection =
    rejectionValue === null || rejectionValue === undefined
      ? null
      : parseRejection(rejectionValue, `${path}.rejection`);

  if (kind === 'allocation' && allocation === null) {
    fail(path, 'declares kind "allocation" but carries no allocation object');
  }
  if (kind === 'rejection' && rejection === null) {
    fail(path, 'declares kind "rejection" but carries no rejection object');
  }
  if (allocation !== null && rejection !== null) {
    fail(path, 'carries both an allocation and a rejection object');
  }

  return {
    id: readString(record, 'id', path),
    kind,
    label: readString(record, 'label', path),
    occurredAt: readString(record, 'occurredAt', path),
    invoiceId: readString(record, 'invoiceId', path),
    source: parseSource(record['source'], `${path}.source`),
    attestation: parseAttestation(record['attestation'], `${path}.attestation`),
    destination: parseDestination(record['destination'], `${path}.destination`),
    allocation,
    rejection
  };
}

export function parseTransactionManifest(value: unknown): ManifestParseResult {
  try {
    const record = readRecord(value, 'manifest');
    const contractsRecord = readRecord(record['contracts'], 'manifest.contracts');
    const cyclesValue = record['cycles'];
    if (!Array.isArray(cyclesValue)) fail('manifest.cycles', 'must be an array');

    return {
      ok: true,
      manifest: {
        version: readNumber(record, 'version', 'manifest'),
        generatedAt: readString(record, 'generatedAt', 'manifest'),
        commit: readNullableString(record, 'commit', 'manifest'),
        contracts: {
          invoiceRegistry: parseContractRef(
            contractsRecord['invoiceRegistry'],
            'manifest.contracts.invoiceRegistry'
          ),
          trancheWaterfall: parseContractRef(
            contractsRecord['trancheWaterfall'],
            'manifest.contracts.trancheWaterfall'
          ),
          attestcoinVerifier: parseContractRef(
            contractsRecord['attestcoinVerifier'],
            'manifest.contracts.attestcoinVerifier'
          )
        },
        cycles: cyclesValue.map((cycle, index) =>
          parseCycle(cycle, `manifest.cycles[${index}]`)
        )
      }
    };
  } catch (error) {
    if (error instanceof ManifestShapeError) return { ok: false, problem: error.message };
    throw error;
  }
}
