# 01 — Chain & Contracts Engineer

**Project:** TrancheTrade — attestation-gated, risk-stratified trade-finance settlement layer
**Source of truth:** `docs/TrancheTrade_PRD.md` (v1.0). Read §8–§12, §14, §16, §22, §24 before starting.
**Deadline:** 2026-09-13 23:59 ET. Nine days from 2026-09-04.
**You own:** every `.sol` file in this repository, both deployments, and the ABI + address evidence.

You do not need to read any other handoff file. Everything you need is here.

---

## Responsibilities

You are the only person who writes Solidity. You deliver:

- `InvoiceRegistry` on Ethereum Sepolia — the real source-chain event that Attestcoin attests.
- `TrancheWaterfall` on Creditcoin CC3 — the hard-capped, two-tranche, senior-first waterfall that
  enforces INV-1 through INV-6 in code.
- `AttestcoinVerifier` on Creditcoin CC3 — the adapter that turns an Attestcoin proof into a
  verified `(invoiceId, repaymentAmount)`, or reverts.
- Deployment scripts, deployed addresses, deploy transaction hashes, and committed ABIs.

You do **not** write the tests that prove the invariants — a separate Invariant & Adversarial Test
Engineer owns `/contracts/test` and will report failures back to you through the PM. Write your own
scratch tests while developing if you find them useful, but never place a file in `/contracts/test`;
that directory is not yours. Delete scratch tests before you finish.

---

## Scope

### In scope

- `/contracts/foundry.toml`, `/contracts/remappings.txt`, `/contracts/.gitignore`
- `/contracts/src/**` — all contracts, interfaces, libraries
- `/contracts/script/**` — deployment and interaction scripts
- `/contracts/lib/**` — Foundry dependencies via `forge install`
- `docs/evidence/deployments.json`
- `docs/evidence/abi/*.json`
- Verifying the deployed contracts on Sepolia Etherscan and CC3 Blockscout where the explorers
  support it

### Out of scope

- `/contracts/test/**` — owned by the Invariant & Adversarial Test Engineer. Do not create,
  edit, or delete anything in it, including mocks.
- `/relayer/**` — owned by the Attestation Integration Engineer. You never write TypeScript.
- `/web/**` — owned by the Frontend Engineer.
- `docs/evidence/transactions.json`, `judge-verification.md`, `runbook.md` — owned by Integration.
- `docs/evidence/test-output/` — owned by the Test Engineer.
- The pitch deck, the demo script, and any user-facing marketing copy.
- Any change to the six invariants, the tranche count, or the resolved decisions in this document.
  If one is unworkable, stop and report it. Do not silently redesign.

---

## Objectives

1. **Day 1 is a hard product requirement, not a preference.** PRD Feature 1 states: "Deploy on Day 1
   of the build window and commit the deployment transaction hash to the repository immediately, not
   near the deadline." Get `InvoiceRegistry` onto Sepolia and its tx hash into
   `docs/evidence/deployments.json` before you do anything else of substance.
2. **Freeze the interfaces and publish the ABIs by end of Day 2.** Three other roles are blocked on
   this. Interface churn after Day 2 is a PM escalation.
3. Make INV-1 through INV-6 true by construction, so that the test suite confirms them rather than
   discovers violations.
4. Deploy `TrancheWaterfall` + `AttestcoinVerifier` to CC3 by end of Day 3.
5. Make every rejection path revert with a typed custom error carrying a machine-readable reason,
   so the UI can render an exact rejection message from reverted-transaction data.

---

## Requirements

### R-1 — Foundry project setup

```
/contracts
  foundry.toml
  remappings.txt
  src/
    InvoiceRegistry.sol
    TrancheWaterfall.sol
    AttestcoinVerifier.sol
    interfaces/
      INativeQueryVerifier.sol
      IAttestationVerifier.sol
      ITrancheWaterfall.sol
      IInvoiceRegistry.sol
  script/
    DeploySepolia.s.sol
    DeployCreditcoin.s.sol
  test/            <- not yours
  lib/
```

`foundry.toml`:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
test = "test"
solc = "0.8.24"
optimizer = true
optimizer_runs = 200
via_ir = false
evm_version = "paris"
fs_permissions = [{ access = "read", path = "./" }]

