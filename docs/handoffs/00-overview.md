# 00 — Overview, Role Map, and Shared Conventions

**Project:** TrancheTrade
**Source of truth:** `docs/TrancheTrade_PRD.md` (v1.0)
**Design reference:** `docs/code.html`, `docs/screen.png`
**Event:** BUIDL CTC 2026 Fall (Creditcoin / Attestcoin Protocol, DoraHacks)
**Submission deadline:** 2026-09-13 23:59 ET / 2026-09-14 03:59 UTC
**Today:** 2026-09-04 — nine days of build window.

This document is the map. Each role also has its own file, which is self-contained; a role never
needs to read another role's file to do its own work. Read this one for the shared conventions, the
frozen interfaces, and the decisions that were already made for you.

---

## 1. What is being built

A real three-hop transaction chain:

```
Ethereum Sepolia                Attestcoin                    Creditcoin CC3
InvoiceRegistry.sol      →      attestation of the      →     TrancheWaterfall.sol
emits InvoiceRepaid             InvoiceRepaid log             allocates senior-first,
(real tx)                       (real attestation)            junior-second (real tx)
```

Plus a Next.js interface that shows the allocation as **two distinct visual beats** (senior, then
junior) and shows a deliberately bad attestation being **rejected with no state change**.

The MVP is complete only when all six outcomes in PRD §24 are demonstrated.

---

## 2. Role map

| # | Role | Owns | Handoff |
|---|---|---|---|
| 1 | Chain & Contracts Engineer | **All Solidity.** `/contracts/src`, `/contracts/script`, both deployments, `docs/evidence/deployments.json`, `docs/evidence/abi/` | `01-contracts.md` |
| 2 | Invariant & Adversarial Test Engineer | `/contracts/test`, `docs/evidence/test-output/` | `02-invariants.md` |
| 3 | Attestation Integration & Relayer Engineer | `/relayer`, `docs/evidence/transactions.json`, `docs/evidence/judge-verification.md`, `docs/evidence/runbook.md` | `03-integration.md` |
| 4 | Frontend Engineer (Next.js) | `/web` | `04-frontend.md` |

**No two roles write to the same file.** If you believe you need to modify a file another role owns,
stop and report it — do not edit it.

### Dependency graph

```
Role 1 ── freezes interfaces + ABIs (end of Day 2) ──┬──> Role 2  (tests against src + mocks)
       │                                             ├──> Role 3  (relayer binds to ABI)
       │                                             └──> Role 4  (UI binds to ABI + fixtures)
       │
       └── deploys Sepolia (Day 1) and CC3 (Day 3) ──┬──> Role 3  (live 3-hop)
                                                     └──> Role 4  (live reads)

Role 3 ── delivers the proof-field mapping brief (end of Day 2) ──> Role 1
          (Role 1 needs it to implement AttestcoinVerifier.sol on Day 3;
           Role 1 does NOT need it for TrancheWaterfall, which binds only to IAttestationVerifier)

Role 3 ── delivers transactions.json ──> Role 4 (audit trail links)
```

**Role 1 owns every `.sol` file in the repository, including the `AttestcoinVerifier` adapter.**
Role 3 owns every line of TypeScript that builds a proof and submits it. Role 3 never edits Solidity;
Role 1 never edits the relayer. Their meeting point is the proof-field mapping brief and the ABI.

### Dispatch order

1. **Immediately, in parallel:** Role 1 and Role 3.
   Role 1 starts with interfaces and the Sepolia deployment. Role 3 starts with an Attestcoin SDK
   spike against a real Sepolia log, and does not need the waterfall contract to do it.
2. **After Role 1 publishes frozen interfaces + ABIs (end of Day 2):** Role 2 and Role 4 start.
   Role 4 builds against committed fixtures until live addresses exist; it never blocks on chain work.
3. **Day 4–5 is a whole-team integration milestone** (PRD Risk 5): all four roles converge on making
   one real Sepolia → Attestcoin → CC3 chain succeed end to end. This is not a late handoff.

