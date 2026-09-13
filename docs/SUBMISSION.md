# TrancheTrade

### One attested repayment. A waterfall, not a flat rate.

**Track:** Creditcoin / Attestcoin Protocol — BUIDL CTC 2026 Fall (DoraHacks)
**Live app:** https://tranhetrade-production.up.railway.app
**Repository:** https://github.com/Vamp-Labs/TrancheTrade
**3-minute demo script:** [`DEMO_SCRIPT_3MIN.md`](./DEMO_SCRIPT_3MIN.md)
**Full judge verification guide:** [`evidence/judge-verification.md`](./evidence/judge-verification.md)

---

## The hook

Every investor funding the same trade-finance pool today gets exactly the same rate — whether
they wanted to bet like a hedge fund or sleep like a pension fund. That single design decision
is a *named, documented reason* a **$2.5 trillion-a-year** financing gap hasn't moved since
2023, and why SMEs get rejected for trade finance at **roughly double** the rate of large
corporations.

Real-world structured finance solved this decades ago with tranching. Nobody had built the
on-chain version gated by a real, independently verifiable attestation — until now.

TrancheTrade takes one real Attestcoin-attested Ethereum Sepolia repayment event and runs it
through a hard-capped, code-enforced senior/junior waterfall on Creditcoin CC3. Senior investors
get paid first and are protected from the first losses. Junior investors absorb risk first and
earn a higher rate for it. Feed it a bad or replayed attestation, and it fails **completely**
closed — no partial write, no silent skip, balances held exactly where they were.

**Every other attested-event product in this hackathon's field gives you one number.
TrancheTrade gives you a waterfall — verified, ordered, and provably safe to fail.**

---

## The problem, with receipts

- **$2.5 trillion a year.** The global trade-finance gap, roughly 10% of global trade, flat
  since 2023 — not shrinking on its own. 80% of banks surveyed expect demand to keep rising.
  *(ADB Global Trade Finance Gap Survey, 9th edition, 2025.)*
- **~45% vs ~20%.** SME trade-finance rejection rate versus multinational corporations for the
  same underlying financing activity — climbing to **~70%** for women-owned SMEs specifically.
  *(WTO/ICC-sourced, via GTR and a UN DESA financing brief.)*
- **13 days.** The median cash buffer for a quarter of small businesses — meaning one unfunded
  or delayed receivable can be the difference between payroll and default inside two weeks.
- **Not a UX inconvenience — a documented capital-supply bottleneck.** Structured-finance
  practice treats senior/mezzanine/junior tranching as *the* mechanism that lets conservative
  capital take a protected slice while risk-tolerant capital (often a development bank) absorbs
  first loss. That's specifically why institutional capital enters trade-finance securitization
  at all in the real world. On-chain, almost nobody does this — most attested-event products in
  this hackathon's own field reproduce the flat-pool pattern the real market has already moved
  away from.

We say this plainly rather than oversell it: this is a real, chronic, structural allocation
failure — not a single incident an exploit-style circuit-breaker averts. TrancheTrade doesn't
claim to "prevent a crisis." It claims to fix the specific mechanism that keeps conservative
capital on the sidelines.

---

## The solution

```
Ethereum Sepolia              Attestcoin                    Creditcoin CC3 testnet
InvoiceRegistry     ──────▶   attests the           ──────▶ TrancheWaterfall
InvoiceRepaid event           InvoiceRepaid log              senior-first, junior-second
(real transaction)            (real attestation)             (real transaction)
```

1. **Invoice repaid.** A real `InvoiceRepaid` event lands on Ethereum Sepolia via a minimal,
   self-deployed `InvoiceRegistry` — invoice data is synthetic/testnet, disclosed plainly, never
   presented as a live production counterparty.
2. **Attested.** A permissionless relayer requests an Attestcoin attestation of that event.
   Attestcoin verifies it against the source chain and returns a proof carrying the exact
   repayment amount and a unique attestation id, derived from the proof's own Merkle path — not
   supplied by the relayer, so it can't be gamed.
3. **Allocated.** Any relayer submits the proof to `TrancheWaterfall` on Creditcoin CC3. The
   contract verifies the proof *before any state write*, allocates the full amount to the senior
   tranche first, and only spills the remainder to junior once senior reaches zero — in the same
   transaction, in strict event-log order (`SeniorAllocated` always at a lower log index than
   `JuniorAllocated`).