[fuzz]
runs = 10000

[invariant]
runs = 512
depth = 64
fail_on_revert = false

[rpc_endpoints]
sepolia = "${SEPOLIA_RPC_URL}"
creditcoin = "https://rpc.cc3-testnet.creditcoin.network"
```

`evm_version = "paris"` because Creditcoin CC3 may not support post-Shanghai opcodes such as
`PUSH0`. Verify this on your first CC3 deployment; if `shanghai` deploys and executes cleanly, you
may raise it and must record the change in `docs/evidence/deployments.json`.

Pre-approved dependencies, install with `forge install`:

- `foundry-rs/forge-std`
- `OpenZeppelin/openzeppelin-contracts` — for `ReentrancyGuard` only. Do not pull in `Ownable`,
  `AccessControl`, or any upgradeability proxy; this protocol has no privileged role by design.

`@gluwa/asc-contracts@0.2.1` is published on npm as Solidity source for Foundry consumption. You may
vendor its `INativeQueryVerifier` interface into `src/interfaces/` rather than adding an npm
dependency to a Foundry project — that is cleaner and is the recommended route. Copy only the
interface; do not vendor the whole package.

**Anything beyond these dependencies requires PM approval before you install it.**

### R-2 — `InvoiceRegistry` (Ethereum Sepolia, chain id 11155111)

Minimal by design. PRD §8.1, Feature 1.

State and behaviour:

- `issueInvoice(uint256 faceValue, string calldata reference) returns (uint256 invoiceId)` —
  assigns a sequential id, records `faceValue`, `issuedAt`, `issuer`, and emits exactly one
  `InvoiceIssued`.
- `repayInvoice(uint256 invoiceId, uint256 amount)` — records the repayment and emits exactly one
  `InvoiceRepaid`. Reverts if the invoice does not exist. **Exactly one `InvoiceRepaid` log per
  transaction** — see R-5, the attestation id is derived per source transaction.
- Multiple repayments against the same invoice are permitted (PRD §22.3 requires the waterfall to
  handle sequential events), each in its own transaction.
- Permissionless. No owner, no pause, no access control. This contract exists to produce real,
  publicly verifiable events; gating it would add nothing and would create a key to lose.

```solidity
event InvoiceIssued(uint256 indexed invoiceId, address indexed issuer, uint256 faceValue, uint256 issuedAt);
event InvoiceRepaid(uint256 indexed invoiceId, address indexed payer, uint256 amount, uint256 repaidAt);
```

Both event signatures are frozen once deployed on Day 1. `AttestcoinVerifier` matches on
`keccak256("InvoiceRepaid(uint256,address,uint256,uint256)")`.

Design note you must respect: keep the event's non-indexed data ABI-decodable with no dynamic types.
`amount` and `repaidAt` are the non-indexed words; `invoiceId` and `payer` are topics. The verifier
decodes them out of a proven receipt, and a dynamic type there would make that decoding
significantly harder for no product benefit.

### R-3 — `TrancheWaterfall` (Creditcoin CC3, chain id 102031)

This is the contract the whole project is judged on. PRD §8.4, §12, Feature 3.

#### Constants and immutables

```solidity
uint256 public constant TRANCHE_COUNT = 2;
uint256 public constant SENIOR_RATE_BPS = 10600;
uint256 public constant JUNIOR_RATE_BPS = 11800;
uint256 public constant BPS = 10000;

uint256 public immutable SENIOR_CAP;
uint256 public immutable JUNIOR_CAP;
uint64  public immutable MIN_SOURCE_HEIGHT;
IAttestationVerifier public immutable VERIFIER;
```

`TRANCHE_COUNT` is a `constant`, which satisfies INV-5 by construction: there is no storage slot, no
setter, and no code path that could produce a third tranche. Do not model tranches as an array or a
mapping keyed by an index that could grow. Use two named storage variables per quantity. This is
deliberate — an array invites a `push`.

Deploy values for the demo: `SENIOR_CAP = 70_000e18`, `JUNIOR_CAP = 30_000e18`.

`SENIOR_RATE_BPS` / `JUNIOR_RATE_BPS` implement PRD §22.5's single fixed disclosed rule: senior
entitlement is 1.06× principal, junior is 1.18×. This is a flat simplification, not a scoring
engine, and it must never be described as one.

#### State

```solidity
uint256 public seniorPrincipal;
uint256 public juniorPrincipal;
uint256 public seniorOutstanding;
uint256 public juniorOutstanding;
uint256 public seniorAllocatedTotal;
uint256 public juniorAllocatedTotal;

