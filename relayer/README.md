# TrancheTrade Relayer

A permissionless command-line relayer for the TrancheTrade three-hop chain:

```
Ethereum Sepolia            Attestcoin                  Creditcoin CC3 testnet
InvoiceRegistry       ->    attestation of the    ->    TrancheWaterfall
emits InvoiceRepaid         InvoiceRepaid log           allocates senior-first
```

The relayer is a CLI, not a service. It holds no protocol authority: it may deliver a proof, trigger
an allocation and pay gas, and it can do nothing else. It cannot forge an event, change an amount,
reorder the waterfall, replay an applied attestation, or bypass the fail-closed path.

Invoice data in this project is synthetic and lives on public testnets. Allocation records an
accounting entitlement against an attested repayment; it does not transfer repayment cash.

## Requirements

- Node 20 or newer (developed on Node 26).
- Contract addresses and ABIs in `docs/evidence/deployments.json` and `docs/evidence/abi/*.json`.
  These are produced by the Contracts Engineer and read at runtime. No address is hardcoded here.

`deployments.json` is expected to hold, either at the top level or under a `contracts` key:

```json
{
  "invoiceRegistry":    { "chainId": 11155111, "address": "0x...", "deployTxHash": "0x...", "deployBlockNumber": 0 },
  "trancheWaterfall":   { "chainId": 102031,   "address": "0x..." },
  "attestcoinVerifier": { "chainId": 102031,   "address": "0x..." }
}
```

ABI files are read from `docs/evidence/abi/InvoiceRegistry.json`, `TrancheWaterfall.json` and
`AttestcoinVerifier.json`, as either a bare ABI array or an object with an `abi` array.

## Environment

Configuration is read from the process environment only. This project never reads, writes, or
creates a `.env` file, and never calls `dotenv.config()`, even though `@gluwa/usc-sdk` ships `dotenv`
as a transitive dependency.

| Variable | Required by | Default |
|---|---|---|
| `SEPOLIA_RPC_URL` | `issue`, `repay`, `prove`, `manifest` | none |
| `CREDITCOIN_RPC_URL` | every CC3 command | `https://rpc.cc3-testnet.creditcoin.network` |
| `PROVER_URL` | `prove` | `https://prover.cc3-testnet.creditcoin.network` |
| `RELAYER_PRIVATE_KEY` | `issue`, `repay`, `deposit`, `allocate` | none |

Export them in your shell. Never commit them, never echo them, never print the key.

`prove`, `verify`, `snapshot`, `chains` and `manifest` are read-only and do not need
`RELAYER_PRIVATE_KEY`.

## Install and build

```
npm install
npm run typecheck
npm run build
```

`npm run relayer -- <command>` runs from source through `tsx`. `node dist/cli.js <command>` runs the
build. Node's native TypeScript stripping cannot resolve the `.js` specifiers used by NodeNext ESM,
so run source through `tsx` rather than `node src/cli.ts`.

`tsconfig.json` maps the `ethers` type entry point explicitly. `ethers` publishes separate ESM and
CommonJS declaration trees under one package name; without the mapping, the ESM declarations used by
this package and the CommonJS declarations used by `@gluwa/usc-sdk` are two distinct nominal types
and every provider argument fails to typecheck.

## Commands

| Command | Chain | Effect |
|---|---|---|
| `issue --face-value <wei> --reference <string>` | Sepolia | `InvoiceRegistry.issueInvoice`, prints the new invoice id |
| `repay --invoice <id> --amount <wei>` | Sepolia | `InvoiceRegistry.repayInvoice`, one `InvoiceRepaid` log |
| `deposit --tranche senior\|junior --amount <wei>` | CC3 | `TrancheWaterfall.deposit` |
| `prove --tx <sepoliaTxHash> --out <path>` | read-only | waits for attestation, fetches the proof, writes a fixture |
| `allocate --proof <path>` | CC3 | `TrancheWaterfall.allocate` |
| `allocate --proof <path> --corrupt <mode>` | CC3 | the fail-closed demo beat |
| `verify --proof <path> [--corrupt <mode>]` | read-only | precompile `verify` plus an `allocate` staticcall, no broadcast |
| `snapshot [--block <n>]` | read-only | prints the full `snapshot()` tuple |
| `manifest` | both | regenerates `docs/evidence/transactions.json` |
| `chains` | read-only | prints the Attestcoin `chainKey` to EVM `chainId` mapping |