### Suggested timeline

| Day | Milestone |
|---|---|
| 1 (Sep 4–5) | `InvoiceRegistry` deployed to Sepolia, tx hash committed. Interfaces drafted. Attestcoin SDK spike. |
| 2 (Sep 6) | Interfaces + ABIs frozen and committed. Role 2 and Role 4 start. |
| 3 (Sep 7) | `TrancheWaterfall` complete, deployed to CC3 with the real verifier adapter. |
| 4–5 (Sep 8–9) | Whole-team 3-hop integration milestone. First real end-to-end allocation. |
| 6–7 (Sep 10–11) | INV-1..INV-6 suite green and captured. UI wired to live chains. Runbook written. |
| 8 (Sep 12) | Second repayment cycle. Fail-closed beat rehearsed. Evidence bundle complete. |
| 9 (Sep 13) | Freeze. Dry-run the three-minute demo. Submit. |

---

## 3. Technology decisions and why

### Contracts: Solidity 0.8.24, Foundry

Both chains are EVM (Sepolia; Creditcoin CC3 is an EVM chain, id 102031). The PRD makes a passing
Foundry property/fuzz suite a graded deliverable (§12, §14, §16, Risk 4), so Foundry is not a
preference — it is a requirement of the evidence bar.

*Rejected:* Hardhat (its fuzz/invariant story is materially weaker than `forge` `invariant_`/fuzz
testing, and the PRD names Foundry). Non-EVM targets (Attestcoin's source-chain support is Ethereum
only, PRD §5 non-goals).

### Off-chain: TypeScript + ethers v6, as a CLI, not a service

The Attestcoin / USC SDK is TypeScript and declares ethers v6 as a peer dependency, so the relayer
language is decided for us. The relayer ships as a **command-line tool**, not a hosted service,
because PRD §22.2 fixes the relayer as permissionless and unprivileged — a CLI has no deploy
surface, no uptime risk during judging, and is directly scriptable into the demo runbook.

*Rejected:* a Rust or Go relayer (would mean reimplementing the SDK). A hosted API server with a
database (there is no state for it to own — the chains are the state; a database would create a
second source of truth, and PRD §12 explicitly lists the UI hosting environment as untrusted).

### Frontend: Next.js App Router, Server Components by default, viem + wagmi

Balances and audit history are read directly from Creditcoin CC3 and Sepolia RPC inside Server
Components. There is no API layer and no database between the chain and the screen — that is a
product decision, not just an architectural one: the PRD's auditor persona (§6, §10 Feature 7) must
be able to trace every number to a transaction, and an intermediary would weaken that claim.

`viem` + `wagmi` for the client-side deposit flow (wallet connection); `ethers v6` in the relayer
only. These live in two separate, independently installed projects, so there is no shared bundle and
no duplication cost.

*Rejected:* a shared pnpm/turbo monorepo (cross-package coupling costs more than it saves over nine
days; three independent projects let four agents work without touching a shared lockfile). A
database or indexer (nothing to store). Server-side wallet custody (would make the relayer trusted,
contradicting §4).

### Repository layout — three independent projects, no workspace

```
/contracts          Foundry project (own foundry.toml, own lib/)   — Roles 1 and 2
/relayer            Node project (own package.json)                — Role 3
/web                Next.js project (own package.json)             — Role 4
/docs/evidence      Shared, append-only evidence bundle            — see ownership table above
```

There is no root `package.json` and no workspace file. Do not create one.

---

## 4. Frozen architecture decisions

These are decided. Do not relitigate them; if one is genuinely unworkable, report it rather than
changing it unilaterally.

### D-1 — Contracts depend on an interface, not on Attestcoin directly

`TrancheWaterfall` calls `IAttestationVerifier`, never the Attestcoin SDK or precompile directly.
Role 3 delivers the concrete `AttestcoinVerifier` adapter that implements that interface. This is
the single decision that de-risks PRD Risk 5: Roles 1 and 2 can work at full speed on day one with
zero Attestcoin knowledge, and every negative path (invalid, expired, reverting, out-of-gas) is
testable with a mock verifier.