mapping(address => uint256) public seniorPositionOf;
mapping(address => uint256) public juniorPositionOf;
mapping(bytes32 => bool) public appliedAttestations;
```

`seniorOutstanding` is the entitlement still owed to the senior tranche. An allocation **reduces**
it. `seniorPositionOf` records each investor's entitlement share, which the UI needs to show
per-investor exposure (PRD Feature 4).

Per decision D-4: allocation is an accounting entitlement, not a fund transfer. No CTC moves during
`allocate`. Never write code or a name that implies otherwise.

#### `deposit`

```solidity
function deposit(Tranche tranche) external payable nonReentrant;
```

- `msg.value` is the principal. Entitlement = `msg.value * rateBps / BPS`.
- Increases the tranche's `principal`, `outstanding`, and the caller's `positionOf`.
- Reverts with `TrancheCapExceeded(tranche, cap, attempted)` if the tranche's principal would exceed
  its cap.
- Reverts with `AmountZero` semantics if `msg.value == 0`.
- Emits `Deposited(investor, tranche, principal, entitlement)`.
- Permissionless. No allowlist, no KYC — PRD §5 lists KYC as an explicit non-goal.

#### `allocate` — the core function

```solidity
function allocate(RepaymentProof calldata proof) external nonReentrant;
```

Ordering is mandatory and is checks-effects-interactions:

1. **Check.** `AttestedRepayment memory a = VERIFIER.verifyRepayment(proof);`
   This is a `view` call to a `view` adapter that `STATICCALL`s the precompile. It reverts on any
   invalid, unattested, unsuccessful, or malformed proof. You do **not** wrap it in `try/catch`.
   A `try/catch` here would let execution continue past a failed verification, which is exactly the
   failure mode INV-3 exists to prevent. Let it bubble.
2. **Check.** `if (a.sourceHeight < MIN_SOURCE_HEIGHT) revert AttestationFailed(a.attestationId, RejectionReason.StaleProof);`
3. **Check.** `if (appliedAttestations[a.attestationId]) revert AttestationFailed(a.attestationId, RejectionReason.AlreadyApplied);`
4. **Check.** `if (a.repaymentAmount == 0) revert AttestationFailed(a.attestationId, RejectionReason.AmountZero);`
5. **Check.** `if (a.repaymentAmount > seniorOutstanding + juniorOutstanding) revert RepaymentExceedsOutstanding(a.repaymentAmount, seniorOutstanding + juniorOutstanding);`
   (Decision D-5. INV-6 states that `seniorAllocation + juniorAllocation` **exactly** equals the
   attested amount, so a surplus bucket would violate it as written. Reverting keeps INV-6 true
   verbatim and by construction, and reverting is the product's posture.)
6. **Effect.** `appliedAttestations[a.attestationId] = true;` — set this *before* any balance write.
7. **Effect.** `uint256 seniorAllocation = a.repaymentAmount < seniorOutstanding ? a.repaymentAmount : seniorOutstanding;`
   `seniorOutstanding -= seniorAllocation; seniorAllocatedTotal += seniorAllocation;`
8. **Effect.** `emit SeniorAllocated(a.attestationId, seniorAllocation, seniorOutstanding);`
9. **Effect.** `uint256 juniorAllocation = a.repaymentAmount - seniorAllocation;`
   If `juniorAllocation > 0`, assert `seniorOutstanding == 0` (INV-1), then
   `juniorOutstanding -= juniorAllocation; juniorAllocatedTotal += juniorAllocation;`
10. **Effect.** `emit JuniorAllocated(a.attestationId, juniorAllocation, juniorOutstanding);`
11. **Effect.** `emit RepaymentAllocated(a.attestationId, a.invoiceId, a.repaymentAmount, seniorAllocation, juniorAllocation);`
12. **Interactions.** None. There are none, by design.

`SeniorAllocated` is always emitted before `JuniorAllocated`, and `JuniorAllocated` is emitted even
when `juniorAllocation == 0`. The frontend derives PRD Feature 5's two distinct visual beats from
this event ordering, so the ordering is a product requirement, not an implementation detail. Never
merge them into one event and never emit them out of order.

#### Errors

```solidity
error AttestationFailed(bytes32 attestationId, RejectionReason reason);
error RepaymentExceedsOutstanding(uint256 attestedAmount, uint256 totalOutstanding);
error TrancheCapExceeded(Tranche tranche, uint256 cap, uint256 attempted);
```

Decision D-3: the PRD asks in §9 Step 6 for both a full revert **and** an `AttestationFailed(reason)`
event. A reverted transaction does not persist logs, so both cannot literally hold. `AttestationFailed`
is therefore a **custom error**, not an event. Its data is returned on-chain in the revert, is
attached to a real reverted transaction hash visible on CC3 Blockscout, and is decodable by the UI
and by any auditor. This preserves INV-3 exactly. Do not add an event that is emitted before a
revert; it will not survive.

#### View functions the UI needs

```solidity
function trancheCount() external pure returns (uint256);
function snapshot() external view returns (
    uint256 seniorOutstanding_,
    uint256 juniorOutstanding_,
    uint256 seniorPrincipal_,
    uint256 juniorPrincipal_,
    uint256 seniorAllocatedTotal_,
    uint256 juniorAllocatedTotal_,
    uint256 seniorCap_,
    uint256 juniorCap_
);
function positionOf(address investor) external view returns (uint256 senior, uint256 junior);
function isApplied(bytes32 attestationId) external view returns (bool);
```

`snapshot` exists so the frontend reads the whole tranche state in one RPC round trip rather than
eight, which matters for the cascade's timing.

#### What must NOT exist in this contract

No `owner`, no `admin`, no `onlyOwner`, no pause, no upgrade proxy, no `selfdestruct`, no setter for
any cap or rate, no function that can add a tranche, no `delegatecall`, no way for any address to
change another address's position, and no function that transfers value out. PRD §12 says the
relayer and every proposer are untrusted and can alter neither contents, order, nor caps. A single
admin setter would make that claim false and a judge would find it.

Withdrawal of principal is out of MVP scope (PRD §14 does not list it). Do not add it.

### R-4 — `AttestcoinVerifier` (Creditcoin CC3)

Implements `IAttestationVerifier`. This is the only contract that knows Attestcoin exists.

Immutables: the `INativeQueryVerifier` precompile address
`0x0000000000000000000000000000000000000FD2`, the expected `chainKey` (`1` for Ethereum Sepolia on
CC3 testnet), and the `InvoiceRegistry` address on Sepolia.

`verifyRepayment(RepaymentProof calldata proof) external view returns (AttestedRepayment memory)`
must, in this order:

1. `require(proof.chainKey == EXPECTED_CHAIN_KEY)` — reject a proof from another source chain.
   Note that `chainKey` is Attestcoin's internal identifier (`1` for Sepolia), **not** the EVM chain
   id `11155111`. Confusing the two is the single easiest mistake to make here.
2. Call `INativeQueryVerifier(PRECOMPILE).verify(chainKey, height, encodedTransaction, merkleProof, continuityProof)`.
   This is `external view`, so it compiles to a `STATICCALL` and cannot re-enter. Require the return
   value is `true`; the precompile also reverts on failure, and both outcomes must reject.
3. **Check the execution status of the proven transaction.** The Attestcoin documentation states
   verbatim that the block prover precompile *does not* validate whether a transaction succeeded —
   it proves inclusion only. Decode the receipt and `require(receiptStatus == 1)`. Skipping this
   would let a relayer allocate against a *reverted* Sepolia repayment. This is not optional
   hardening; it is a correctness requirement.
4. Decode the proven transaction's logs and locate `InvoiceRepaid` logs whose emitter is the
   registered `InvoiceRegistry` address and whose `topics[0]` is
   `keccak256("InvoiceRepaid(uint256,address,uint256,uint256)")`. Require **exactly one** such log;
   revert on zero and revert on more than one. See R-5 for why "exactly one" matters.
5. Derive `attestationId`:
   ```solidity
   uint64 txIndex = INativeQueryVerifier(PRECOMPILE).calculateTxIndex(proof.merkleProof);
   bytes32 attestationId = keccak256(abi.encodePacked(proof.chainKey, proof.height, txIndex));
   ```
   This mirrors the Attestcoin ecosystem's own `ASCBase._computeQueryId` convention.
6. Return `AttestedRepayment(attestationId, invoiceId, repaymentAmount, proof.height)`.

Decoding help: Attestcoin publishes a decoder contract on CC3 testnet at
`0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` (`EvmV1Decoder`), and `@gluwa/asc-contracts@0.2.1`
ships the decoding libraries and an `ASCBase` reference implementation. Read `ASCBase.sol` from the
npm tarball before writing your own decoder — it already solves receipt decoding, status checking,
and query-id derivation, and reusing its shape makes your contract legible to a judge who knows the
ecosystem. Worked examples: `https://github.com/gluwa/usc-testnet-bridge-examples`.

