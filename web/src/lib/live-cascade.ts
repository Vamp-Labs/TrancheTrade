import { createPublicClient, decodeEventLog, http, type Log, type PublicClient } from 'viem';
import { creditcoinCc3Chain } from '@/lib/chains';
import { trancheWaterfallAbi, type EvmAddress } from '@/lib/contracts';
import { deriveBeatsFromEventLogOrder, type CascadeEvent } from '@/lib/beats';
import { creditcoinCc3, transactionUrl } from '@/lib/networks';

export function createBrowserPoolClient(): PublicClient {
  return createPublicClient({
    chain: creditcoinCc3Chain,
    transport: http(creditcoinCc3.rpcUrl, { fetchOptions: { cache: 'no-store' } })
  });
}

interface RepaymentSummary {
  attestationId: string;
  invoiceId: string;
  attestedAmount: bigint;
  transactionHash: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function decodeRepayment(log: Log): RepaymentSummary | null {
  if (log.transactionHash === null) return null;
  let decoded: { eventName: string; args: unknown };
  try {
    decoded = decodeEventLog({ abi: trancheWaterfallAbi, data: log.data, topics: log.topics });
  } catch {
    return null;
  }
  if (decoded.eventName !== 'RepaymentAllocated') return null;
  const args = asRecord(decoded.args);
  if (args === null) return null;
  const attestationId = args['attestationId'];
  const invoiceId = args['invoiceId'];
  const attestedAmount = args['attestedAmount'];
  if (typeof attestationId !== 'string') return null;
  if (typeof invoiceId !== 'bigint' || typeof attestedAmount !== 'bigint') return null;
  return {
    attestationId,
    invoiceId: invoiceId.toString(),
    attestedAmount,
    transactionHash: log.transactionHash
  };
}

export function cascadeEventsFromLogs(logs: readonly Log[]): readonly CascadeEvent[] {
  const byTransaction = new Map<string, Log[]>();
  for (const log of logs) {
    if (log.transactionHash === null) continue;
    const bucket = byTransaction.get(log.transactionHash);
    if (bucket === undefined) byTransaction.set(log.transactionHash, [log]);
    else bucket.push(log);
  }

  const events: CascadeEvent[] = [];
  for (const [transactionHash, group] of byTransaction) {
    let repayment: RepaymentSummary | null = null;
    for (const log of group) {
      const summary = decodeRepayment(log);
      if (summary !== null) repayment = summary;
    }
    if (repayment === null) continue;
    const orderedBeats = deriveBeatsFromEventLogOrder(group);
    if (orderedBeats.length === 0) continue;
    events.push({
      key: `${transactionHash}:${repayment.attestationId}`,
      attestationId: repayment.attestationId,
      invoiceId: repayment.invoiceId,
      attestedAmount: repayment.attestedAmount,
      orderedBeats,
      seniorAllocatedTotalBefore: null,
      juniorAllocatedTotalBefore: null,
      derivation: 'event-log-order',
      destinationChainId: creditcoinCc3.chainId,
      destinationTxHash: transactionHash,
      sourceChainId: null,
      sourceTxHash: null,
      destinationExplorerUrl: transactionUrl(creditcoinCc3.chainId, transactionHash),
      sourceExplorerUrl: null,
      label: null
    });
  }
  return events;
}

export interface LiveReadWindow {
  fromBlock: bigint;
  toBlock: bigint;
  events: readonly CascadeEvent[];
}

export async function readCascadeWindow(
  client: PublicClient,
  address: EvmAddress,
  fromBlock: bigint | null
): Promise<LiveReadWindow> {
  const latest = await client.getBlockNumber();
  const start = fromBlock === null ? latest : fromBlock;
  if (start > latest) return { fromBlock: start, toBlock: latest, events: [] };
  const logs = await client.getLogs({ address, fromBlock: start, toBlock: latest });
  return { fromBlock: start, toBlock: latest, events: cascadeEventsFromLogs(logs) };
}
