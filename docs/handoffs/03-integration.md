# 03 — Attestation Integration & Relayer Engineer

**Project:** TrancheTrade — attestation-gated, risk-stratified trade-finance settlement layer
**Source of truth:** `docs/TrancheTrade_PRD.md` (v1.0). Read §9, §10 Features 2 and 6, §14, §15, §22.
**Deadline:** 2026-09-13 23:59 ET.
**You own:** `/relayer/**`, `docs/evidence/transactions.json`, `docs/evidence/judge-verification.md`,
`docs/evidence/runbook.md`.

You do not need to read any other handoff file. Everything you need is here.

---

## Why this role exists

PRD Risk 5 names the largest execution risk on this project: "Assembling Sepolia → Attestcoin →
Creditcoin as one live, working chain carries integration risk under time pressure." You own that
chain. You are also the only role that touches Attestcoin directly.

You additionally own the evidence that makes the whole project credible to a judge: the transaction
manifest, the public verification instructions, and the demo runbook.

---

## Responsibilities

- Wire the Attestcoin `@gluwa/usc-sdk` against the deployed `InvoiceRegistry` event schema.
- Ship a permissionless relayer CLI that: issues and repays invoices on Sepolia, fetches an
  Attestcoin proof, submits it to `TrancheWaterfall` on Creditcoin CC3, and submits a deliberately
  malformed proof for the fail-closed demo beat.
- Produce and maintain `docs/evidence/transactions.json`, the three-hop manifest the frontend and
  the deck both read.
- Write the public judge-verification instructions and the three-minute demo runbook.
- Deliver a **proof-field mapping brief** to the Contracts Engineer by end of Day 2 so they can
  implement `AttestcoinVerifier.sol`.

---

## Scope

### In scope