The Integration Engineer will hand you a **proof-field mapping brief** at end of Day 2 confirming
the exact byte layout the SDK produces for `encodedTransaction` and the decoder's precise interface.
You do not need it to build `TrancheWaterfall`; you need it only for this adapter. Build the
waterfall first.

Reference documentation, all machine-readable: `https://docs.attestcoin.org/llms.txt`,
`https://docs.attestcoin.org/llms-full.txt`, `https://docs.creditcoin.org/llms-full.txt`.

### R-5 — Why "exactly one `InvoiceRepaid` log per transaction"

The attestation id is derived per source *transaction* (`chainKey`, `height`, `txIndex`), because
that is the granularity Attestcoin's Merkle proof gives you. If one Sepolia transaction emitted two
repayment logs, the second could never be applied — the id would already be marked used. Requiring
exactly one log makes the model sound. `InvoiceRegistry.repayInvoice` emits exactly one, and
`AttestcoinVerifier` enforces exactly one. Both halves are required.

### R-6 — Deployment scripts and evidence

`script/DeploySepolia.s.sol` deploys `InvoiceRegistry`.
`script/DeployCreditcoin.s.sol` deploys `AttestcoinVerifier` then `TrancheWaterfall`, wiring the
verifier address, caps, and `MIN_SOURCE_HEIGHT` (the Sepolia block in which `InvoiceRegistry` was
deployed).