### D-2 — The attestation ID is derived by the contract, never supplied by the relayer

```
transactionIndex = INativeQueryVerifier(PRECOMPILE).calculateTxIndex(merkleProof)
attestationId    = keccak256(abi.encodePacked(chainKey, height, transactionIndex))
```

A relayer that could choose the ID could defeat replay protection (INV-4) by resubmitting the same
event under a fresh ID. Deriving it inside the contract from the proof's own Merkle path closes
that. **Do not add a relayer-supplied `id` parameter.**

This derivation matches the Attestcoin ecosystem's own `ASCBase._computeQueryId` convention, so a
judge comparing TrancheTrade to the reference `ASCBase` pattern sees the same replay key.

Because the ID is per source *transaction*, `AttestcoinVerifier` MUST require that the proven Sepolia
transaction contains **exactly one** `InvoiceRepaid` log emitted by the registered `InvoiceRegistry`
address, and revert otherwise. `InvoiceRegistry` correspondingly emits exactly one `InvoiceRepaid`
per transaction.

### D-2b — Verification uses the `view` precompile call, so reentrancy is structurally impossible

The Attestcoin block-prover precompile exposes both `verify(...)` (`external view`, compiles to
`STATICCALL`) and `verifyAndEmit(...)` (state-changing). `AttestcoinVerifier` uses **`verify`**.

A `STATICCALL` cannot re-enter `TrancheWaterfall`, which makes PRD §16 adversarial case 11
("reentrancy cannot cause a single attestation to be applied more than once") true by construction
rather than by a guard that could be misconfigured. A `nonReentrant` modifier is still required on
`allocate` and `deposit` as defence in depth, and the checks-effects-interactions ordering is still
mandatory.

The cost of this choice is that no `TransactionVerified` event is emitted by the precompile. That is
acceptable: TrancheTrade emits its own `RepaymentAllocated` carrying `attestationId`, which is the
evidence the audit trail actually needs.

### D-2c — The precompile proves inclusion only; the application MUST check execution status

Verbatim from the Attestcoin documentation: the block prover precompile *does not* validate whether
a transaction succeeded. It proves only that the transaction is included in a block and that the
block belongs to the confirmed source chain.

`AttestcoinVerifier` MUST therefore, after a successful `verify`, decode the proven transaction and
require `receiptStatus == 1` before returning an amount. Omitting this check would let a relayer
allocate against a *reverted* Sepolia repayment. Treat this as a named invariant obligation, not an
optional hardening step.

### D-3 — `AttestationFailed` is a custom error, not an event

The PRD contains a genuine contradiction: §9 Step 6 requires the transaction to revert entirely
**and** requires an `AttestationFailed(reason)` event to be emitted. A reverted transaction does not
persist logs, so both cannot be literally true.

Resolution, which preserves INV-3 exactly and satisfies Feature 6's intent:

```solidity
error AttestationFailed(bytes32 attestationId, RejectionReason reason);
```

The revert data is returned on-chain, is recorded against a real reverted transaction hash on the
CC3 explorer, and is decodable by the UI and by any auditor. The rejection is therefore still
"emitted and surfaced", still independently verifiable, and no state was written. The rejection
record itself lives in the off-chain audit trail (Feature 7), which is the only place it *can* live
given a full revert.

### D-4 — Allocation is an accounting entitlement, not a fund transfer

The repayment happens on Sepolia. No value crosses to Creditcoin. `TrancheWaterfall` therefore
allocates *attested repayment value* against tranche entitlements: an allocation reduces
`seniorOutstanding` / `juniorOutstanding` and increases `seniorClaimed` / `juniorClaimed`. It does
not move CTC.

