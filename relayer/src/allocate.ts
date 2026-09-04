import { Contract } from 'ethers';
import type { JsonRpcProvider, TransactionReceipt, Wallet } from 'ethers';
import { loadInterface, requireFunctionFragment } from './abi/index.js';
import { CREDITCOIN_TESTNET_CHAIN_ID, creditcoinTransactionUrl } from './chains.js';
import { readDeployment } from './config.js';
import { extractRevertData, extractRevertReason } from './proof.js';
import type { AttestcoinProof, TrancheSnapshot } from './types.js';

export class AllocationError extends Error {}

export const REJECTION_REASONS: readonly string[] = [
  'InvalidProof',
  'ExpiredProof',
  'StaleProof',
  'AlreadyApplied',
  'AmountZero',
  'ExceedsOutstanding',
];

export const TRANCHE_ORDINALS: Readonly<Record<'senior' | 'junior', number>> = {
  senior: 0,
  junior: 1,
};

export interface DecodedRejection {
  reason: string;
  errorSignature: string;
  revertData: string | null;
  attestationId: string | null;
  rawMessage: string;
}

export function trancheWaterfallContract(runner: JsonRpcProvider | Wallet): Contract {
  const deployment = readDeployment('trancheWaterfall');
  if (deployment.chainId !== CREDITCOIN_TESTNET_CHAIN_ID) {
    throw new AllocationError(
      `deployments.json records TrancheWaterfall on chain ${deployment.chainId}, but this tool only targets Creditcoin CC3 testnet (${CREDITCOIN_TESTNET_CHAIN_ID}).`,
    );
  }
  return new Contract(deployment.address, loadInterface('TrancheWaterfall'), runner);
}