Read the deployer key from the process environment via `vm.envUint("PRIVATE_KEY")`. **Never read,
write, print, or commit a `.env` file or a key.** Never echo a key into terminal output.

Fund the deployer wallet on both chains on Day 1. CC3 tCTC comes from a **Discord bot only** — join
`https://discord.gg/creditcoin`, go to `#token-faucet`, run `/faucet address:<your EVM address>`.
There is no HTTP faucet. Do this first; it is a human-latency step and it will not get faster on
Day 8.

After each deployment, write `docs/evidence/deployments.json`:

```json
{
  "generatedAt": "2026-09-04T00:00:00Z",
  "commit": "<git rev-parse HEAD>",
  "solcVersion": "0.8.24",
  "evmVersion": "paris",
  "contracts": {
    "InvoiceRegistry": {
      "chain": "ethereum-sepolia",
      "chainId": 11155111,
      "address": "0x...",
      "deployTxHash": "0x...",
      "deployBlockNumber": 0,
      "explorer": "https://sepolia.etherscan.io/address/0x..."
    },
    "AttestcoinVerifier": {
      "chain": "creditcoin-cc3-testnet",
      "chainId": 102031,
      "address": "0x...",
      "deployTxHash": "0x...",
      "deployBlockNumber": 0,
      "explorer": "https://creditcoin-testnet.blockscout.com/address/0x..."
    },
    "TrancheWaterfall": {
      "chain": "creditcoin-cc3-testnet",
      "chainId": 102031,
      "address": "0x...",
      "deployTxHash": "0x...",
      "deployBlockNumber": 0,
      "explorer": "https://creditcoin-testnet.blockscout.com/address/0x...",
      "constructorArgs": {
        "verifier": "0x...",
        "seniorCap": "70000000000000000000000",
        "juniorCap": "30000000000000000000000",
        "minSourceHeight": 0
      }
    }
  }
}
```

Also copy each deployed contract's ABI from `out/<Name>.sol/<Name>.json` (the `abi` array only) to
`docs/evidence/abi/<Name>.json`. Three other roles consume these instead of running `forge`. Refresh
them whenever an interface changes, and tell the PM when you do.