Every role must respect this in its language. The mandated demo string "no funds moved" (§10
Feature 6) is used verbatim because the PRD mandates it, but no role may claim anywhere else that
the protocol settles or custodies repayment cash in the MVP. This is consistent with PRD §13's
disclosed limitations and must not be overclaimed under demo-week pressure.

### D-5 — Over-repayment reverts

The PRD does not say what happens when an attested repayment exceeds
`seniorOutstanding + juniorOutstanding`. INV-6 states that `seniorAllocation + juniorAllocation`
**exactly equals** the attested amount, so a surplus bucket would violate INV-6 as written.

Decision: revert with `RepaymentExceedsOutstanding`. INV-6 then holds verbatim and by construction,
and the behaviour is fail-closed, which is the product's whole posture.

### D-6 — "Expired" is not a wall-clock window, and we must not invent one

The PRD requires an "expired attestation" rejection path (§16 case 5) but never defines expiry.
Research against the Attestcoin documentation establishes that **Attestcoin proofs do not expire**.
Age affects gas cost, not validity: attestations are pruned into sparser checkpoints after roughly
24 hours, so an older transaction needs a longer continuity chain — the documented cost formula is
`CTC ≈ 2.3e-5 + 2.9e-7 × (continuity hash count)`, and a 24-hour-old proof costs over 10× a
10-minute-old one.

Inventing a `MAX_PROOF_AGE` timestamp check would be a fabricated mechanism that no judge could
verify against Attestcoin's actual behaviour. We do not do that. Instead:

- **The genuine expiry mode** is a continuity proof whose anchoring attestation has been pruned or
  replaced. That fails continuity verification inside the precompile and reverts — the **identical
  code path** as an invalid proof. This is exactly what PRD §22.4 asserts, and it is true.
- `RejectionReason.ExpiredProof` is therefore raised by the Foundry suite through a mock verifier
  that reverts with a continuity failure, as a separately named test proving the path, and by the
  live path indistinguishably from `InvalidProof`. The contract does not claim to tell them apart,
  because it cannot.
- **One real staleness guard is enforced,** because it is meaningful and checkable:
  `require(height >= minSourceHeight)`, where `minSourceHeight` is the immutable Sepolia block at
  which `InvoiceRegistry` was deployed. A proof predating the registry cannot describe a real
  invoice. Reason code: `RejectionReason.StaleProof`.

Per PRD §22.4 the **live** demo uses a deliberately malformed proof. Documentation must state
plainly that a genuinely pruned/expired attestation follows the identical code path — and must not
claim TrancheTrade enforces a time-based expiry that Attestcoin does not have.

### D-7 — Open product decisions from PRD §22, resolved

| # | Decision | Resolution |
|---|---|---|
| 1 | Fixed or investor-adjustable split | **Fixed.** `SENIOR_CAP` and `JUNIOR_CAP` are immutable deploy-time constants. Demo values: senior 70,000 CTC-equivalent, junior 30,000. |
| 2 | Who pays the fee | **Permissionless relayer.** No allowlist, no owner check on `allocate`. |
| 3 | Multiple repayment events per pool | **Yes, required in MVP.** The waterfall must handle sequential attested events against evolving balances. |
| 4 | Expired or malformed proof for the live demo | **Malformed**, for live reliability. Expired is unit-tested on the identical path and documented. |
| 5 | Disclosed credit-risk rule | **One flat, disclosed rule.** Senior entitlement = principal × 1.06. Junior entitlement = principal × 1.18. Stated in the UI as a simplification, never as a scoring engine. |

---

## 5. Frozen interfaces

Role 1 owns the canonical files. They are reproduced here so every role can work from the same
shapes. If Role 1 needs to change one after Day 2, that is a PM escalation, not a silent edit.

The proof shape below is taken verbatim from `INativeQueryVerifier.sol` as published in
`@gluwa/asc-contracts@0.2.1`. It is the real Attestcoin shape, not a placeholder.

