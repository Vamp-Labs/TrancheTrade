import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  AllocationError,
  broadcastAllocation,
  depositIntoTranche,
  readSnapshot,
  staticVerifyAllocation,
} from './allocate.js';
import { chainInfo } from '@gluwa/usc-sdk';
import {
  ChainAssertionError,
  SEPOLIA_CHAIN_ID,
  creditcoinProvider,
  creditcoinSigner,
  decodeChainName,
  sepoliaProvider,
  sepoliaSigner,
} from './chains.js';
import { ConfigurationError, creditcoinRpcUrl, manifestPath, proverUrl } from './config.js';
import {
  CORRUPTION_MODES,
  CORRUPTION_MODE_DESCRIPTIONS,
  CorruptionError,
  DEFAULT_CORRUPTION_MODE,
  corruptProof,
  describeCorruption,
  isCorruptionMode,
} from './corrupt.js';
import { InvoiceError, issueInvoice, repayInvoice } from './invoice.js';
import {
  ManifestError,
  appendJournalEntry,
  nextCycleId,
  regenerateManifest,
  repositoryRelativePath,
  writeManifest,
} from './manifest.js';
import type { JournalEntryWithRejection } from './manifest.js';
import {
  ProofError,
  deriveAscBaseQueryId,
  fetchProof,
  readProofFixture,
  verifyAgainstPrecompile,
  writeProofFixture,
} from './proof.js';
import type { AttestcoinProof, CorruptionMode, ProofFixture, TrancheSnapshot } from './types.js';

const REJECTION_NOTICE = 'Attestation failed — balances held at prior state, no funds moved.';

const DEFAULT_ATTESTATION_POLL_INTERVAL_MS = 15_000;
const DEFAULT_ATTESTATION_TIMEOUT_MS = 900_000;

class UsageError extends Error {}

const USAGE = `TrancheTrade relayer — permissionless CLI for Ethereum Sepolia to Attestcoin to Creditcoin CC3.

Usage: relayer <command> [options]

Commands
  issue     --face-value <wei> --reference <string>       Sepolia  InvoiceRegistry.issueInvoice
  repay     --invoice <id> --amount <wei>                 Sepolia  InvoiceRegistry.repayInvoice
  deposit   --tranche senior|junior --amount <wei>        CC3      TrancheWaterfall.deposit
  prove     --tx <sepoliaTxHash> --out <path>             -        fetch and store an Attestcoin proof
  allocate  --proof <path> [--corrupt <mode>]             CC3      TrancheWaterfall.allocate
  verify    --proof <path> [--corrupt <mode>]             CC3      dry-run staticcall, no broadcast
  snapshot  [--block <number>]                            CC3      print the full snapshot() tuple
  manifest                                                both     regenerate docs/evidence/transactions.json
  chains                                                  CC3      print the Attestcoin chainKey mapping

Global options
  --label <string>   label recorded on the manifest cycle written by issue, repay, allocate
  --invoice <id>     invoice id recorded on the manifest cycle written by allocate
  --gas-limit <n>    explicit gas limit; required to broadcast a proof the node already knows will revert
  --json             print machine-readable JSON instead of prose
  --help             print this message

Corruption modes for --corrupt (default: ${DEFAULT_CORRUPTION_MODE})
${CORRUPTION_MODES.map((mode) => `  ${mode.padEnd(12)} ${CORRUPTION_MODE_DESCRIPTIONS[mode]}`).join('\n')}

Environment (names only; never write these into a file in this repository)
  SEPOLIA_RPC_URL       required for Sepolia reads and writes
  CREDITCOIN_RPC_URL    optional, defaults to the CC3 testnet endpoint
  PROVER_URL            optional, defaults to the CC3 testnet prover
  RELAYER_PRIVATE_KEY   required only by commands that broadcast

Invoice data in this project is synthetic and lives on public testnets. Allocation records an
accounting entitlement against an attested repayment; it does not transfer repayment cash.
`;

function requireOption(values: Record<string, unknown>, name: string): string {
  const value = values[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new UsageError(`Missing required option --${name}.`);
  }
  return value;
}