**Every hash and address in this file must be real and verifiable on the named explorer. Never write
a placeholder hash that looks real. If something has not been deployed, leave the field `null` and
say so.**

---

## Dependencies

| You need | From | When |
|---|---|---|
| Nothing to start | — | Day 1 |
| Proof-field mapping brief (byte layout of `encodedTransaction`, decoder interface) | Attestation Integration Engineer, via PM | End of Day 2 — needed only for `AttestcoinVerifier`, not for `TrancheWaterfall` |
| Failing-test reports | Invariant & Adversarial Test Engineer, via PM | Ongoing from Day 3 |

| Others need from you | Who | When |
|---|---|---|
| Frozen interfaces + committed ABIs | Test, Integration, Frontend | End of Day 2 — hard |
| `InvoiceRegistry` Sepolia address + deploy tx hash | Integration | Day 1 — hard, PRD Feature 1 |
| `TrancheWaterfall` + `AttestcoinVerifier` CC3 addresses | Integration, Frontend | End of Day 3 |

---

## Constraints

### Standing rules

- **English everywhere.** Identifiers, strings, docs, commit messages.
- **No comments in code.** This includes Solidity: no `//`, no `/* */`, no NatSpec. Name functions,
  variables, and custom errors so the comment would be redundant. The sole exception is scaffolding
  the user has explicitly framed as temporary, which gets exactly one line:
  `// TEMPORARY — <what it is>; delete with <what to remove>`.
- **No new dependency without asking.** `forge-std` and `openzeppelin-contracts` (for
  `ReentrancyGuard` only) are pre-approved. Vendoring the `INativeQueryVerifier` interface from
  `@gluwa/asc-contracts` is pre-approved. Anything else: ask the PM first.
- **Never read, write, or echo `.env*` files or secrets.** Keys come from the process environment.
- **Never run `git commit`, `git push`, or any destructive git command unless the user asks.** Never
  `git add -A` or `git add .` — stage explicit paths.
- **Testnets only.** Never `--broadcast` against a mainnet RPC. Creditcoin mainnet is chain id
  `102030` and Creditcoin CC3 testnet is `102031` — one digit apart. Assert the chain id in your
  deploy scripts before broadcasting.
- **Never claim a transaction hash or address you did not actually produce.** A fabricated hash is a
  disqualifying failure for this project.

### Technical constraints

- Solidity `0.8.24`, `optimizer = true`, `runs = 200`.
- `evm_version = "paris"` until you have confirmed CC3 accepts Shanghai bytecode.
- No `unchecked` blocks unless you can state the overflow argument in the identifier itself; default
  checked arithmetic is what makes conservation provable.
- No assembly except where `@gluwa/asc-contracts` patterns require it for decoding.
- No `try/catch` around `verifyRepayment`. Let verification failures bubble into a full revert.
- No storage array or growable mapping representing tranches. Two named variables per quantity.
- All monetary quantities are `uint256` in 18-decimal wei-equivalents.

### Product language constraints (PRD §13, §20)

Contract names, error names, and any documentation you write must never imply a securities offering,
a fund, a guaranteed return, or a credit-scoring engine. `SENIOR_RATE_BPS` is a flat disclosed rule.
Do not name anything `yield`, `guaranteed`, `insured`, `score`, or `rating`.

---

## Deliverables

1. `/contracts` — a Foundry project that compiles clean with `forge build` and zero warnings.
2. `src/InvoiceRegistry.sol`, deployed to Ethereum Sepolia on **Day 1**.
3. `src/TrancheWaterfall.sol`, deployed to Creditcoin CC3 by end of Day 3.
4. `src/AttestcoinVerifier.sol`, deployed to Creditcoin CC3 by end of Day 3.
5. `src/interfaces/{INativeQueryVerifier,IAttestationVerifier,ITrancheWaterfall,IInvoiceRegistry}.sol`,
   frozen by end of Day 2.