- `/relayer/**` — `package.json`, `tsconfig.json`, `src/`, `fixtures/`
- `docs/evidence/transactions.json`
- `docs/evidence/judge-verification.md`
- `docs/evidence/runbook.md`
- `docs/evidence/proofs/*.json` — captured real proof fixtures
- The proof-field mapping brief, delivered as a message to the PM (not as a file you commit into
  another role's territory)

### Out of scope

- **Every `.sol` file.** The Contracts Engineer owns all Solidity, including `AttestcoinVerifier.sol`.
  You supply them the field mapping; you never write or edit the adapter. If you believe the adapter
  is wrong, report it with a reproduction.
- `/contracts/**` entirely, including tests.
- `/web/**` — the Frontend Engineer owns it. You never touch React or the UI.
- `docs/evidence/deployments.json` and `docs/evidence/abi/` — owned by Contracts.
- `docs/evidence/test-output/` — owned by the Test Engineer.
- Any hosted service, server, database, or long-running daemon. The relayer is a CLI. See Constraints.
- The pitch deck itself. You write the runbook; the deck is the PM's and the user's.

---

## Objectives

1. **Day 1: spike.** Before any product code, prove you can fetch a real Attestcoin proof for a real
   Sepolia transaction and get `verify` to return `true` against the CC3 precompile. Nothing else
   you build matters if this does not work, and finding out on Day 6 would end the project.
2. **End of Day 2: deliver the proof-field mapping brief.** The Contracts Engineer is blocked on it
   for `AttestcoinVerifier.sol`.
3. **Day 4–5: the whole-team integration milestone.** One real Sepolia repayment, attested, allocated
   on CC3, with all three hashes captured.
4. Make the fail-closed beat deterministic. A demo failure that fails differently each time is worse
   than no demo.
5. Make every claim in `judge-verification.md` something a stranger can check in under five minutes
   with only a browser.

---

## Requirements

### R-1 — Project setup

```
/relayer
  package.json
  tsconfig.json
  src/
    cli.ts
    config.ts
    chains.ts
    invoice.ts
    proof.ts
    allocate.ts
    corrupt.ts
    manifest.ts
    abi/            (imported from docs/evidence/abi, not re-derived)
  fixtures/
  README.md
```

Node 20+. TypeScript strict.

`tsconfig.json` must include at minimum:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Pre-approved dependencies, nothing else without PM approval:**

- `@gluwa/usc-sdk` (`^0.18.0`) — brings `ethers ^6.15.0`, `axios`, `dotenv`, `exponential-backoff`
  as regular dependencies. You get ethers transitively; still declare `ethers` explicitly at
  `^6.15.0` so your import is not relying on a transitive hoist.
- dev: `typescript`, `tsx`, `@types/node`

For argument parsing use Node's built-in `node:util` `parseArgs`. Do not add `commander`, `yargs`,
or `zod`. The CLI has nine commands; `parseArgs` is sufficient and it costs nothing.

`@gluwa/usc-sdk` depends on `dotenv`. **Never call `dotenv.config()` and never read a `.env` file.**
Configuration comes from `process.env` only, populated by the operator's shell. This is a hard rule,
not a preference.

### R-2 — Configuration

`src/config.ts` reads and validates, failing fast with a readable message naming the missing variable:

| Variable | Purpose |
|---|---|
| `SEPOLIA_RPC_URL` | Ethereum Sepolia JSON-RPC |
| `CREDITCOIN_RPC_URL` | defaults to `https://rpc.cc3-testnet.creditcoin.network` |
| `PROVER_URL` | defaults to `https://prover.cc3-testnet.creditcoin.network` |
| `RELAYER_PRIVATE_KEY` | pays gas on both chains; holds no protocol authority |

Addresses come from `docs/evidence/deployments.json`, read at runtime. Do not hardcode a deployed
address in source; the Contracts Engineer owns that file and it will change.

**Never print, log, or write a private key or a `.env` file. Never echo `process.env` wholesale.**

### R-3 — Network and protocol facts (verified 2026-09-04)

| Fact | Value |
|---|---|
| Sepolia chain id (EVM) | `11155111` |
| Sepolia `chainKey` on CC3 testnet (Attestcoin-internal) | `1` |
| Ethereum Mainnet `chainKey` on CC3 testnet | `3` |
| CC3 testnet chain id | `102031` |
| CC3 testnet RPC | `https://rpc.cc3-testnet.creditcoin.network` |
| CC3 testnet explorer | `https://creditcoin-testnet.blockscout.com` |
| CC3 **mainnet** chain id (never target this) | `102030` |
| Block prover precompile | `0x0000000000000000000000000000000000000FD2` |
| ChainInfo precompile | `0x0000000000000000000000000000000000000fd3` |
| Proof generator API | `https://prover.cc3-testnet.creditcoin.network` |
| Decoder contract (CC3 testnet) | `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` |
| ASC dashboard | `https://dashboard.cc3-testnet.creditcoin.network/` |
| Examples repo | `https://github.com/gluwa/usc-testnet-bridge-examples` |
| CC3 block time / finality | 15 s / 1–3 blocks |
| Attestation cadence (Ethereum) | new attestation ≈ every 2 min, checkpoint ≈ every 20 min |
| Batch limits | `MAX_BATCH_SIZE = 10`, `MAX_BATCH_RANGE = 1000` blocks |
| Source tx size limit | ≈ 500 KB |

**`chainKey` (`1`) is not the EVM `chainId` (`11155111`).** Confusing them is the single most likely
integration bug on this project. `chainInfo.PrecompileChainInfoProvider.getSupportedChains()` returns
objects of the form `{ chainKey: 1, chainId: 11155111, chainName: 'Ethereum Sepolia', chainEncoding: 1 }`
— call it once at startup and assert the mapping rather than trusting a constant.

**tCTC comes from a Discord bot only.** Join `https://discord.gg/creditcoin`, go to `#token-faucet`,
run `/faucet address:<your EVM address>`. There is no HTTP faucet. Fund the relayer wallet on
**Day 1**; this is a human-latency step.

Documentation, all machine-readable: `https://docs.attestcoin.org/llms.txt`,
`https://docs.attestcoin.org/llms-full.txt`, `https://docs.creditcoin.org/llms-full.txt`.

### R-4 — The Attestcoin SDK shape

Reference usage from the official documentation, for orientation. Verify it against the installed
version rather than trusting this transcription.

```typescript
import { JsonRpcProvider } from 'ethers';
import { chainInfo, blockProver, proofProvider } from '@gluwa/usc-sdk';

const chainKey = 1;
const sourceProvider = new JsonRpcProvider(sepoliaRpcUrl);
const creditcoinProvider = new JsonRpcProvider('https://rpc.cc3-testnet.creditcoin.network');

const chainInfoProvider = new chainInfo.PrecompileChainInfoProvider(creditcoinProvider);
const prover = new blockProver.PrecompileBlockProver(creditcoinProvider);
const proofBuilder = new proofProvider.service.ProofBuilder(
  chainKey,
  'https://prover.cc3-testnet.creditcoin.network',
);

const tx = await sourceProvider.getTransaction(txHash);
await proofBuilder.waitUntilHeightAttested(chainKey, tx.blockNumber);

const result = await proofBuilder.getProof(txHash);
const { chainKey: ck, headerNumber, txBytes, merkleProof, continuityProof } = result.data;
const verified = await prover.verifySingle(ck, headerNumber, txBytes, merkleProof, continuityProof);
```

`getProof` returns `{ success, error, data }` where `data` carries `chainKey`, `headerNumber`,
`txHash`, `txBytes` (ABI-encoded transaction), `merkleProof`, `continuityProof`, `cached`.

`waitUntilHeightAttested` polls every 15 s by default and throws after 15 minutes by default.
Surface both the waiting state and the throw distinctly — PRD Feature 2 requires that "a failed
attestation request is visibly distinguishable in the UI from a pending one," and the distinction
originates here, in the manifest you write.

`ProofBuilder` also exposes `getBatchProof([...])`. `RawProofBuilder` computes proofs locally instead
of using the hosted service; prefer the hosted `ProofBuilder` and keep `RawProofBuilder` as a
documented fallback if the prover API is unavailable during judging.

### R-5 — The proof-field mapping brief (due end of Day 2)

Deliver to the PM, in prose, not as a committed file:

1. The exact byte layout of `txBytes` / `encodedTransaction` — what the decoder expects and where
   receipt logs sit within it.
2. The precise interface of the CC3 decoder contract at
   `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` (`EvmV1Decoder`): function names, parameter types,
   returned struct shapes, and specifically how to reach `receiptStatus` and the log array.
3. Whether `@gluwa/asc-contracts@0.2.1`'s `ASCBase.sol` can be reused directly by the adapter, and
   if so which functions.
4. Confirmation of the `calculateTxIndex(merkleProof)` return and how `chainKey`, `height`, and
   `txIndex` pack into the query id.
5. Anything in the real proof that differs from the documented shape.

Read `@gluwa/asc-contracts@0.2.1` from its npm tarball — the GitHub repo is private — and the
examples at `https://github.com/gluwa/usc-testnet-bridge-examples`. This brief is the Contracts
Engineer's only unblocking dependency on you. Do not let it slip.

### R-6 — The relayer CLI

Nine commands. Every one prints a transaction hash and an explorer URL on success, and a decoded
reason on failure.

| Command | Chain | Effect |
|---|---|---|
| `issue --face-value <wei> --reference <string>` | Sepolia | `InvoiceRegistry.issueInvoice`, prints the new invoice id |
| `repay --invoice <id> --amount <wei>` | Sepolia | `InvoiceRegistry.repayInvoice`, one `InvoiceRepaid` log |
| `deposit --tranche senior\|junior --amount <wei>` | CC3 | `TrancheWaterfall.deposit` |
| `prove --tx <sepoliaTxHash> --out <path>` | — | waits for attestation, fetches the proof, writes a fixture |
| `allocate --proof <path>` | CC3 | `TrancheWaterfall.allocate` |
| `allocate --proof <path> --corrupt <mode>` | CC3 | the fail-closed demo beat |
| `snapshot` | CC3 | prints the full `snapshot()` tuple |
| `verify --proof <path>` | CC3 | dry-run `staticcall` of `allocate`, no broadcast |
| `manifest` | both | regenerates `docs/evidence/transactions.json` |

`verify` matters more than it looks: run it before every live broadcast during the demo so you know
whether the transaction will succeed before you show it to a judge.

**The relayer is untrusted by design (PRD §4).** It may deliver a proof, trigger allocation, and pay
gas. It cannot forge an event, change an amount, reorder the waterfall, replay an applied
attestation, change the tranche count, or bypass the fail-closed path. Nothing in your code may
assume otherwise: no admin call, no privileged key, no special path. If you find yourself needing
one, the contract is wrong — report it.

### R-7 — The fail-closed demo path (PRD Feature 6, §22.4)

Per PRD §22.4, the live demo uses a **deliberately malformed** proof, not a genuinely expired one,
for reliability. Attestcoin proofs do not expire; age raises gas cost, not invalidity. A genuinely
pruned attestation fails continuity verification and travels the **identical code path** as a
malformed proof — document that, and never claim TrancheTrade enforces a time-based expiry it does
not have.

`src/corrupt.ts` implements deterministic corruption modes over a valid captured proof:

| Mode | Mutation | Expected on-chain outcome |
|---|---|---|
| `merkle-root` | flip one byte of `merkleProof.root` | Merkle inclusion fails, precompile rejects |
| `sibling` | flip one byte of the first sibling hash | Merkle inclusion fails |
| `continuity` | flip one byte of `continuityProof.lowerEndpointDigest` | continuity chain fails — this is the pruned/expired analogue |
| `tx-bytes` | flip one byte inside `encodedTransaction` | inclusion fails |
| `chain-key` | set `chainKey` to `3` (Ethereum Mainnet) | adapter rejects on `chainKey` mismatch |

Requirements:

- Corruption is **deterministic**: same input proof, same mode, same output bytes, every run. Use a
  fixed byte offset, never randomness. The demo runs live; it must fail identically every time.
- The default demo mode is `continuity`, because its narration is the most honest: this is what a
  stale or pruned attestation actually looks like.
- After the reverted broadcast, capture the reverted transaction hash, decode the revert data
  against the `TrancheWaterfall` ABI into `AttestationFailed(attestationId, reason)`, and read
  `snapshot()` before and after to prove both tranche balances are unchanged.
- Print, verbatim, exactly this string and nothing paraphrased:

  ```
  Attestation failed — balances held at prior state, no funds moved.
  ```

  Note the character is an em dash (U+2014) surrounded by single spaces. Copy it, do not retype it.
- **No spinner, no silent retry, no ambiguous state on failure** (PRD Feature 6 acceptance
  criterion). Do not implement retry-on-failure for the corrupt path. The rejection is the point.

### R-8 — `docs/evidence/transactions.json` — the manifest

**This schema is a contract between you and the Frontend Engineer.** It is reproduced verbatim in
their handoff. Neither of you may change it unilaterally; changes go through the PM.

```json
{
  "version": 1,
  "generatedAt": "2026-09-10T14:00:00Z",
  "commit": "abc1234",
  "contracts": {
    "invoiceRegistry": { "chainId": 11155111, "address": "0x..." },
    "trancheWaterfall": { "chainId": 102031, "address": "0x..." },
    "attestcoinVerifier": { "chainId": 102031, "address": "0x..." }
  },
  "cycles": [
    {
      "id": "cycle-1",
      "kind": "allocation",
      "label": "First attested repayment",
      "occurredAt": "2026-09-10T13:41:22Z",
      "invoiceId": "1",
      "source": {
        "chain": "ethereum-sepolia",
        "chainId": 11155111,
        "event": "InvoiceRepaid",
        "txHash": "0x...",
        "blockNumber": 6600001,
        "logIndex": 0,
        "amount": "25000000000000000000000",
        "explorerUrl": "https://sepolia.etherscan.io/tx/0x..."
      },
      "attestation": {
        "chainKey": 1,
        "attestedHeight": 6600001,
        "attestationId": "0x...",
        "proverUrl": "https://prover.cc3-testnet.creditcoin.network",
        "fetchedAt": "2026-09-10T13:44:10Z",
        "cached": false,
        "continuityHashCount": 12,
        "status": "attested"
      },
      "destination": {
        "chain": "creditcoin-cc3-testnet",
        "chainId": 102031,
        "txHash": "0x...",
        "blockNumber": 998877,
        "status": "success",
        "gasUsed": "184213",
        "explorerUrl": "https://creditcoin-testnet.blockscout.com/tx/0x..."
      },
      "allocation": {
        "attestedAmount": "25000000000000000000000",
        "seniorAllocation": "25000000000000000000000",
        "juniorAllocation": "0",
        "seniorOutstandingBefore": "74200000000000000000000",
        "seniorOutstandingAfter": "49200000000000000000000",
        "juniorOutstandingBefore": "35400000000000000000000",
        "juniorOutstandingAfter": "35400000000000000000000"
      },
      "rejection": null
    },
    {
      "id": "cycle-3",
      "kind": "rejection",
      "label": "Deliberately malformed attestation",
      "occurredAt": "2026-09-10T13:52:04Z",
      "invoiceId": "1",
      "source": { "...": "same shape as above" },
      "attestation": {
        "chainKey": 1,
        "attestedHeight": 6600001,
        "attestationId": "0x...",
        "proverUrl": "https://prover.cc3-testnet.creditcoin.network",
        "fetchedAt": "2026-09-10T13:51:40Z",
        "cached": true,
        "continuityHashCount": 12,
        "status": "corrupted",
        "corruptionMode": "continuity"
      },
      "destination": {
        "chain": "creditcoin-cc3-testnet",
        "chainId": 102031,
        "txHash": "0x...",
        "blockNumber": 998912,
        "status": "reverted",
        "gasUsed": "61204",
        "explorerUrl": "https://creditcoin-testnet.blockscout.com/tx/0x..."
      },
      "allocation": null,
      "rejection": {
        "reason": "InvalidProof",
        "errorSignature": "AttestationFailed(bytes32,uint8)",
        "revertData": "0x...",
        "seniorOutstandingBefore": "49200000000000000000000",
        "seniorOutstandingAfter": "49200000000000000000000",
        "juniorOutstandingBefore": "35400000000000000000000",
        "juniorOutstandingAfter": "35400000000000000000000"
      }
    }
  ]
}
```

Field rules:

- `kind` is `"allocation"` or `"rejection"`. Exactly one of `allocation` / `rejection` is non-null.
- `attestation.status` is `"pending" | "attested" | "failed" | "corrupted"`. `"pending"` and
  `"failed"` must be distinguishable — PRD Feature 2 acceptance criterion.
- `rejection.reason` is one of `InvalidProof | ExpiredProof | StaleProof | AlreadyApplied |
  AmountZero | ExceedsOutstanding`, matching the contract's `RejectionReason` enum ordinal.
- All monetary values are decimal strings of 18-decimal integers. **Never a JavaScript number** —
  these exceed `Number.MAX_SAFE_INTEGER` and a silent precision loss here would put a wrong figure
  on screen during judging.
- `cycles` is ordered oldest first.
- The manifest does **not** carry the user-facing rejection sentence. The frontend owns that string
  as its own constant, so that a typo in generated JSON can never corrupt a string the PRD mandates
  verbatim. Carry the machine-readable `reason` only.
- The demo must include at least one `AlreadyApplied` rejection cycle (PRD §15 mandatory judge
  moment: "The same attestation cannot be applied twice").

**Every hash in this file must be real.** If a stage did not happen, the field is `null` and the
`status` says so. A fabricated hash is a disqualifying failure for this project.

### R-9 — `docs/evidence/judge-verification.md`

Written for a stranger with a browser and five minutes. PRD §14 lists it as Must-ship, and §15
requires transaction links ready to open live.

Contents:

1. A one-paragraph statement of what to expect, including the plain disclosure that invoice data is
   synthetic/testnet (PRD §13, Risk 3).
2. Contract table: name, chain, address, explorer link, deploy tx.
3. For each cycle in the manifest, a three-row walk: the Sepolia repayment (with the amount visible
   in the log), the attestation, and the Creditcoin allocation (with `SeniorAllocated` and
   `JuniorAllocated` visible in the logs, senior at the lower index).
4. The rejection cycle: the reverted CC3 transaction link, the decoded `AttestationFailed` reason,
   and the `snapshot()` values before and after showing them identical.
5. The replay cycle: the second attempt at an already-applied attestation, and its revert.
6. How to independently reproduce: the exact `cast call` commands to read `snapshot()` at a given
   block, so a judge can confirm the before/after values themselves rather than trusting the page.
7. A short "what this does not do" section, drawn from PRD §13: no real production invoice source,
   no KYC, no securities offering, allocation is an accounting entitlement rather than a fund
   transfer, and the 6% / 18% split is a single disclosed flat rule rather than a scoring engine.

Section 7 is not optional and it is not a weakness. PRD §13 and §20 require these disclosures, and a
judge who finds an undisclosed limitation themselves scores it far worse than one you stated first.

### R-10 — `docs/evidence/runbook.md`

The operational script behind PRD §15's three-minute demo. Ordered commands, expected output, and a
fallback for each step.

```
1. Show the two funded tranches            → relayer snapshot          (or the UI)
2. Trigger the real Sepolia repayment      → relayer repay --invoice 1 --amount ...
3. Show the attestation request and proof  → relayer prove --tx 0x... --out fixtures/proof-2.json
4. Submit the proof to Creditcoin          → relayer allocate --proof fixtures/proof-2.json
5. Senior updates, then junior             → the UI cascade
6. Submit a malformed attestation          → relayer allocate --proof fixtures/proof-2.json --corrupt continuity
7. Show the explicit rejection             → the UI rejection beat
8. Close on the audit trail                → the UI activity view
```

Preparation requirements, all from PRD §15:

- **Pre-attest before the presentation.** At least one Sepolia transaction must already have a
  cached proof in `fixtures/` before judging, so the demo does not depend on attestation latency.
  Attestation cadence for Ethereum is roughly two minutes with checkpoints every twenty; that is
  usually fine and occasionally is not. Do not gamble on it.
- **No demo-only code path.** The runbook uses the same deployed contracts and the same commands
  that the public repository and test suite use.
- Every step lists a fallback: if the prover API is slow, use the cached fixture; if a broadcast
  fails, the pre-captured transaction link from the manifest is opened instead.
- Run `relayer verify --proof <path>` before each live broadcast.

---

## Dependencies

| You need | From | When |
|---|---|---|
| `InvoiceRegistry` Sepolia address + ABI | Contracts Engineer | Day 1 |
| `TrancheWaterfall` + `AttestcoinVerifier` CC3 addresses + ABIs | Contracts Engineer | End of Day 3 |
| `docs/evidence/deployments.json` populated | Contracts Engineer | Rolling |

| Others need from you | Who | When |
|---|---|---|
| Proof-field mapping brief | Contracts Engineer, via PM | **End of Day 2 — hard blocker** |
| First real proof fixture | Test Engineer (fork test), Frontend | Day 5 |
| `docs/evidence/transactions.json` with at least one allocation cycle | Frontend Engineer | Day 5 |
| Manifest with allocation + rejection + replay cycles | Frontend, deck | End of Day 7 |
| `judge-verification.md`, `runbook.md` | PM, deck | End of Day 8 |

You can do the Day 1 spike against *any* real Sepolia transaction — you do not need
`InvoiceRegistry` to exist to prove the SDK works. Start immediately.

---

## Constraints

### Standing rules

- **English everywhere.** Identifiers, strings, docs, commit messages, CLI output.
- **No comments in code.** Not block, not single-line, not JSDoc. Name things so the comment is
  unnecessary. The sole exception is scaffolding the user has explicitly framed as temporary, which
  gets exactly one line: `// TEMPORARY — <what it is>; delete with <what to remove>`.
- **TypeScript stays strict.** No `any`, no `@ts-ignore`, no non-null assertion used to silence a
  genuinely nullable value. The SDK's return types are `{ success, error, data }` shaped — narrow
  them with a real check, not with `!`.
- **No new dependency without asking.** Only the R-1 list is pre-approved.
- **Never read, write, or echo `.env*` files or secrets.** Never call `dotenv.config()` even though
  the SDK ships `dotenv`. Never log `process.env`. Never print a private key.
- **Never run `git commit`, `git push`, or any destructive git command unless the user asks.** Never
  `git add -A` or `git add .` — stage explicit paths.
- **Testnets only.** Assert `chainId === 102031` before every CC3 broadcast and
  `chainId === 11155111` before every Sepolia broadcast. Creditcoin mainnet is `102030`, one digit
  away.
- **Never claim a transaction hash you did not produce.** Fabricated evidence is disqualifying.

### Architectural constraints

- The relayer is a **CLI, not a service.** No HTTP server, no daemon, no database, no cron. PRD
  §22.2 fixes the relayer as permissionless; a CLI has no uptime risk during judging and no deploy
  surface. If you want a watch mode, it is a loop inside the CLI, not a deployment.
- The relayer holds no protocol authority. No admin call, no owner key, no privileged path.
- The frontend reads chains directly and does not call your CLI. Your only interface to it is
  `docs/evidence/transactions.json`.
- All monetary values as `bigint` or decimal string end to end. No `Number` on a wei value anywhere.
- Corruption is deterministic. No randomness in `corrupt.ts`.

### Product language constraints (PRD §13, §20)

Your CLI output and your two evidence documents are read by judges. They must never imply a
securities offering, a fund, a guaranteed return, or a credit-scoring engine; never claim
TrancheTrade "prevents a crisis"; never claim tranching is novel; and must always disclose that
invoice data is synthetic/testnet. Allocation is an accounting entitlement against attested
repayment, not a transfer of repayment cash — say it that way.

---

## Deliverables

1. `/relayer` — a TypeScript CLI that builds clean with `tsc --noEmit` under `strict`.
2. All nine commands from R-6, working against live Sepolia and live CC3.
3. `src/corrupt.ts` with the five deterministic corruption modes from R-7.
4. `fixtures/` and `docs/evidence/proofs/` containing at least two real captured proofs.
5. `docs/evidence/transactions.json` conforming to R-8, containing at minimum: two successful
   allocation cycles, one malformed-proof rejection cycle, and one replay rejection cycle.
6. `docs/evidence/judge-verification.md` per R-9.
7. `docs/evidence/runbook.md` per R-10.
8. `/relayer/README.md` — required environment variables (names only, never values), install, build,
   and one worked end-to-end example.
9. The proof-field mapping brief, delivered to the PM by end of Day 2.

---

## Acceptance criteria

**The three-hop chain**

- [ ] A real Sepolia `InvoiceRepaid` transaction exists, is linked in the manifest, and its explorer
      page shows the repayment amount in the log.
- [ ] A real Attestcoin proof was fetched for that transaction and is committed as a fixture.
- [ ] A real successful `TrancheWaterfall.allocate` transaction exists on CC3, is linked in the
      manifest, and its explorer page shows `SeniorAllocated` at a strictly lower log index than
      `JuniorAllocated`.
- [ ] The `attestedAmount` in the CC3 `RepaymentAllocated` event equals the `amount` in the Sepolia
      `InvoiceRepaid` event, exactly. A judge can compare the two explorer pages and see the same
      number.
- [ ] A second, independent repayment cycle exists and allocated correctly against the updated
      state (PRD §24 outcome 3).

**Fail-closed**

- [ ] A real **reverted** CC3 transaction exists from a malformed proof, is linked in the manifest,
      and its revert data decodes to `AttestationFailed`.
- [ ] `snapshot()` read at the block before and the block after that reverted transaction returns
      byte-identical values, and both are recorded in the manifest's `rejection` object.
- [ ] `relayer allocate --corrupt continuity` prints exactly
      `Attestation failed — balances held at prior state, no funds moved.` with the em dash intact.
- [ ] Running the same corruption mode on the same fixture twice produces byte-identical proof bytes.
- [ ] No retry, spinner, or ambiguous state appears on the corrupt path.

**Replay**

- [ ] A real reverted CC3 transaction exists from resubmitting an already-applied proof, and its
      revert decodes to `AttestationFailed(id, AlreadyApplied)`.

**Manifest**

- [ ] `docs/evidence/transactions.json` validates against the R-8 shape, and every `txHash` in it
      resolves to a real transaction on the explorer named in the same object.
- [ ] Every monetary field is a decimal string, not a JSON number. `grep` for `: [0-9]\{16,\}` in
      value position returns nothing.
- [ ] The manifest contains at least one cycle of each of: successful allocation, malformed
      rejection, replay rejection.
- [ ] The manifest does not contain the user-facing rejection sentence; it carries `reason` codes.

**Documents**

- [ ] `judge-verification.md` contains every section from R-9 including section 7's limitations.
- [ ] Every link in `judge-verification.md` resolves. Check them; a dead link on a judge's screen is
      worse than no link.
- [ ] `runbook.md` covers all eight steps of PRD §15 with a fallback for each, and states the
      pre-attestation requirement.
- [ ] Neither document implies a securities offering, a guaranteed return, a scoring engine, or a
      prevented crisis; both disclose synthetic/testnet invoice data.

**Code quality**

- [ ] `tsc --noEmit` passes under `strict` with zero errors.
- [ ] `grep -rn "any\|@ts-ignore" /relayer/src` returns nothing meaningful.
- [ ] `grep -rn "dotenv\|\.env" /relayer/src` returns nothing.
- [ ] `grep -rn "//" /relayer/src` returns nothing other than `// TEMPORARY —` lines explicitly
      sanctioned by the user.
- [ ] No file under `/contracts` or `/web` was modified by this role.
