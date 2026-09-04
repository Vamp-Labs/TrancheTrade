export interface MerkleProofEntry {
  hash: string;
  isLeft: boolean;
}

export interface MerkleProof {
  root: string;
  siblings: MerkleProofEntry[];
}

export interface ContinuityProof {
  lowerEndpointDigest: string;
  roots: string[];
}

export interface AttestcoinProof {
  chainKey: number;
  headerNumber: number;
  txIndex: number;
  txHash: string;
  txBytes: string;
  merkleProof: MerkleProof;
  continuityProof: ContinuityProof;
}

export type AttestationStatus = 'pending' | 'attested' | 'failed' | 'corrupted';

export type CorruptionMode = 'merkle-root' | 'sibling' | 'continuity' | 'tx-bytes' | 'chain-key';

export interface ProofFixtureSource {
  chain: string;
  chainId: number;
  txHash: string;
  blockNumber: number;
  transactionIndex: number;
  receiptStatus: number;
  event: string | null;
  logIndex: number | null;
  invoiceId: string | null;
  amount: string | null;
}

export interface ProofFixtureAttestation {
  chainKey: number;
  attestedHeight: number;
  attestationId: string;
  proverUrl: string;
  fetchedAt: string;
  cached: boolean;
  continuityHashCount: number;
  status: AttestationStatus;
  corruptionMode: CorruptionMode | null;
}

export interface ProofFixture {
  version: 1;
  source: ProofFixtureSource;
  attestation: ProofFixtureAttestation;
  proof: AttestcoinProof;
}

export interface TrancheSnapshot {
  seniorOutstanding: string;
  seniorClaimed: string | null;
  juniorOutstanding: string;
  juniorClaimed: string | null;
  raw: Record<string, string>;
}

export type CycleKind = 'allocation' | 'rejection';

export interface JournalEntry {
  id: string;
  kind: CycleKind;
  label: string;
  occurredAt: string;
  invoiceId: string | null;
  sourceTxHash: string | null;
  proofPath: string | null;
  corruptionMode: CorruptionMode | null;
  destinationTxHash: string | null;
  snapshotBefore: TrancheSnapshot | null;
  snapshotAfter: TrancheSnapshot | null;
}

export interface ManifestContractReference {
  chainId: number;
  address: string | null;
}

export interface ManifestSource {
  chain: string;
  chainId: number;
  event: string | null;
  txHash: string;
  blockNumber: number | null;
  logIndex: number | null;
  amount: string | null;
  explorerUrl: string;
}

export interface ManifestAttestation {
  chainKey: number;
  attestedHeight: number | null;
  attestationId: string | null;
  proverUrl: string;
  fetchedAt: string | null;
  cached: boolean;
  continuityHashCount: number | null;
  status: AttestationStatus;
  corruptionMode?: CorruptionMode;
}

export interface ManifestDestination {
  chain: string;
  chainId: number;
  txHash: string | null;
  blockNumber: number | null;
  status: 'success' | 'reverted' | 'pending' | 'not-broadcast';
  gasUsed: string | null;
  explorerUrl: string | null;
}

export interface ManifestAllocation {
  attestedAmount: string;
  seniorAllocation: string;
  juniorAllocation: string;
  seniorOutstandingBefore: string;
  seniorOutstandingAfter: string;
  juniorOutstandingBefore: string;
  juniorOutstandingAfter: string;
}

export interface ManifestRejection {
  reason: string;
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
  invoiceId: string | null;
  source: ManifestSource | null;
  attestation: ManifestAttestation | null;
  destination: ManifestDestination | null;
  allocation: ManifestAllocation | null;
  rejection: ManifestRejection | null;
}

export interface Manifest {
  version: 1;
  generatedAt: string;
  commit: string | null;
  contracts: {
    invoiceRegistry: ManifestContractReference;
    trancheWaterfall: ManifestContractReference;
    attestcoinVerifier: ManifestContractReference;
  };
  cycles: ManifestCycle[];
}