Run `verify` before every live broadcast. It tells you whether the transaction will succeed before
you show it to anyone.

## Corruption modes

`allocate --corrupt <mode>` mutates a captured proof deterministically. The same fixture and the same
mode produce byte-identical output on every run; there is no randomness anywhere in `src/corrupt.ts`.

| Mode | Mutation | Observed outcome at the block prover precompile |
|---|---|---|
| `merkle-root` | flips the first byte of `merkleProof.root` | reverts, `Merkle proof validation failed` |
| `sibling` | flips the first byte of `merkleProof.siblings[0].hash` | reverts, `Merkle proof validation failed` |
| `continuity` | flips the first byte of `continuityProof.lowerEndpointDigest` | reverts, `Continuity proof does not match attestation or checkpoint` |
| `tx-bytes` | flips one interior byte of `encodedTransaction` | reverts, `Merkle proof validation failed` |
| `chain-key` | sets `chainKey` to `3`, Ethereum Mainnet | reverts, `Continuity proof does not match attestation or checkpoint` |

`continuity` is the default and the mode used in the demo, because its narration is the most honest:
this is what a stale or pruned attestation actually looks like. Attestcoin proofs do not expire. Age
raises the gas cost of the continuity chain, not the validity of the proof. A genuinely pruned
attestation fails continuity verification and travels the identical code path as a malformed one.
TrancheTrade does not enforce, and does not claim to enforce, a time-based expiry.

The corrupt path has no retry, no spinner, and no ambiguous state. The rejection is the point.

## Worked example

```
export SEPOLIA_RPC_URL=https://your-sepolia-endpoint
export RELAYER_PRIVATE_KEY=<a funded testnet key, never committed>

npm run relayer -- snapshot
npm run relayer -- repay --invoice 1 --amount 25000000000000000000000
npm run relayer -- prove --tx 0x<the hash printed above> --out fixtures/proof-2.json
npm run relayer -- verify --proof fixtures/proof-2.json
npm run relayer -- allocate --proof fixtures/proof-2.json
npm run relayer -- verify --proof fixtures/proof-2.json --corrupt continuity
npm run relayer -- allocate --proof fixtures/proof-2.json --corrupt continuity
npm run relayer -- allocate --proof fixtures/proof-2.json
npm run relayer -- manifest
```

The last `allocate` resubmits an already-applied proof and is expected to revert with
`AlreadyApplied`. Every broadcast appends a record to `fixtures/journal.json`; `manifest` rebuilds
`docs/evidence/transactions.json` from that journal by re-reading each recorded transaction from the
chain. Nothing enters the manifest that was not read back from a real receipt.

## Captured proof fixtures

`fixtures/spike-proof-1.json` and `fixtures/spike-proof-2.json` are real Attestcoin proofs, fetched
from the live CC3 testnet prover and confirmed `true` by the live block prover precompile. They cover
two arbitrary Ethereum Sepolia transactions and exist to prove the Attestcoin integration works; they
are not `InvoiceRepaid` proofs and are not demo material. Copies live in `docs/evidence/proofs/`.

## Safety

- Chain ids are asserted before every broadcast: `11155111` for Sepolia, `102031` for CC3 testnet.
  Creditcoin mainnet is `102030` and is rejected explicitly.
- The `chainKey` used for Attestcoin (`1` for Sepolia) is read from the ChainInfo precompile at
  runtime and asserted against the expected constant. It is not the EVM chain id.
- Every monetary value is a `bigint` or a decimal string end to end. No wei value is ever a
  JavaScript `Number`.