4. **Protected.** If the proof is invalid, corrupted, expired, or already applied, the entire
   transaction reverts. Tranche state after a failed call is bit-for-bit identical to before it.
   No partial write. No silent skip.

The relayer is intentionally untrusted: it can deliver a proof, trigger allocation, and pay gas
— and nothing else. It cannot forge an event, change an amount, reorder the waterfall, replay an
applied attestation, or bypass the fail-closed path. **Attestcoin's verified proof is the sole
trusted input in the entire system.**

---

## Why this is different

| Live in this hackathon's field | What it gives you | What TrancheTrade gives you instead |
|---|---|---|
| FactorX | A flat soulbound credit score from an attested event | The same category of attested input, allocated through a risk-stratified waterfall, not one blended score |
| LoomCredit | A flat approve/refer/reject decision | A tranche allocation, not a single accept/reject line |
| Most of the field | Attest → unlock/score a single line | Attest → **two-beat waterfall**, senior then junior, visibly and verifiably in that order |

Independently verified across three live-field searches (~90 checked submissions, ~81% field
coverage): **TrancheTrade is the only submission evaluated that allocates an attested repayment
through a hard-capped, code-enforced senior/junior waterfall, rather than a single blended score
or decision.**

To be precise about the originality claim: tranching itself is not new — BarnBridge, Saffron,
and traditional trade-finance securitization all use senior/junior structures. What's new here
is applying that established pattern to an **Attestcoin-attested, on-chain trade-finance
repayment event**, in a field where almost nobody else has.

---

## Proof this is real, not a mockup

### Deployed contracts

