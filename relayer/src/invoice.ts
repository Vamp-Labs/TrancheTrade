import { Contract } from 'ethers';
import type { JsonRpcProvider, TransactionReceipt, Wallet } from 'ethers';
import { loadInterface, requireFunctionFragment } from './abi/index.js';
import { SEPOLIA_CHAIN_ID, sepoliaTransactionUrl } from './chains.js';
import { readDeployment } from './config.js';
import { extractRevertReason } from './proof.js';

export class InvoiceError extends Error {}

export const INVOICE_ISSUED_EVENT = 'InvoiceIssued';
export const INVOICE_REPAID_EVENT = 'InvoiceRepaid';

export function invoiceRegistryContract(runner: JsonRpcProvider | Wallet): Contract {
  const deployment = readDeployment('invoiceRegistry');
  if (deployment.chainId !== SEPOLIA_CHAIN_ID) {
    throw new InvoiceError(
      `deployments.json records InvoiceRegistry on chain ${deployment.chainId}, but this tool only targets Ethereum Sepolia (${SEPOLIA_CHAIN_ID}).`,
    );
  }
  return new Contract(deployment.address, loadInterface('InvoiceRegistry'), runner);
}

export interface SepoliaBroadcastResult {
  txHash: string;
  blockNumber: number | null;
  gasUsed: string | null;
  status: 'success' | 'reverted';
  explorerUrl: string;
  eventName: string | null;
  eventArgs: Record<string, string>;
  logIndex: number | null;
}

async function send(
  contract: Contract,
  functionName: string,
  args: readonly unknown[],
  overrides: Record<string, unknown>,
  provider: JsonRpcProvider,
  expectedEvent: string,
): Promise<SepoliaBroadcastResult> {
  const method = contract[functionName];
  if (typeof method !== 'function') {
    throw new InvoiceError(`InvoiceRegistry ABI exposes no callable ${functionName}().`);
  }
  let response;
  try {
    response = await method(...args, overrides);
  } catch (error) {
    throw new InvoiceError(
      `The node rejected ${functionName} before it was mined: ${extractRevertReason(error)}`,
    );
  }
  const receipt: TransactionReceipt | null = await provider.waitForTransaction(response.hash);
  const result: SepoliaBroadcastResult = {
    txHash: response.hash,
    blockNumber: receipt?.blockNumber ?? null,
    gasUsed: receipt === null ? null : receipt.gasUsed.toString(),
    status: receipt !== null && receipt.status === 1 ? 'success' : 'reverted',
    explorerUrl: sepoliaTransactionUrl(response.hash),
    eventName: null,
    eventArgs: {},
    logIndex: null,
  };
  if (receipt === null) {
    return result;
  }
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== (contract.target as string).toLowerCase()) {
      continue;
    }
    const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
    if (parsed === null || parsed.name !== expectedEvent) {
      continue;
    }
    result.eventName = parsed.name;
    result.logIndex = log.index;
    parsed.fragment.inputs.forEach((input, index) => {
      const value: unknown = parsed.args[index];
      result.eventArgs[input.name.length > 0 ? input.name : `arg${index}`] =
        typeof value === 'bigint' ? value.toString() : String(value);
    });
    break;
  }
  return result;
}

export async function issueInvoice(
  signer: Wallet,
  provider: JsonRpcProvider,
  faceValue: bigint,
  reference: string,
): Promise<SepoliaBroadcastResult> {
  const contract = invoiceRegistryContract(signer);
  const fragment = requireFunctionFragment('InvoiceRegistry', 'issueInvoice');
  if (!('inputs' in fragment) || !Array.isArray(fragment.inputs) || fragment.inputs.length !== 2) {
    throw new InvoiceError(
      `Expected InvoiceRegistry.issueInvoice to take exactly two arguments (face value, reference). Actual signature: ${fragment.format('sighash')}`,
    );
  }
  return send(contract, 'issueInvoice', [faceValue, reference], {}, provider, INVOICE_ISSUED_EVENT);
}

export async function repayInvoice(
  signer: Wallet,
  provider: JsonRpcProvider,
  invoiceId: bigint,
  amount: bigint,
): Promise<SepoliaBroadcastResult> {
  const contract = invoiceRegistryContract(signer);
  const fragment = requireFunctionFragment('InvoiceRegistry', 'repayInvoice');
  if (!('inputs' in fragment) || !Array.isArray(fragment.inputs)) {
    throw new InvoiceError('InvoiceRegistry.repayInvoice has no readable input list in the ABI.');
  }
  const isPayable = 'stateMutability' in fragment && fragment.stateMutability === 'payable';
  const args: unknown[] = fragment.inputs.map((input) => {
    const name = input.name.toLowerCase();
    if (name.includes('invoice') || name === 'id') {
      return invoiceId;
    }
    if (name.includes('amount')) {
      return amount;
    }
    throw new InvoiceError(
      `InvoiceRegistry.repayInvoice has an input "${input.name}" (${input.type}) that this relayer does not know how to fill. Signature: ${fragment.format('sighash')}`,
    );
  });
  const overrides = isPayable ? { value: amount } : {};
  return send(contract, 'repayInvoice', args, overrides, provider, INVOICE_REPAID_EVENT);
}