```solidity
// contracts/src/interfaces/INativeQueryVerifier.sol
pragma solidity 0.8.24;

interface INativeQueryVerifier {
    struct MerkleProofEntry { bytes32 hash; bool isLeft; }
    struct MerkleProof { bytes32 root; MerkleProofEntry[] siblings; }
    struct ContinuityProof { bytes32 lowerEndpointDigest; bytes32[] roots; }

    function verify(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata continuityProof
    ) external view returns (bool);

    function calculateTxIndex(MerkleProof calldata merkleProof) external view returns (uint64);
}
```

Precompile address: `0x0000000000000000000000000000000000000FD2`.

```solidity
// contracts/src/interfaces/IAttestationVerifier.sol
pragma solidity 0.8.24;

struct RepaymentProof {
    uint64 chainKey;
    uint64 height;
    bytes encodedTransaction;
    INativeQueryVerifier.MerkleProof merkleProof;
    INativeQueryVerifier.ContinuityProof continuityProof;
}

struct AttestedRepayment {
    bytes32 attestationId;
    uint256 invoiceId;
    uint256 repaymentAmount;
    uint64 sourceHeight;
}

interface IAttestationVerifier {
    function verifyRepayment(RepaymentProof calldata proof)
        external
        view
        returns (AttestedRepayment memory);
}
```

`verifyRepayment` MUST revert on any invalid, unknown, unverifiable, or unsuccessful source
transaction. It MUST NOT return a boolean success flag — a boolean invites a caller that forgets to
check it. Reverting is the fail-closed default, and it is what makes INV-3 hold.

`TrancheWaterfall` knows nothing about Attestcoin. It holds an immutable `IAttestationVerifier` and
calls exactly one function on it. This is decision D-1 and it is what lets Roles 1, 2 and 4 work at
full speed from day one.

```solidity
// contracts/src/interfaces/ITrancheWaterfall.sol
pragma solidity 0.8.24;

enum Tranche { Senior, Junior }

enum RejectionReason {
    InvalidProof,
    ExpiredProof,
    StaleProof,
    AlreadyApplied,
    AmountZero,
    ExceedsOutstanding
}

event Deposited(address indexed investor, Tranche indexed tranche, uint256 principal, uint256 entitlement);
event SeniorAllocated(bytes32 indexed attestationId, uint256 amount, uint256 seniorOutstandingAfter);
event JuniorAllocated(bytes32 indexed attestationId, uint256 amount, uint256 juniorOutstandingAfter);
event RepaymentAllocated(
    bytes32 indexed attestationId,
    uint256 indexed invoiceId,
    uint256 attestedAmount,
    uint256 seniorAllocation,
    uint256 juniorAllocation
);

error AttestationFailed(bytes32 attestationId, RejectionReason reason);
error RepaymentExceedsOutstanding(uint256 attestedAmount, uint256 totalOutstanding);
error TrancheCapExceeded(Tranche tranche, uint256 cap, uint256 attempted);
```

`SeniorAllocated` is emitted **before** `JuniorAllocated` in every successful allocation. Two
separate events, never one combined event — this is the on-chain counterpart of the two visual beats
in PRD Feature 5, and the UI derives its beats from event ordering.

### The six invariants (PRD §12), verbatim

1. **INV-1 — Waterfall Order.** On any attested repayment event, the contract allocates to `seniorOutstanding` first; a nonzero junior allocation is impossible unless `seniorOutstanding == 0` after that allocation.
2. **INV-2 — No Junior Skip-Ahead.** `juniorOutstanding` cannot decrease in the same transaction where `seniorOutstanding > 0` both before and after senior allocation.
3. **INV-3 — Fail-Closed on Attestation Failure.** A reverted, timed-out, or invalid attestation call writes to neither tranche and leaves state exactly at its pre-call value.
4. **INV-4 — Replay Protection.** Each attestation ID can be applied at most once.
5. **INV-5 — Two-Tranche Cap, Enforced in Code.** The tranche count is an immutable constant fixed at deploy time to exactly 2.
6. **INV-6 — Conservation.** For any single attested repayment event, `seniorAllocation + juniorAllocation` exactly equals the attested repayment amount.