6. `script/DeploySepolia.s.sol`, `script/DeployCreditcoin.s.sol`.
7. `docs/evidence/deployments.json`, complete and real.
8. `docs/evidence/abi/{InvoiceRegistry,TrancheWaterfall,AttestcoinVerifier}.json`.
9. Source verification on Sepolia Etherscan, and on CC3 Blockscout if it supports verification.
10. A short written note to the PM listing: the deployed addresses, the four constructor arguments
    used on CC3, and any place where you deviated from this handoff and why.

---

## Acceptance criteria

Each of these is checkable by someone who did not write the code.

**Deployment and evidence**

- [ ] `docs/evidence/deployments.json` exists, and every `deployTxHash` in it resolves to a real
      successful transaction on the explorer named in the same record.
- [ ] The `InvoiceRegistry` deploy transaction's block timestamp is on the first day of the build
      window (PRD Feature 1 acceptance criterion).
- [ ] `docs/evidence/abi/` contains a valid ABI JSON for each of the three deployed contracts, and
      each matches the deployed bytecode's interface.
- [ ] `forge build` completes with zero errors and zero warnings.

**`InvoiceRegistry`**

- [ ] At least one real `InvoiceIssued` and one real `InvoiceRepaid` transaction exist on Sepolia,
      as transactions, not as test-harness calls (PRD Feature 1 acceptance criterion).
- [ ] `repayInvoice` emits exactly one `InvoiceRepaid` log per transaction, verifiable by opening
      any repayment transaction on Etherscan and counting the logs.
- [ ] The contract has no owner, no pause, and no access-controlled function.

**`TrancheWaterfall` — invariants by construction**

- [ ] INV-5: `TRANCHE_COUNT` is declared `constant` and equals `2`. `grep -n "TRANCHE_COUNT"` shows
      no setter and no assignment. There is no array or index-keyed mapping of tranches anywhere in
      the file.
- [ ] INV-1: in `allocate`, the senior write appears strictly before the junior write, and a nonzero
      junior allocation is only reachable on a branch where `seniorOutstanding == 0`.
- [ ] INV-3: `verifyRepayment` is called before any storage write in `allocate`, and is not wrapped
      in `try/catch`. `grep -n "try"` in `src/` returns nothing.
- [ ] INV-4: `appliedAttestations[id] = true` is executed before any balance mutation.
- [ ] INV-6: `seniorAllocation + juniorAllocation == a.repaymentAmount` holds on every path, and the
      only path where it could not is guarded by `RepaymentExceedsOutstanding`.
- [ ] The attestation id is derived inside `AttestcoinVerifier` from `(chainKey, height, txIndex)`
      and no function anywhere accepts a caller-supplied attestation id.

**`TrancheWaterfall` — events**

- [ ] A successful `allocate` transaction on CC3 Blockscout shows `SeniorAllocated` at a lower log
      index than `JuniorAllocated`, and both are present even when the junior allocation is zero.
- [ ] `RepaymentAllocated` carries `attestationId`, `invoiceId`, `attestedAmount`,
      `seniorAllocation`, and `juniorAllocation`.

**`AttestcoinVerifier`**

- [ ] It calls the precompile's `view` `verify`, not `verifyAndEmit`. `grep -n "verifyAndEmit"`
      returns nothing.
- [ ] It requires `receiptStatus == 1` on the proven source transaction. This line exists and is
      reachable.
- [ ] It requires exactly one matching `InvoiceRepaid` log and reverts on zero or on more than one.
- [ ] It rejects a proof whose `chainKey` is not the configured Sepolia `chainKey`.

**Fail-closed behaviour, demonstrable on a live chain**

- [ ] Submitting a malformed proof to the deployed `TrancheWaterfall` produces a **reverted**
      transaction on CC3 Blockscout whose revert data decodes to `AttestationFailed`, and
      `snapshot()` returns byte-identical values before and after that transaction.
- [ ] Submitting an already-applied proof produces a revert decoding to
      `AttestationFailed(id, AlreadyApplied)`.

**Prohibited constructs — each of these greps must return nothing in `src/`**

- [ ] `onlyOwner`, `Ownable`, `AccessControl`, `selfdestruct`, `delegatecall`, `initializer`,
      `upgradeTo`
- [ ] Any comment: `//` other than a `// TEMPORARY —` line explicitly sanctioned by the user, and
      any `/*`
- [ ] `setSeniorCap`, `setJuniorCap`, `setRate`, `setVerifier`, or any other setter for an immutable
      product parameter
