import { ETHEREUM_MAINNET_CHAIN_KEY } from './chains.js';
import type { AttestcoinProof, CorruptionMode } from './types.js';

export const CORRUPTION_MODES: readonly CorruptionMode[] = [
  'merkle-root',
  'sibling',
  'continuity',
  'tx-bytes',
  'chain-key',
];

export const DEFAULT_CORRUPTION_MODE: CorruptionMode = 'continuity';

export const CORRUPTION_MODE_DESCRIPTIONS: Readonly<Record<CorruptionMode, string>> = {
  'merkle-root': 'flips the first byte of merkleProof.root; Merkle inclusion fails inside the precompile',
  sibling: 'flips the first byte of merkleProof.siblings[0].hash; Merkle inclusion fails inside the precompile',
  continuity:
    'flips the first byte of continuityProof.lowerEndpointDigest; the continuity chain fails, which is the pruned or stale attestation analogue',
  'tx-bytes': 'flips one byte inside encodedTransaction; Merkle inclusion fails inside the precompile',
  'chain-key': 'sets chainKey to Ethereum Mainnet so the adapter rejects the proof on a chainKey mismatch',
};

export class CorruptionError extends Error {}

export function isCorruptionMode(value: string): value is CorruptionMode {
  return (CORRUPTION_MODES as readonly string[]).includes(value);
}

const HEX_PREFIX_LENGTH = 2;
const FIRST_BYTE_INDEX = 0;

function byteCount(hex: string): number {
  return (hex.length - HEX_PREFIX_LENGTH) / 2;
}

function assertHexString(value: string, field: string): void {
  if (!/^0x([0-9a-fA-F]{2})+$/.test(value)) {
    throw new CorruptionError(`${field} is not an even-length 0x-prefixed hex string: ${value}`);
  }
}

function flipByteAt(hex: string, byteIndex: number, field: string): string {
  assertHexString(hex, field);
  const total = byteCount(hex);
  if (byteIndex < 0 || byteIndex >= total) {
    throw new CorruptionError(`Cannot flip byte ${byteIndex} of ${field}: it holds only ${total} bytes.`);
  }
  const start = HEX_PREFIX_LENGTH + byteIndex * 2;
  const current = Number.parseInt(hex.slice(start, start + 2), 16);
  const flipped = (current ^ 0xff).toString(16).padStart(2, '0');
  return hex.slice(0, start) + flipped + hex.slice(start + 2);
}

function deterministicInteriorByteIndex(hex: string): number {
  return Math.floor(byteCount(hex) / 2);
}

function cloneProof(proof: AttestcoinProof): AttestcoinProof {
  return {
    chainKey: proof.chainKey,
    headerNumber: proof.headerNumber,
    txIndex: proof.txIndex,
    txHash: proof.txHash,
    txBytes: proof.txBytes,
    merkleProof: {
      root: proof.merkleProof.root,
      siblings: proof.merkleProof.siblings.map((sibling) => ({
        hash: sibling.hash,
        isLeft: sibling.isLeft,
      })),
    },
    continuityProof: {
      lowerEndpointDigest: proof.continuityProof.lowerEndpointDigest,
      roots: [...proof.continuityProof.roots],
    },
  };
}

export function corruptProof(proof: AttestcoinProof, mode: CorruptionMode): AttestcoinProof {
  const corrupted = cloneProof(proof);
  switch (mode) {
    case 'merkle-root':
      corrupted.merkleProof.root = flipByteAt(corrupted.merkleProof.root, FIRST_BYTE_INDEX, 'merkleProof.root');
      return corrupted;
    case 'sibling': {
      const first = corrupted.merkleProof.siblings[0];
      if (first === undefined) {
        throw new CorruptionError(
          'Cannot apply the "sibling" corruption mode: merkleProof.siblings is empty, so there is no sibling hash to mutate.',
        );
      }
      first.hash = flipByteAt(first.hash, FIRST_BYTE_INDEX, 'merkleProof.siblings[0].hash');
      return corrupted;
    }
    case 'continuity':
      corrupted.continuityProof.lowerEndpointDigest = flipByteAt(
        corrupted.continuityProof.lowerEndpointDigest,
        FIRST_BYTE_INDEX,
        'continuityProof.lowerEndpointDigest',
      );
      return corrupted;
    case 'tx-bytes':
      corrupted.txBytes = flipByteAt(
        corrupted.txBytes,
        deterministicInteriorByteIndex(corrupted.txBytes),
        'txBytes',
      );
      return corrupted;
    case 'chain-key':
      if (proof.chainKey === ETHEREUM_MAINNET_CHAIN_KEY) {
        throw new CorruptionError(
          `Cannot apply the "chain-key" corruption mode: the proof already carries chainKey ${ETHEREUM_MAINNET_CHAIN_KEY}, so the mutation would be a no-op.`,
        );
      }
      corrupted.chainKey = ETHEREUM_MAINNET_CHAIN_KEY;
      return corrupted;
  }
}

export function describeCorruption(proof: AttestcoinProof, mode: CorruptionMode): string {
  const corrupted = corruptProof(proof, mode);
  switch (mode) {
    case 'merkle-root':
      return `merkleProof.root ${proof.merkleProof.root} -> ${corrupted.merkleProof.root}`;
    case 'sibling': {
      const before = proof.merkleProof.siblings[0];
      const after = corrupted.merkleProof.siblings[0];
      if (before === undefined || after === undefined) {
        throw new CorruptionError('merkleProof.siblings is empty.');
      }
      return `merkleProof.siblings[0].hash ${before.hash} -> ${after.hash}`;
    }
    case 'continuity':
      return `continuityProof.lowerEndpointDigest ${proof.continuityProof.lowerEndpointDigest} -> ${corrupted.continuityProof.lowerEndpointDigest}`;
    case 'tx-bytes': {
      const index = deterministicInteriorByteIndex(proof.txBytes);
      const start = HEX_PREFIX_LENGTH + index * 2;
      return `txBytes byte ${index} of ${byteCount(proof.txBytes)}: 0x${proof.txBytes.slice(start, start + 2)} -> 0x${corrupted.txBytes.slice(start, start + 2)}`;
    }
    case 'chain-key':
      return `chainKey ${proof.chainKey} -> ${corrupted.chainKey}`;
  }
}