function optionalOption(values: Record<string, unknown>, name: string): string | null {
  const value = values[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseWei(raw: string, optionName: string): bigint {
  if (!/^[0-9]+$/.test(raw)) {
    throw new UsageError(
      `--${optionName} must be a decimal integer amount in wei, with no decimal point and no exponent. Received: ${raw}`,
    );
  }
  return BigInt(raw);
}

function parseCorruptionMode(raw: string | null): CorruptionMode | null {
  if (raw === null) {
    return null;
  }
  const normalised = raw.length === 0 ? DEFAULT_CORRUPTION_MODE : raw;
  if (!isCorruptionMode(normalised)) {
    throw new UsageError(
      `Unknown corruption mode "${raw}". Valid modes: ${CORRUPTION_MODES.join(', ')}.`,
    );
  }
  return normalised;
}

function printSnapshot(snapshot: TrancheSnapshot): void {
  for (const [name, value] of Object.entries(snapshot.raw)) {
    process.stdout.write(`  ${name.padEnd(24)} ${value}\n`);
  }
}

function snapshotsAreIdentical(before: TrancheSnapshot, after: TrancheSnapshot): boolean {
  return JSON.stringify(before.raw) === JSON.stringify(after.raw);
}

async function commandChains(json: boolean): Promise<void> {
  const creditcoin = creditcoinProvider();
  const provider = new chainInfo.PrecompileChainInfoProvider(creditcoin);
  const chains = await provider.getSupportedChains();
  const rows = chains.map((entry) => ({
    chainKey: entry.chainKey,
    chainId: entry.chainId,
    chainName: decodeChainName(entry.chainName),
    chainEncoding: entry.chainEncoding,
  }));
  if (json) {
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
    return;
  }
  process.stdout.write(`Attestcoin chain registry read from the ChainInfo precompile via ${creditcoinRpcUrl()}\n`);
  for (const row of rows) {
    process.stdout.write(
      `  chainKey ${String(row.chainKey).padEnd(4)} chainId ${String(row.chainId).padEnd(10)} ${row.chainName} (encoding ${row.chainEncoding})\n`,
    );
  }
  const sepolia = rows.find((row) => row.chainId === SEPOLIA_CHAIN_ID);
  if (sepolia !== undefined) {
    process.stdout.write(
      `\nEthereum Sepolia is chainKey ${sepolia.chainKey}; its EVM chainId is ${sepolia.chainId}. These are different numbers and must not be interchanged.\n`,
    );
  }
}

async function commandIssue(values: Record<string, unknown>, json: boolean): Promise<void> {
  const faceValue = parseWei(requireOption(values, 'face-value'), 'face-value');
  const reference = requireOption(values, 'reference');
  const provider = sepoliaProvider();
  const signer = await sepoliaSigner(provider);
  const result = await issueInvoice(signer, provider, faceValue, reference);
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  process.stdout.write(`issueInvoice ${result.status}\n`);
  process.stdout.write(`  tx        ${result.txHash}\n`);
  process.stdout.write(`  explorer  ${result.explorerUrl}\n`);
  process.stdout.write(`  block     ${result.blockNumber ?? 'pending'}\n`);
  process.stdout.write(`  gasUsed   ${result.gasUsed ?? 'unknown'}\n`);
  if (result.eventName !== null) {
    process.stdout.write(`  event     ${result.eventName} at log index ${result.logIndex ?? 'unknown'}\n`);
    for (const [name, value] of Object.entries(result.eventArgs)) {
      process.stdout.write(`    ${name.padEnd(20)} ${value}\n`);
    }
  }
}

async function commandRepay(values: Record<string, unknown>, json: boolean): Promise<void> {
  const invoiceId = BigInt(requireOption(values, 'invoice'));
  const amount = parseWei(requireOption(values, 'amount'), 'amount');
  const provider = sepoliaProvider();
  const signer = await sepoliaSigner(provider);
  const result = await repayInvoice(signer, provider, invoiceId, amount);
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  process.stdout.write(`repayInvoice ${result.status}\n`);
  process.stdout.write(`  tx        ${result.txHash}\n`);
  process.stdout.write(`  explorer  ${result.explorerUrl}\n`);
  process.stdout.write(`  block     ${result.blockNumber ?? 'pending'}\n`);
  process.stdout.write(`  gasUsed   ${result.gasUsed ?? 'unknown'}\n`);
  if (result.eventName !== null) {
    process.stdout.write(`  event     ${result.eventName} at log index ${result.logIndex ?? 'unknown'}\n`);
    for (const [name, value] of Object.entries(result.eventArgs)) {
      process.stdout.write(`    ${name.padEnd(20)} ${value}\n`);
    }
  }
  process.stdout.write(`\nNext: relayer prove --tx ${result.txHash} --out fixtures/proof-<n>.json\n`);
}

async function commandDeposit(values: Record<string, unknown>, json: boolean): Promise<void> {
  const trancheRaw = requireOption(values, 'tranche');
  if (trancheRaw !== 'senior' && trancheRaw !== 'junior') {
    throw new UsageError(`--tranche must be "senior" or "junior". Received: ${trancheRaw}`);
  }
  const amount = parseWei(requireOption(values, 'amount'), 'amount');
  const provider = creditcoinProvider();
  const signer = await creditcoinSigner(provider);
  const before = await readSnapshot(provider);
  const result = await depositIntoTranche(signer, provider, trancheRaw, amount);
  const after = await readSnapshot(provider);
  if (json) {
    process.stdout.write(`${JSON.stringify({ result, before, after }, null, 2)}\n`);
    return;
  }
  process.stdout.write(`deposit ${trancheRaw} ${result.status}\n`);
  process.stdout.write(`  tx        ${result.txHash}\n`);
  process.stdout.write(`  explorer  ${result.explorerUrl}\n`);
  process.stdout.write(`  block     ${result.blockNumber ?? 'pending'}\n`);
  process.stdout.write('\nsnapshot before\n');
  printSnapshot(before);
  process.stdout.write('snapshot after\n');
  printSnapshot(after);
}

async function commandProve(values: Record<string, unknown>, json: boolean): Promise<void> {
  const txHash = requireOption(values, 'tx');
  const out = requireOption(values, 'out');
  const sepolia = sepoliaProvider();
  const creditcoin = creditcoinProvider();
  const outPath = resolve(process.cwd(), out);

  const fetched = await fetchProof({
    sepolia,
    creditcoin,
    txHash,
    pollIntervalMs: DEFAULT_ATTESTATION_POLL_INTERVAL_MS,
    waitTimeoutMs: DEFAULT_ATTESTATION_TIMEOUT_MS,
    onWaiting: (message) => {
      if (!json) {
        process.stdout.write(`${message}\n`);
      }
    },
  });

  const { verified, revertReason } = await verifyAgainstPrecompile(creditcoin, fetched.proof);
  if (!verified) {
    throw new ProofError(
      `The proof was fetched but the Creditcoin block prover precompile refused it: ${revertReason ?? 'no reason returned'}. Refusing to write a fixture that would not verify on chain.`,
    );
  }

  const fixture: ProofFixture = {
    version: 1,
    source: fetched.source,
    attestation: {
      chainKey: fetched.proof.chainKey,
      attestedHeight: fetched.proof.headerNumber,
      attestationId: fetched.attestationId,
      proverUrl: proverUrl(),
      fetchedAt: fetched.fetchedAt,
      cached: fetched.cached,
      continuityHashCount: fetched.proof.continuityProof.roots.length,
      status: 'attested',
      corruptionMode: null,
    },
    proof: fetched.proof,
  };
  writeProofFixture(outPath, fixture);

  if (json) {
    process.stdout.write(`${JSON.stringify(fixture, null, 2)}\n`);
    return;
  }
  process.stdout.write('\nProof fetched and verified read-only against the block prover precompile.\n');
  process.stdout.write(`  sourceTx            ${fixture.source.txHash}\n`);
  process.stdout.write(`  sourceBlock         ${fixture.source.blockNumber}\n`);
  process.stdout.write(`  receiptStatus       ${fixture.source.receiptStatus}\n`);
  process.stdout.write(`  chainKey            ${fixture.proof.chainKey}\n`);
  process.stdout.write(`  txIndex             ${fixture.proof.txIndex}\n`);
  process.stdout.write(`  encodedTransaction  ${(fixture.proof.txBytes.length - 2) / 2} bytes\n`);
  process.stdout.write(`  merkleSiblings      ${fixture.proof.merkleProof.siblings.length}\n`);
  process.stdout.write(`  continuityRoots     ${fixture.proof.continuityProof.roots.length}\n`);
  process.stdout.write(`  cached              ${fixture.attestation.cached}\n`);
  process.stdout.write(`  attestationId       ${fixture.attestation.attestationId}\n`);
  process.stdout.write(
    `  ascBaseQueryId      ${deriveAscBaseQueryId(fixture.proof.chainKey, fixture.proof.headerNumber, fixture.proof.txIndex)}\n`,
  );
  process.stdout.write(`  verify()            true\n`);
  process.stdout.write(`  written             ${repositoryRelativePath(outPath)}\n`);
}

function loadProofForCommand(
  values: Record<string, unknown>,
): { fixture: ProofFixture; proof: AttestcoinProof; mode: CorruptionMode | null; path: string } {
  const path = resolve(process.cwd(), requireOption(values, 'proof'));
  const fixture = readProofFixture(path);
  const mode = parseCorruptionMode(optionalOption(values, 'corrupt'));
  const proof = mode === null ? fixture.proof : corruptProof(fixture.proof, mode);
  return { fixture, proof, mode, path };
}

async function commandVerify(values: Record<string, unknown>, json: boolean): Promise<void> {
  const { proof, mode, path } = loadProofForCommand(values);
  const creditcoin = creditcoinProvider();
  const precompile = await verifyAgainstPrecompile(creditcoin, proof);

  let allocate: Awaited<ReturnType<typeof staticVerifyAllocation>> | null = null;
  let allocateError: string | null = null;
  try {
    allocate = await staticVerifyAllocation(creditcoin, proof);
  } catch (error) {
    allocateError = error instanceof Error ? error.message : String(error);
  }

  if (json) {
    process.stdout.write(`${JSON.stringify({ path, mode, precompile, allocate, allocateError }, null, 2)}\n`);
    return;
  }
  process.stdout.write(`verify (dry run, no broadcast)\n`);
  process.stdout.write(`  fixture             ${repositoryRelativePath(path)}\n`);
  process.stdout.write(`  corruptionMode      ${mode ?? 'none'}\n`);
  process.stdout.write(`  precompile verify   ${precompile.verified}\n`);
  if (precompile.revertReason !== null) {
    process.stdout.write(`  precompile revert   ${precompile.revertReason}\n`);
  }
  if (allocate === null) {
    process.stdout.write(`  allocate staticcall not attempted: ${allocateError ?? 'unknown reason'}\n`);
    return;
  }
  process.stdout.write(`  allocate staticcall ${allocate.willSucceed ? 'would succeed' : 'would revert'}\n`);
  if (allocate.rejection !== null) {
    process.stdout.write(`    reason            ${allocate.rejection.reason}\n`);
    process.stdout.write(`    errorSignature    ${allocate.rejection.errorSignature}\n`);
    process.stdout.write(`    revertData        ${allocate.rejection.revertData ?? 'none'}\n`);
  }
}

async function commandAllocate(values: Record<string, unknown>, json: boolean): Promise<void> {
  const { fixture, proof, mode, path } = loadProofForCommand(values);
  const gasLimitRaw = optionalOption(values, 'gas-limit');
  const gasLimit = gasLimitRaw === null ? null : BigInt(gasLimitRaw);
  const label = optionalOption(values, 'label');
  const invoiceId = optionalOption(values, 'invoice') ?? fixture.source.invoiceId;

  const creditcoin = creditcoinProvider();
  const signer = await creditcoinSigner(creditcoin);

  if (mode !== null && !json) {
    process.stdout.write(`Corrupting the captured proof deterministically, mode "${mode}".\n`);
    process.stdout.write(`  ${describeCorruption(fixture.proof, mode)}\n\n`);
  }

  const before = await readSnapshot(creditcoin);
  const result = await broadcastAllocation(signer, creditcoin, proof, gasLimit);
  const after = await readSnapshot(creditcoin);

  const entry: JournalEntryWithRejection = {
    id: nextCycleId(),
    kind: result.status === 'success' ? 'allocation' : 'rejection',
    label:
      label ??
      (mode === null ? 'Attested repayment allocation' : `Deliberately malformed attestation (${mode})`),
    occurredAt: new Date().toISOString(),
    invoiceId,
    sourceTxHash: fixture.source.txHash,
    proofPath: repositoryRelativePath(path),
    corruptionMode: mode,
    destinationTxHash: result.txHash,
    snapshotBefore: before,
    snapshotAfter: after,
  };
  if (result.rejection !== null) {
    entry.rejection = {
      reason: result.rejection.reason,
      errorSignature: result.rejection.errorSignature,
      revertData: result.rejection.revertData,
    };
  }
  appendJournalEntry(entry);

  if (json) {
    process.stdout.write(`${JSON.stringify({ result, before, after, entry }, null, 2)}\n`);
    return;
  }

  process.stdout.write(`allocate ${result.status}\n`);
  process.stdout.write(`  tx        ${result.txHash}\n`);
  process.stdout.write(`  explorer  ${result.explorerUrl}\n`);
  process.stdout.write(`  block     ${result.blockNumber ?? 'pending'}\n`);
  process.stdout.write(`  gasUsed   ${result.gasUsed ?? 'unknown'}\n`);

  if (result.status === 'success') {
    process.stdout.write('\nsnapshot before\n');
    printSnapshot(before);
    process.stdout.write('snapshot after\n');
    printSnapshot(after);
    process.stdout.write(`\nJournal entry ${entry.id} recorded. Run "relayer manifest" to regenerate ${repositoryRelativePath(manifestPath)}.\n`);
    return;
  }

  if (result.rejection !== null) {
    process.stdout.write(`  reason    ${result.rejection.reason}\n`);
    process.stdout.write(`  error     ${result.rejection.errorSignature}\n`);
    process.stdout.write(`  data      ${result.rejection.revertData ?? 'none'}\n`);
  }
  process.stdout.write('\nsnapshot before\n');
  printSnapshot(before);
  process.stdout.write('snapshot after\n');
  printSnapshot(after);
  process.stdout.write(
    `\nbalances unchanged: ${snapshotsAreIdentical(before, after) ? 'yes' : 'NO — investigate before demonstrating this'}\n`,
  );
  process.stdout.write(`\n${REJECTION_NOTICE}\n`);
  process.exitCode = 1;
}

async function commandSnapshot(values: Record<string, unknown>, json: boolean): Promise<void> {
  const blockRaw = optionalOption(values, 'block');
  const provider = creditcoinProvider();
  const snapshot =
    blockRaw === null ? await readSnapshot(provider) : await readSnapshot(provider, Number.parseInt(blockRaw, 10));
  if (json) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }
  process.stdout.write(`TrancheWaterfall.snapshot()${blockRaw === null ? '' : ` at block ${blockRaw}`}\n`);
  printSnapshot(snapshot);
}

async function commandManifest(json: boolean): Promise<void> {
  let sepolia = null;
  try {
    sepolia = sepoliaProvider();
  } catch (error) {
    if (!(error instanceof ConfigurationError)) {
      throw error;
    }
  }
  const creditcoin = creditcoinProvider();
  const manifest = await regenerateManifest({ sepolia, creditcoin });
  const written = writeManifest(manifest);
  if (json) {
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    return;
  }
  process.stdout.write(`Wrote ${repositoryRelativePath(written)} with ${manifest.cycles.length} cycle(s).\n`);
  for (const cycle of manifest.cycles) {
    process.stdout.write(
      `  ${cycle.id.padEnd(10)} ${cycle.kind.padEnd(10)} ${cycle.destination?.status ?? 'unknown'} ${cycle.destination?.txHash ?? '(no destination transaction)'}\n`,
    );
  }
  if (sepolia === null) {
    process.stdout.write(
      '\nSEPOLIA_RPC_URL was not set, so Sepolia block numbers were taken from proof fixtures only.\n',
    );
  }
}

function reportError(error: unknown): void {
  if (
    error instanceof UsageError ||
    error instanceof ConfigurationError ||
    error instanceof ChainAssertionError ||
    error instanceof ProofError ||
    error instanceof AllocationError ||
    error instanceof InvoiceError ||
    error instanceof ManifestError ||
    error instanceof CorruptionError
  ) {
    process.stderr.write(`${error.message}\n`);
    return;
  }
  if (error instanceof Error) {
    process.stderr.write(`${error.message}\n`);
    return;
  }
  process.stderr.write(`${String(error)}\n`);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    strict: true,
    options: {
      'face-value': { type: 'string' },
      reference: { type: 'string' },
      invoice: { type: 'string' },
      amount: { type: 'string' },
      tranche: { type: 'string' },
      tx: { type: 'string' },
      out: { type: 'string' },
      proof: { type: 'string' },
      corrupt: { type: 'string' },
      block: { type: 'string' },
      label: { type: 'string' },
      'gas-limit': { type: 'string' },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });

  const command = positionals[0];
  const json = values.json === true;

  if (values.help === true || command === undefined || command === 'help') {
    process.stdout.write(USAGE);
    return;
  }

  switch (command) {
    case 'issue':
      await commandIssue(values, json);
      return;
    case 'repay':
      await commandRepay(values, json);
      return;
    case 'deposit':
      await commandDeposit(values, json);
      return;
    case 'prove':
      await commandProve(values, json);
      return;
    case 'allocate':
      await commandAllocate(values, json);
      return;
    case 'verify':
      await commandVerify(values, json);
      return;
    case 'snapshot':
      await commandSnapshot(values, json);
      return;
    case 'manifest':
      await commandManifest(json);
      return;
    case 'chains':
      await commandChains(json);
      return;
    default:
      throw new UsageError(`Unknown command "${command}". Run "relayer --help" for the command list.`);
  }
}

void (async (): Promise<void> => {
  try {
    await main();
  } catch (error) {
    reportError(error);
    process.exitCode = 1;
  }
})();