---

## 6. Shared network facts

| | Ethereum Sepolia | Creditcoin CC3 testnet |
|---|---|---|
| Chain ID | 11155111 | 102031 |
| RPC (HTTPS) | any public Sepolia RPC | `https://rpc.cc3-testnet.creditcoin.network` |
| RPC (WSS) | — | `wss://rpc.cc3-testnet.creditcoin.network` |
| Explorer | `https://sepolia.etherscan.io` | `https://creditcoin-testnet.blockscout.com` |
| Native symbol | ETH | CTC |

Source: `https://docs.creditcoin.org/smart-contract-guides/creditcoin-endpoints`.

CC3 testnet: PoS (BABE), 15 s block time, finality in 1–3 blocks, currency symbol tCTC. **The faucet
is a Discord bot only** — join `https://discord.gg/creditcoin`, channel `token-faucet`, and run
`/faucet address:<your EVM address>`. There is no HTTP faucet URL. Fund the deployer and the relayer
wallets on **Day 1**; do not discover a funding problem on Day 8.

### Attestcoin protocol facts (verified 2026-09-04)

| Fact | Value | Source |
|---|---|---|
| SDK package | `@gluwa/usc-sdk`, latest `0.18.0` | npm registry |
| SDK dependencies | `ethers ^6.15.0`, `axios`, `dotenv`, `exponential-backoff` (regular deps, not peer deps) | npm registry |
| Solidity package | `@gluwa/asc-contracts`, latest `0.2.1`, distributed as source for Foundry | npm registry |
| Block prover precompile | `0x0000000000000000000000000000000000000FD2` | `@gluwa/asc-contracts` |
| ChainInfo precompile | `0x0000000000000000000000000000000000000fd3` | docs.attestcoin.org |
| Proof generator API | `https://prover.cc3-testnet.creditcoin.network` | docs.attestcoin.org |
| Decoder contract (CC3 testnet) | `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` | docs.attestcoin.org |
| ASC dashboard | `https://dashboard.cc3-testnet.creditcoin.network/` | docs.attestcoin.org |
| Examples repo | `https://github.com/gluwa/usc-testnet-bridge-examples` | docs.attestcoin.org |
| Sepolia `chainKey` on CC3 testnet | `1` (note: this is **not** the EVM chain id 11155111) | docs.attestcoin.org |
| Attestation cadence for Ethereum | new attestation ≈ every 2 min; checkpoint ≈ every 20 min | docs.attestcoin.org |
| On-chain verification latency | ≈ 15 s, one Creditcoin block | docs.creditcoin.org |
| Proof expiry | **None.** Age raises gas cost, not invalidity. See D-6. | docs.attestcoin.org |
| Source tx size limit | ≈ 500 KB; larger transactions may be unverifiable | docs.attestcoin.org |

Documentation entry points, all of which serve machine-readable `.md`:
`https://docs.attestcoin.org/llms.txt`, `https://docs.attestcoin.org/llms-full.txt`,
`https://docs.creditcoin.org/llms-full.txt`.

Two facts that are easy to get wrong and expensive to discover late:

1. `chainKey` (Attestcoin-internal, `1` for Sepolia) is a different number from the EVM `chainId`
   (`11155111` for Sepolia). Confusing them produces a proof that verifies against the wrong chain
   or fails opaquely.
2. Precompiles report `extcodesize == 0`. Any "is this a contract?" guard written the usual way will
   wrongly reject the precompile. `@gluwa/asc-contracts` ships `NativeQueryVerifierLib.hasPrecompile()`
   which checks `PRECOMPILE.code.length > 0` — read it before writing your own.

---

## 7. Shared evidence bundle

`docs/evidence/` is the artifact every judge and every role reads. Ownership is exclusive:

| Path | Owner | Contents |
|---|---|---|
| `docs/evidence/deployments.json` | Role 1 | Contract addresses, chain ids, deploy tx hashes, deploy block numbers, commit SHA |
| `docs/evidence/abi/*.json` | Role 1 | Committed ABI JSON for every deployed contract |
| `docs/evidence/test-output/` | Role 2 | Captured `forge test` output, gas report, coverage summary |
| `docs/evidence/transactions.json` | Role 3 | The three-hop transaction manifest (schema in `03-integration.md`) |
| `docs/evidence/judge-verification.md` | Role 3 | Step-by-step public verification instructions |
| `docs/evidence/runbook.md` | Role 3 | The demo runbook matching PRD §15 |

`docs/evidence/transactions.json` is a **contract between Role 3 and Role 4**. Its schema is
reproduced in both `03-integration.md` and `04-frontend.md`. Neither role may change it without the
other; changes are a PM escalation.

---

## 8. Standing rules — binding on every role

- **English everywhere.** Identifiers, strings, documentation, commit messages, replies.
- **No comments in code.** Not block comments, not single-line, not JSDoc, not NatSpec on internal
  functions. The only exception is scaffolding the user has explicitly framed as temporary, which
  gets exactly one line: `// TEMPORARY — <what it is>; delete with <what to remove>`.
  Solidity is included in this rule. Name things so the comment is unnecessary.
- **TypeScript stays strict.** `strict: true`. No `any`, no `@ts-ignore`, no non-null assertion used
  to silence a genuinely nullable value.
- **No new dependency without asking.** Check what the project already has first. If a role's
  handoff names a dependency, that one is pre-approved; anything else needs PM sign-off.
- **Server Components are the default** in the Next.js App Router. `use client` goes on the leaf
  that needs interactivity, never on a layout or a page to make one button work.
- **Every animation respects `prefers-reduced-motion`,** and the meaning of the animation must
  survive its removal.
- **Never read, write, or echo `.env*` files or secrets.** Configuration is read from the process
  environment at runtime. Never print a private key, never commit one, never include one in output.
- **Never run `git commit`, `git push`, or any destructive git command unless the user asks.** Never
  `git add -A` or `git add .` — stage explicit paths only.
- **No `--force`, no `--broadcast` against mainnet, ever.** Testnets only.
- **Never claim a transaction, hash, or address that you have not actually produced.** If something
  did not run, say it did not run. A fabricated hash is a disqualifying failure for this project.

---

## 9. Language discipline (PRD §13, §20)

Every role that writes user-facing copy, documentation, or commit messages must observe these. They
are product constraints, not style preferences.

- Never imply a registered securities offering, a fund, an investment contract, or a guaranteed
  return.
- Never claim TrancheTrade "prevents a crisis". The problem is structural and chronic (PRD §3.5).
- Never claim tranching is a novel invention. The originality claim is narrow and specific: applying
  an established senior/junior waterfall to an Attestcoin-attested on-chain trade-finance repayment
  event.
- Always disclose that invoice data is synthetic/testnet, in the same view where it is shown — not
  in a separate footnote.
- Never present the fixed 6% / 18% rule as a credit-scoring engine.

---

## 10. Design system

The authoritative visual reference is `docs/code.html` and `docs/screen.png`. The full
design-system inventory — including which parts are inventoried from the reference and which were
extended for a financial UI, and why — is in **§Appendix A of `04-frontend.md`**, reproduced there
verbatim. Any role producing a visual artifact (including the deck) should read it.

Two gaps were identified and handled explicitly rather than silently:

1. The reference is a museum page with no tables, forms, inputs, modals, or data-dense components,
   and no badges beyond one rotated status sticker. TrancheTrade needs tranche balance displays, a
   deposit flow, and an audit-trail table. These were extended in the reference's own idiom and are
   marked `[EXTENDED]` in the inventory with the basis for each extension.
2. The reference has no loading, error, empty, or rejected states, yet Feature 6 requires an
   unambiguous fail-closed rejection state. All four states are specified in the reference's visual
   language with real values, and are marked `[EXTENDED]`.