| Contract | Chain | Address |
|---|---|---|
| `InvoiceRegistry` | Ethereum Sepolia (`11155111`) | [`0x049a7c970Bd1e35ff13C15e73F59FbfA690D3ae5`](https://sepolia.etherscan.io/address/0x049a7c970Bd1e35ff13C15e73F59FbfA690D3ae5) |
| `TrancheWaterfall` | Creditcoin CC3 testnet (`102031`) | [`0x11ae52135180Cc0e76d28fbD6c9985393C291868`](https://creditcoin-testnet.blockscout.com/address/0x11ae52135180Cc0e76d28fbD6c9985393C291868) |
| `AttestcoinVerifier` | Creditcoin CC3 testnet (`102031`) | [`0x3b3dfc7609fA394EC268364Df0270444963428F1`](https://creditcoin-testnet.blockscout.com/address/0x3b3dfc7609fA394EC268364Df0270444963428F1) |

### Four real, independently verifiable transaction cycles

| Cycle | What happened | Sepolia tx | Creditcoin tx |
|---|---|---|---|
| 1 | Senior-only allocation — 2,000 tCTC repayment absorbed entirely by senior | [`0xb54cb83e…3494f18`](https://sepolia.etherscan.io/tx/0xb54cb83ecef6d7d3da44148e514337b9a9e387f49b666ab8d04282a2e3494f18) | [`0xc2e49068…44c342`](https://creditcoin-testnet.blockscout.com/tx/0xc2e4906846f82edbccc7724197d106da2ae4d420ff4bd8c30464b0b92544c342) |
| 2 | Senior exhausts, spills into junior — 1,500 tCTC repayment, 1,180 to senior, 320 to junior | [`0x3ac3a2eb…2eefa9`](https://sepolia.etherscan.io/tx/0x3ac3a2eb08bb64d4b7d27860769ac8558c16f5423ff623dd05b63ce30f2eefa9) | [`0x93f2afba…12487632`](https://creditcoin-testnet.blockscout.com/tx/0x93f2afba1b375d03f33a254ba24fadb0aa121cd824d4c69d491c777e12487632) |
| 3 | Deliberately corrupted continuity proof — **reverted**, both balances unchanged | resubmits cycle 2's tx | [`0x01d6930b…526e327c4`](https://creditcoin-testnet.blockscout.com/tx/0x01d6930bca16481be5cada95f80b36b212e2cfb7881fbd3f45dc0c5526e327c4) (reverted) |
| 4 | Replay of cycle 1's already-applied attestation — **reverted**, `AlreadyApplied` | resubmits cycle 1's tx | [`0xb4f3872f…5aab797468b`](https://creditcoin-testnet.blockscout.com/tx/0xb4f3872f9c6a0f5e7967f6b5d3e10e71042266459a34a8d1ea87c5aab797468b) (reverted) |

Every hash above resolves on a public explorer, right now. Full detail — Merkle proofs,
continuity checks, revert decoding, and reproduction commands — is in
[`evidence/judge-verification.md`](./evidence/judge-verification.md) and the raw manifest at
[`evidence/transactions.json`](./evidence/transactions.json).

### A passing invariant suite, not deck prose

Six named security invariants (waterfall order, no junior skip-ahead, fail-closed, replay
protection, the immutable two-tranche cap, and conservation of value) are enforced in Solidity
and verified by **36/36 passing Foundry tests** — 27 deterministic unit tests plus 9 fuzz
properties, each run 10,000 times against randomized inputs:

```bash
cd contracts && forge test
```

### A live, clickable demo — no wallet, no waiting

The deployed frontend has a **"Replay recorded sequence"** control that plays back all four real
cycles above with the actual two-beat waterfall animation (senior sweeps first, then a 300ms
hold, then junior) and the exact fail-closed rejection string, using nothing but the real
recorded transaction data — no CLI, no wallet connection, no waiting on a fresh 20-minute
attestation checkpoint.

---

## Try it yourself

```bash
# Confirm the deployed contracts are live
export CC3=https://rpc.cc3-testnet.creditcoin.network
cast call 0x11ae52135180Cc0e76d28fbD6c9985393C291868 "snapshot()" --rpc-url $CC3
cast chain-id --rpc-url $CC3   # must print 102031

# Run the invariant suite yourself
git clone https://github.com/Vamp-Labs/TrancheTrade.git
cd TrancheTrade/contracts && forge test

# Run the frontend locally
cd ../web && npm install && npm run dev
```

Or just open **https://tranhetrade-production.up.railway.app** and click
**"Replay recorded sequence."**

---

## What this deliberately does not claim

Stated here so it's never dropped silently under demo pressure:

- **Not a securities offering, a fund, or an investment contract.** No secondary tranche-token
  trading, no guaranteed or insured returns. The regulatory framing of senior/junior structures
  needs a lawyer's review post-hackathon — explicitly out of scope here, and recorded as such
  before any judge has to ask.
- **Invoice data is synthetic and testnet-only**, disclosed plainly in the same view the data
  appears, matching the disclosed-simulation pattern used by comparable entries in this
  hackathon's own field.
- **The 1.06× / 1.18× senior/junior rate is a single fixed, disclosed rule** — not a credit
  score, not a risk model, not an automated scoring engine.
- **Allocation is an accounting entitlement, not a fund transfer.** The repayment happens on
  Sepolia; no value crosses chains. Nothing here moves real money.
- **Tranching is not a novel invention.** The narrow, defensible claim is applying an
  established senior/junior waterfall to an Attestcoin-attested, on-chain trade-finance
  repayment event — a combination this hackathon's live field does not otherwise show.

---

## What's next

1. Publish the six-invariant test suite and an integration guide as reusable infrastructure for
   any Creditcoin builder shipping an attested-repayment-driven product.
2. Pursue one real or credible-pilot trade-finance/factoring counterpart — the single most
   valuable piece of post-hackathon evidence, more valuable than any number of additional
   synthetic invoices.
3. Legal review of the tranche-waterfall regulatory framing, then additional tranche templates
   (e.g. three-tier structures) only once the two-tranche flow has been audited in the wild.

**The long-term position:** the default risk-stratification layer for attested, on-chain
trade-finance and RWA cash flows on Creditcoin.

---

## Architecture and code

| Component | Path | Stack |
|---|---|---|
| Contracts | [`contracts/`](../contracts) | Solidity 0.8.24, Foundry |
| Relayer | [`relayer/`](../relayer) | TypeScript, ethers.js, `@gluwa/usc-sdk` |
| Frontend | [`web/`](../web) | Next.js 15 App Router, TypeScript strict, viem, wagmi |

Full technical detail: [`README.md`](../README.md) at the repo root,
[`TrancheTrade_PRD.md`](./TrancheTrade_PRD.md) for the complete product spec, and
[`handoffs/`](./handoffs) for the per-role engineering specs each part of this system was built
against.