export function buildRepaymentProofArgument(proof: AttestcoinProof): Record<string, unknown> {
  return {
    chainKey: proof.chainKey,
    height: proof.headerNumber,
    encodedTransaction: proof.txBytes,
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

export async function readSnapshot(
  provider: JsonRpcProvider,
  blockTag?: number,
): Promise<TrancheSnapshot> {
  const contract = trancheWaterfallContract(provider);
  const fragment = requireFunctionFragment('TrancheWaterfall', 'snapshot');
  const method = contract['snapshot'];
  if (typeof method !== 'function') {
    throw new AllocationError('TrancheWaterfall ABI exposes no callable snapshot().');
  }
  const result: unknown =
    blockTag === undefined ? await method.staticCall() : await method.staticCall({ blockTag });

  const raw: Record<string, string> = {};
  if ('outputs' in fragment && Array.isArray(fragment.outputs)) {
    const values = Array.isArray(result) ? (result as unknown[]) : [result];
    fragment.outputs.forEach((output, index) => {
      const name = output.name.length > 0 ? output.name : `output${index}`;
      const value = values[index];
      raw[name] = typeof value === 'bigint' ? value.toString() : String(value);
    });
  }

  const pick = (needle: string): string | null => {
    const normalise = (value: string): string => value.replace(/_+$/, '').toLowerCase();
    for (const [name, value] of Object.entries(raw)) {
      if (normalise(name) === normalise(needle)) {
        return value;
      }
    }
    return null;
  };

  const seniorOutstanding = pick('seniorOutstanding');
  const juniorOutstanding = pick('juniorOutstanding');
  if (seniorOutstanding === null || juniorOutstanding === null) {
    throw new AllocationError(
      `TrancheWaterfall.snapshot() does not expose named outputs "seniorOutstanding" and "juniorOutstanding". Outputs seen: ${Object.keys(raw).join(', ') || '(unnamed)'}. The manifest cannot record before/after balances without them.`,
    );
  }

  return {
    seniorOutstanding,
    seniorClaimed: pick('seniorClaimed'),
    juniorOutstanding,
    juniorClaimed: pick('juniorClaimed'),
    raw,
  };
}

export function decodeAllocationRevert(error: unknown): DecodedRejection {
  const revertData = extractRevertData(error);
  const rawMessage = extractRevertReason(error);
  if (revertData === null || revertData === '0x') {
    return {
      reason: 'Unknown',
      errorSignature: 'unknown',
      revertData,
      attestationId: null,
      rawMessage,
    };
  }
  const iface = loadInterface('TrancheWaterfall');
  const parsed = iface.parseError(revertData);
  if (parsed === null) {
    return {
      reason: 'Unknown',
      errorSignature: 'unknown',
      revertData,
      attestationId: null,
      rawMessage,
    };
  }
  const isAttestationFailed = parsed.name === 'AttestationFailed' && parsed.args.length >= 2;
  const attestationId = isAttestationFailed ? parsed.args[0] : null;
  const ordinal = isAttestationFailed ? parsed.args[1] : null;
  const reasonName =
    typeof ordinal === 'bigint' ? (REJECTION_REASONS[Number(ordinal)] ?? `Unknown(${ordinal.toString()})`) : parsed.name;
  return {
    reason: isAttestationFailed ? reasonName : parsed.name,
    errorSignature: parsed.signature,
    revertData,
    attestationId: typeof attestationId === 'string' ? attestationId : null,
    rawMessage,
  };
}

export interface StaticVerificationResult {
  willSucceed: boolean;
  rejection: DecodedRejection | null;
  returnValue: string | null;
}

export async function staticVerifyAllocation(
  provider: JsonRpcProvider,
  proof: AttestcoinProof,
): Promise<StaticVerificationResult> {
  const contract = trancheWaterfallContract(provider);
  const method = contract['allocate'];
  if (typeof method !== 'function') {
    throw new AllocationError('TrancheWaterfall ABI exposes no callable allocate().');
  }
  try {
    const returned: unknown = await method.staticCall(buildRepaymentProofArgument(proof));
    return {
      willSucceed: true,
      rejection: null,
      returnValue: returned === undefined || returned === null ? null : String(returned),
    };
  } catch (error) {
    return { willSucceed: false, rejection: decodeAllocationRevert(error), returnValue: null };
  }
}

export interface BroadcastResult {
  txHash: string;
  blockNumber: number | null;
  gasUsed: string | null;
  status: 'success' | 'reverted';
  rejection: DecodedRejection | null;
  explorerUrl: string;
}

export async function broadcastAllocation(
  signer: Wallet,
  provider: JsonRpcProvider,
  proof: AttestcoinProof,
  gasLimit: bigint | null,
): Promise<BroadcastResult> {
  const contract = trancheWaterfallContract(signer);
  const method = contract['allocate'];
  if (typeof method !== 'function') {
    throw new AllocationError('TrancheWaterfall ABI exposes no callable allocate().');
  }
  const argument = buildRepaymentProofArgument(proof);
  const overrides = gasLimit === null ? {} : { gasLimit };

  let response;
  try {
    response = await method(argument, overrides);
  } catch (error) {
    const rejection = decodeAllocationRevert(error);
    throw new AllocationError(
      `The node rejected the allocate transaction before it was mined, so there is no transaction hash to record. Decoded reason: ${rejection.reason}. Raw: ${rejection.rawMessage}. Re-run with --gas-limit to force a broadcast that mines as a reverted transaction.`,
    );
  }

  const txHash: string = response.hash;
  const receipt: TransactionReceipt | null = await provider.waitForTransaction(txHash);
  if (receipt === null) {
    return {
      txHash,
      blockNumber: null,
      gasUsed: null,
      status: 'reverted',
      rejection: null,
      explorerUrl: creditcoinTransactionUrl(txHash),
    };
  }

  if (receipt.status === 1) {
    return {
      txHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      status: 'success',
      rejection: null,
      explorerUrl: creditcoinTransactionUrl(txHash),
    };
  }

  let rejection: DecodedRejection | null = null;
  try {
    await provider.call({
      to: receipt.to,
      from: receipt.from,
      data: contract.interface.encodeFunctionData('allocate', [argument]),
      blockTag: receipt.blockNumber,
    });
  } catch (error) {
    rejection = decodeAllocationRevert(error);
  }

  return {
    txHash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    status: 'reverted',
    rejection,
    explorerUrl: creditcoinTransactionUrl(txHash),
  };
}

export interface DepositResult {
  txHash: string;
  blockNumber: number | null;
  gasUsed: string | null;
  status: 'success' | 'reverted';
  explorerUrl: string;
}

export async function depositIntoTranche(
  signer: Wallet,
  provider: JsonRpcProvider,
  tranche: 'senior' | 'junior',
  amount: bigint,
): Promise<DepositResult> {
  const contract = trancheWaterfallContract(signer);
  const fragment = requireFunctionFragment('TrancheWaterfall', 'deposit');
  const method = contract['deposit'];
  if (typeof method !== 'function') {
    throw new AllocationError('TrancheWaterfall ABI exposes no callable deposit().');
  }
  if (!('inputs' in fragment) || !Array.isArray(fragment.inputs)) {
    throw new AllocationError('TrancheWaterfall.deposit has no readable input list in the ABI.');
  }
  const isPayable = 'stateMutability' in fragment && fragment.stateMutability === 'payable';
  const ordinal = TRANCHE_ORDINALS[tranche];

  const args: unknown[] = [];
  for (const input of fragment.inputs) {
    const name = input.name.toLowerCase();
    if (name.includes('tranche')) {
      args.push(ordinal);
    } else if (name.includes('amount') || name.includes('principal')) {
      args.push(amount);
    } else {
      throw new AllocationError(
        `TrancheWaterfall.deposit has an input "${input.name}" (${input.type}) that this relayer does not know how to fill. Signature: ${fragment.format('sighash')}`,
      );
    }
  }
  const overrides = isPayable ? { value: amount } : {};
  const response = await method(...args, overrides);
  const receipt: TransactionReceipt | null = await provider.waitForTransaction(response.hash);
  return {
    txHash: response.hash,
    blockNumber: receipt?.blockNumber ?? null,
    gasUsed: receipt === null ? null : receipt.gasUsed.toString(),
    status: receipt !== null && receipt.status === 1 ? 'success' : 'reverted',
    explorerUrl: creditcoinTransactionUrl(response.hash),
  };
}
