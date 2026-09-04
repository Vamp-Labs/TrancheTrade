# TrancheTrade — Product Requirements Document

**Version:** 1.0
**Status:** Hackathon MVP definition
**Product type:** Attestation-gated, risk-stratified trade-finance marketplace
**Source authority:** Ethereum Sepolia (attested invoice repayment events)
**Destination:** Creditcoin CC3
**Verification layer:** Attestcoin
**Document scope:** Product, features, business thesis, demo, and delivery requirements
**Event:** BUIDL CTC 2026 Fall (Creditcoin / Attestcoin Protocol, DoraHacks)
**Submission deadline:** 2026-09-13 23:59 ET / 2026-09-14 03:59 UTC

---

## 1. Executive Summary

TrancheTrade lets investors buy risk-stratified exposure to Attestcoin-attested trade-finance invoices, instead of a single flat pooled rate.

Every live rate-based competitor in this hackathon's own submission pool (FactorX, LoomCredit, and others) attests a repayment or trade event and produces one blended score or line. TrancheTrade attests the same category of event, but instead of one number, it allocates the outcome into a hard-capped two-tranche waterfall: a senior tranche that is protected first, and a junior tranche that absorbs the remaining risk in exchange for a higher return. When an attested repayment event lands, the senior balance updates first; only once the senior tranche is fully satisfied does any amount reach the junior tranche.

This is not a new financial primitive. Tranching is the real-world trade-finance industry's own established fix for the same problem TrancheTrade targets on-chain: undifferentiated, flat-pooled credit risk is a documented reason conservative capital avoids trade finance in the first place. TrancheTrade brings that already-proven structure on-chain, gated by Attestcoin so that tranche movement is driven by a verified real-world repayment event rather than an internal admin decision.

The product promise is:

> **One attested repayment. A waterfall, not a flat rate.**

The core product loop is:

> **Fund → Attest → Allocate → Protect → Settle**

---

## 2. Product Pitch

### One-line pitch

> **Risk-stratified tranches for Attestcoin-attested trade-finance invoices — a waterfall, not a flat pooled rate.**

### Memorable pitch

> **One repayment. Two tranches. A strict waterfall, live.**

### 30-second pitch

A small exporter's invoice gets funded through a Creditcoin trade-finance pool. Today, every investor in that pool receives the same blended rate regardless of how much risk they actually want to carry — which is exactly the structure the real trade-finance industry has already identified as a reason conservative capital stays out of this asset class entirely.

TrancheTrade attests the invoice's repayment event through Attestcoin, then allocates it through a hard-capped, code-enforced two-tranche waterfall. Senior investors get paid first and are protected from the first losses; junior investors absorb risk first and are compensated with a higher rate. If the Attestcoin attestation call fails or times out, the contract fails closed — no partial write, no silent skip, tranche balances stay exactly where they were.

If a relayer or a bad actor tries to apply the same repayment attestation twice, or push funds past the senior tranche before it is exhausted, TrancheTrade blocks it and no funds move incorrectly.

### Category definition

TrancheTrade is a **risk-stratified, attestation-gated trade-finance settlement layer**.

It is not:

- A generic RWA token wrapper.
- A lending protocol with a single interest-rate curve.
- A credit-scoring oracle.
- A securities offering or a regulated investment fund.
- A cross-chain bridge.
- A general-purpose derivatives platform.

### Core question

> **How can trade-finance investors choose their own risk exposure to a real-world repayment event, verified on-chain, without every investor being forced into the same blended rate?**

---

## 3. Problem

### 3.1 The gap is large, persistent, and not closing on its own

The global trade finance gap is **$2.5 trillion a year**, roughly **10% of global trade**, and has not shrunk — it has held essentially flat since 2023. 80% of banks surveyed expect demand for trade finance to rise further as supply chains reconfigure. *(Source: ADB Global Trade Finance Gap Survey, 9th edition, 2025.)*

### 3.2 The gap does not fall evenly — SMEs are disproportionately shut out

**~45% of SME trade-finance requests are rejected**, versus **~20% for multinational corporations** for the same kind of underlying financing activity. That rejection rate climbs to **~70% for women-owned SMEs** specifically. *(Source: WTO/ICC-sourced data, via GTR and a UN DESA financing brief; consistent across two independent secondary summaries, primary WTO dataset not independently re-tabulated by this team.)*

### 3.3 A rejected or delayed invoice is a real cash-flow event, not an abstraction

Roughly a quarter of small businesses hold **13 or fewer days of cash buffer** — meaning a single unfunded or delayed receivable can be the difference between meeting payroll and defaulting within about two weeks. Peer-reviewed research links late or unfunded receivables directly to credit rationing and higher SME insolvency rates. *(Source: small-business cash-flow research roundups citing Federal Reserve small-business survey data; a ScienceDirect study on late payments and SME access to finance.)*

### 3.4 Undifferentiated pooling is a documented cause of the capital shortage, not just a UX inconvenience

Structured-finance practice treats tranching — senior, mezzanine, junior — as the standard mechanism for widening the investor base for pooled credit assets, because it lets conservative capital take a protected senior slice while risk-tolerant capital (often a development bank or multilateral, absorbing first loss) takes the junior slice. In real trade-finance securitization, this is specifically why institutional capital enters an asset class it would otherwise avoid. *(Source: IDB Invest and GTR industry publications on trade-finance securitization structure.)*

### 3.5 What this means for TrancheTrade's problem framing — stated honestly

This is a real, evidence-backed, dual-sided problem: SMEs face genuine business-failure risk from unfunded invoices, and capital stays on the sidelines because flat pooling is a documented, named reason conservative investors won't enter the asset class. It is **not**, however, an acute, adversarial, single-incident crisis in the way an exploit, a de-peg event, or a treasury drain is — it is a structural, chronic allocation failure. TrancheTrade does not claim otherwise, and the pitch must not claim on stage that this mechanism "prevents a crisis" in that sense; that claim would not survive a follow-up question.

This hackathon's own live submission set (FactorX, LoomCredit, and other RWA/credit entries) mostly reproduces the flat-pool pattern that the trade-finance industry itself has already identified as a capital-supply bottleneck — the dominant pattern here isn't just less optimal, it is replicating a structure the real market has moved away from for exactly this reason.

---

## 4. Product Thesis

The strongest fix for a flat-pool trade-finance market is not a better score — it is letting capital self-select its risk tier against a single, attested source of truth. TrancheTrade combines four capabilities:

| Capability | Product responsibility |
|---|---|
| Attestcoin-verified repayment | Proves a real invoice-repayment event occurred, sourced from Ethereum Sepolia |
| Hard-capped tranche structure | Exactly two tranches — senior, junior — fixed at deploy time, not runtime-configurable |
| Waterfall allocation | Enforces strict senior-first, junior-second payout order on every attested event |
| Fail-closed execution | Guarantees that a failed or invalid attestation never partially updates tranche state |

The relayer that submits an attestation is intentionally untrusted.

The relayer can:

- Deliver an Attestcoin attestation proof for a real repayment event.
- Trigger the waterfall-allocation function.
- Pay the destination-chain transaction fee.

The relayer cannot:

- Create or forge a repayment event.
- Change the attested repayment amount.
- Reorder the waterfall (push funds to junior before senior is exhausted).
- Replay an already-applied attestation.
- Change the tranche count or caps.
- Bypass the fail-closed path on an invalid or expired proof.

---

## 5. Product Goals

### Primary goals

1. Let trade-finance investors choose senior or junior exposure to the same underlying attested invoice, instead of one blended rate.
2. Make tranche allocation driven by a verified, real-world repayment event, not an internal administrative decision.
3. Guarantee that a failed or replayed attestation can never corrupt tranche state.
4. Make every waterfall allocation and every rejection explainable to a non-technical investor.
5. Demonstrate, live, that a bad or expired attestation cannot move funds.
6. Provide an auditable link between the Sepolia repayment event, the Attestcoin proof, and the Creditcoin tranche update.
7. Establish the tranche-waterfall pattern as reusable infrastructure for other Creditcoin RWA/credit products.

### Hackathon goals

1. Deploy a real `InvoiceRegistry` contract on Ethereum Sepolia and emit a real `InvoiceIssued` / `InvoiceRepaid` event.
2. Attest that real event through Attestcoin with a real attestation transaction.
3. Deploy the two-tranche waterfall contract on Creditcoin CC3 (or the designated testnet) and drive one full real transaction chain: Sepolia → Attestcoin → Creditcoin.
4. Show the senior tranche balance update before the junior tranche balance, live, on an attested repayment.
5. Show a deliberately bad or expired attestation fail closed, live — balances held at prior state, no funds moved.
6. Run and show passing output from the full INV-1 through INV-6 invariant/fuzz test suite.
7. Explain the full product, including the fail-closed path, in under three minutes.

### Non-goals

- Supporting more than two tranches in the MVP.
- Secondary tranche trading or a tranche-token marketplace.
- Real KYC or investor accreditation.
- A real, uncontrolled, production invoice data source (synthetic/testnet invoice data is disclosed, not hidden).
- Any language implying a registered securities offering.
- Multi-chain source support beyond Ethereum Mainnet/Sepolia (Attestcoin does not support other source chains).
- An automated credit-risk scoring model (the MVP uses one fixed, disclosed rule).
- A governance token, DAO, or protocol-level incentive system.
- Cross-protocol collateral sharing or integration with other Creditcoin lending protocols.

---

## 6. Target Users

### Primary customer: Trade-finance investor (senior-seeking)

A capital allocator — a fund, a treasury, a conservative individual investor — that wants exposure to trade-finance yield but has historically avoided the asset class because flat pooling does not let them size their risk.

**Goals:**

- Get paid first, ahead of junior capital, on any attested repayment.
- See exactly how much attested repayment volume protects their position.
- Avoid being blended into the same risk bucket as risk-seeking capital.

### Primary customer: Trade-finance investor (junior-seeking / yield-seeking)

A risk-tolerant allocator willing to absorb first losses in exchange for a higher return — economically similar to the development-bank first-loss capital role in real-world trade-finance securitization.

**Goals:**

- Receive a clearly higher rate for bearing first-loss risk.
- See transparently how much senior capital they are subordinate to.
- Trust that the waterfall order is enforced in code, not by operator discretion.

### Primary end user: Invoice originator (SME / exporter)

The real-world party whose invoice repayment is the attested event that drives the waterfall. Represented in the MVP as a synthetic/testnet counterpart, disclosed as such.

**Goals:**

- Get the underlying invoice funded.
- Have the repayment event verified without manual paperwork reconciliation.

### Supporting user: Relayer

An untrusted, permissionless party that submits the Attestcoin attestation and triggers the waterfall-allocation call.

**Goals:**

- Detect when an attested repayment event is available.
- Submit it and trigger allocation without gaining any authority over tranche contents.
- Receive a clear explanation when a submission is rejected.

### Supporting user: Auditor or judge

A reviewer who needs to trace the full lifecycle from Sepolia event to Creditcoin tranche update.

**Goals:**

- Verify the real Sepolia repayment transaction.
- Inspect the Attestcoin attestation result.
- Confirm the waterfall allocated senior-first.
- Confirm a bad attestation was rejected with no state change.

---

## 7. Jobs to Be Done

### Senior investor

- When I want trade-finance yield without taking first-loss risk, I want a tranche that is paid before any junior capital, so I can size my exposure conservatively.
- When a repayment is attested, I want to see my balance update first, so I trust the waterfall order is real, not narrated.

### Junior investor

- When I am willing to absorb first-loss risk for a higher return, I want that risk and that return to be explicit and code-enforced, not something I have to trust an operator to honor.

### Relayer

- When a repayment event is ready to attest, I want to submit it and trigger allocation without needing any special permission or key.

### Auditor / judge

- When examining an allocation, I want to trace it back to a specific Sepolia repayment event and confirm the amounts match exactly.
- When examining a rejected attempt, I want to see exactly why it was rejected and confirm no tranche balance changed.

---

## 8. Core Product Model

### 8.1 Invoice

A trade-finance invoice, represented on Ethereum Sepolia via a minimal `InvoiceRegistry` contract. For the hackathon MVP, invoice data is synthetic/testnet (disclosed), but the on-chain events (`InvoiceIssued`, `InvoiceRepaid`) are real transactions, not mocked calls.

### 8.2 Attestcoin evidence

Attestcoin evidence proves that a specific Sepolia `InvoiceRepaid` event occurred and carries the exact repayment amount and a unique attestation identifier.

### 8.3 Tranche

One of exactly two fixed positions in the waterfall: **senior** or **junior**. The tranche count is an immutable constant set at deploy time (INV-5), not a runtime parameter.

### 8.4 Waterfall contract

The Creditcoin CC3 contract that consumes a verified Attestcoin proof and allocates the attested repayment amount to `seniorOutstanding` first, then `juniorOutstanding`, per the invariants in §12.

### 8.5 Attestation ID / replay guard

Each attested repayment event carries a unique attestation identifier. The waterfall contract tracks applied IDs and rejects any repeat application of the same ID (INV-4).

---

## 9. End-to-End Product Flow

### Step 1 — Invoice issued

An `InvoiceRegistry` contract on Ethereum Sepolia emits a real `InvoiceIssued` event for a synthetic/testnet invoice. TrancheTrade displays the invoice, its face value, and its funding status.

### Step 2 — Investors fund tranches

Senior and junior investors deposit into their respective tranche positions for a given invoice pool, up to the hard-capped two-tranche structure.

### Step 3 — Repayment occurs

The `InvoiceRegistry` contract emits a real `InvoiceRepaid` event with the actual repayment amount.

### Step 4 — Attest

A permissionless relayer requests an Attestcoin attestation of the `InvoiceRepaid` event. Attestcoin verifies the Sepolia event and returns a proof carrying the repayment amount and a unique attestation ID.

### Step 5 — Allocate (the core demo moment)

Any relayer submits the Attestcoin proof to the Creditcoin waterfall contract. The contract:

1. Verifies the proof before any state write (checks-effects pattern).
2. Allocates the full attested repayment amount to `seniorOutstanding` first.
3. Allocates any remaining amount to `juniorOutstanding` only once `seniorOutstanding` reaches zero.
4. Marks the attestation ID as applied.

The UI shows the senior balance update first, then the junior balance, in strict visual sequence — not a single combined number ticking up.

### Step 6 — Protect (fail-closed path)

If the Attestcoin proof-verification call reverts, times out, or the proof is invalid or already applied, the contract reverts the entire transaction. Tranche state after a failed call is bit-for-bit identical to its state before the call. An `AttestationFailed(reason)` event is emitted. The UI shows: **"Attestation failed — balances held at prior state, no funds moved."**

---

## 10. Functional Requirements

## Feature 1 — Invoice Registry (Sepolia)

### Purpose

Provide a real, publicly queryable source-chain event for Attestcoin to attest, without requiring a real production invoicing platform in the hackathon window.

### Requirements

- Deploy a minimal `InvoiceRegistry` contract to Ethereum Sepolia.
- Emit a real `InvoiceIssued` event with invoice ID, face value, and issuance time.
- Emit a real `InvoiceRepaid` event with invoice ID and repayment amount.
- Clearly label invoice data as synthetic/testnet in the UI and deck — never presented as a live production counterparty.
- Deploy on Day 1 of the build window and commit the deployment transaction hash to the repository immediately, not near the deadline.

### Acceptance criteria

- The deployment transaction hash is real, verifiable on a Sepolia block explorer, and committed to the repo on Day 1.
- `InvoiceIssued` and `InvoiceRepaid` events are real transactions, not simulated function calls in a test harness only.

---

## Feature 2 — Attestcoin Attestation Request

### Purpose

Turn a real Sepolia repayment event into a verifiable, portable proof usable on Creditcoin.

### Requirements

- Wire the Attestcoin SDK against the `InvoiceRegistry` event schema.
- Submit one real attestation request per repayment event.
- Carry the repayment amount and a unique attestation ID in the returned proof.
- Handle and surface attestation failure/timeout distinctly from a successful-but-pending state.

### Acceptance criteria

- At least one real Attestcoin attestation transaction hash exists and is linked in the deck.
- A failed attestation request is visibly distinguishable in the UI from a pending one.

---

## Feature 3 — Two-Tranche Waterfall Contract (Creditcoin)

### Purpose

Enforce the senior-first, junior-second allocation order in code, not narration.

### Requirements

- Fix tranche count at exactly 2 (senior, junior) as an immutable deploy-time constant (INV-5).
- Allocate any attested repayment to `seniorOutstanding` before `juniorOutstanding` (INV-1).
- Prevent any transaction from decreasing `juniorOutstanding` while `seniorOutstanding > 0` both before and after the senior allocation (INV-2).
- Verify the Attestcoin proof before any state write; revert entirely on failure, leaving state unchanged (INV-3).
- Reject any repeat application of an already-applied attestation ID (INV-4).
- Ensure `seniorAllocation + juniorAllocation` exactly equals the attested repayment amount for every event, with no value created or destroyed (INV-6).

### Acceptance criteria

- All six invariants (INV-1 through INV-6, §12) pass as Foundry property/fuzz tests, with the passing test-suite output captured as a deck asset.
- A full real transaction chain exists: Sepolia repayment → Attestcoin attestation → Creditcoin waterfall update.

---

## Feature 4 — Investor Buy-In UI

### Purpose

Let senior and junior investors deposit into their chosen tranche with a clear understanding of their position.

### Requirements

- Show each tranche's current outstanding balance, historical allocations, and relative seniority.
- Show the fixed two-tranche cap explicitly (no implication that more tranches could be added).
- Show, per investor, which tranche they hold and their current exposure.
- Disclose synthetic/testnet invoice data plainly in the same view.

### Acceptance criteria

- A user can identify which tranche is protected first without reading contract code.
- The two-tranche cap is visible, not just documented separately.

---

## Feature 5 — Live Waterfall Cascade Display

### Purpose

Make the senior-then-junior allocation order visually distinct from a single credit score or balance ticking up.

### Requirements

- On a successful attested repayment, animate or sequence the senior balance update first, then the junior balance update, as two distinct visual beats.
- Link the on-screen update to the real Attestcoin attestation transaction and the real Creditcoin allocation transaction.

### Acceptance criteria

- A judge watching the demo can see two distinct update beats (senior, then junior), not one combined change.
- Both linked transactions are real and independently verifiable.

---

## Feature 6 — Fail-Closed Demonstration Path

### Purpose

Prove the fail-closed invariant (INV-3) live, not just claim it in the deck.

### Requirements

- Provide a scripted path to submit a deliberately bad or expired attestation.
- On failure, display exactly: **"Attestation failed — balances held at prior state, no funds moved."**
- Emit and surface the `AttestationFailed(reason)` event.
- Confirm, in the same view, that both tranche balances are unchanged from their pre-call values.

### Acceptance criteria

- The failure path is a second, distinct demo beat from the successful cascade (Feature 5), not folded into it.
- No spinner, silent retry, or ambiguous state is shown on failure — the rejection is explicit.

---

## Feature 7 — Activity and Audit Trail

### Purpose

Let an auditor or judge trace every allocation and rejection back to its source event.

### Requirements

- Record every attempted allocation (successful and rejected) in chronological order.
- Link each record to its Sepolia transaction, Attestcoin proof, and Creditcoin transaction where applicable.
- Preserve rejected attempts distinctly from successful allocations.

### Acceptance criteria

- An auditor can trace any senior or junior balance change back to a specific Sepolia repayment event.
- An auditor can confirm a rejected attempt produced no state change.

---

## 11. Tranche Lifecycle

| State | Meaning | Allocation possible? |
|---|---|---:|
| Unfunded | Tranche created, no capital deposited | No |
| Funded | Senior and/or junior capital deposited | Awaiting attested event |
| Awaiting attestation | Repayment occurred on Sepolia, attestation pending | No |
| Allocating | Valid proof received, waterfall write in progress | Yes (this transaction) |
| Settled (event) | Repayment amount fully allocated for this event | No (until next event) |
| Rejected (event) | Proof invalid, expired, or already applied | No (state unchanged) |

---

## 12. Trust and Security Model

### Trusted authority

Attestcoin's verified proof of the Sepolia `InvoiceRepaid` event is the sole trusted input driving tranche allocation.

### Untrusted actors

- Relayers submitting attestation proofs.
- The UI hosting environment.
- Any party proposing an allocation transaction.

These actors may transport proofs and trigger allocation but cannot alter tranche contents, order, or caps.

### Security invariants

1. **INV-1 — Waterfall Order.** On any attested repayment event, the contract allocates to `seniorOutstanding` first; a nonzero junior allocation is impossible unless `seniorOutstanding == 0` after that allocation.
2. **INV-2 — No Junior Skip-Ahead.** `juniorOutstanding` cannot decrease in the same transaction where `seniorOutstanding > 0` both before and after senior allocation.
3. **INV-3 — Fail-Closed on Attestation Failure.** A reverted, timed-out, or invalid attestation call writes to neither tranche and leaves state exactly at its pre-call value.
4. **INV-4 — Replay Protection.** Each attestation ID can be applied at most once.
5. **INV-5 — Two-Tranche Cap, Enforced in Code.** The tranche count is an immutable constant fixed at deploy time to exactly 2.
6. **INV-6 — Conservation.** For any single attested repayment event, `seniorAllocation + juniorAllocation` exactly equals the attested repayment amount.

These six invariants are shipped as an actual Foundry property/fuzz test file, not deck prose only — a screenshot of the passing suite is itself a deck asset.

---

## 13. Important Product Limitations

### No real production invoice data source in the hackathon window

The MVP uses synthetic/testnet invoice data on a self-deployed `InvoiceRegistry`. This is disclosed plainly, not hidden, and matches the disclosed-simulation pattern used by the other real-world-asset entries in this hackathon's own submission pool.

### Not a securities offering

TrancheTrade's deck and demo must not use language implying a registered securities offering, a fund, or an investment contract. The tranche-waterfall regulatory framing requires a lawyer's eventual review; this is explicitly out of scope for the hackathon MVP and must be stated as such if asked.

### Credit-risk scoring is a single fixed rule

The MVP does not implement a dynamic credit-risk model. This is disclosed, not presented as a scoring engine.

### The problem is structural, not an averted single incident

The pitch must not claim that TrancheTrade "prevents a crisis" in the sense that an exploit circuit-breaker or a de-peg backstop does. The evidence supports a real, large, chronic access-and-allocation problem — not a single adversarial event stopped live on stage. Overclaiming this would not survive a judge's follow-up question.

---

## 14. Hackathon MVP Scope

### Must ship

- Real `InvoiceRegistry` deployment on Ethereum Sepolia with real `InvoiceIssued`/`InvoiceRepaid` events.
- Real Attestcoin attestation request and proof for at least one repayment event.
- Two-tranche waterfall contract on Creditcoin CC3 with INV-1 through INV-6 enforced in code.
- Investor buy-in UI showing tranche balances and seniority.
- Live waterfall cascade display (senior-then-junior, two distinct beats).
- Fail-closed demonstration path (bad/expired attestation, explicit rejection message).
- Full real transaction chain: Sepolia → Attestcoin → Creditcoin, documented with linked transaction hashes.
- Passing INV-1..INV-6 Foundry/fuzz test-suite output captured as a deck asset.
- Activity/audit trail linking every allocation and rejection to its source event.
- Public judge verification instructions (transaction links, contract addresses).

### Should ship after the core path works

- A second synthetic invoice/repayment cycle to show the waterfall handling more than one event.
- A simple dashboard summarizing total senior/junior capital and historical allocations.
- A written pre-empt answer to "why not Solana / why Sepolia" for the pitch Q&A.

### Do not build for the hackathon

- More than two tranches.
- Secondary tranche-token trading or a marketplace.
- Real KYC or investor accreditation.
- A real production invoicing/factoring platform integration.
- Multi-chain source support.
- A dynamic/automated credit-scoring model.
- Any governance token or DAO layer.

---

## 15. Demo Requirements

The demo must begin with a real Sepolia repayment event and end with a live, on-chain Creditcoin tranche-balance update — plus one deliberate failure.

### Three-minute demo sequence

1. Show the two funded tranches (senior, junior) and their current balances.
2. Trigger (or replay a prepared) real `InvoiceRepaid` event on Sepolia.
3. Show the Attestcoin attestation request and resulting proof.
4. Submit the proof to the Creditcoin waterfall contract.
5. Show the senior balance update first, then the junior balance update — two distinct visual beats.
6. Submit a deliberately bad/expired attestation.
7. Show the explicit rejection: "Attestation failed — balances held at prior state, no funds moved."
8. Close on the activity/audit trail, showing every linked transaction hash across all three chains/protocols.

### Demo preparation

- Prepare at least one source Sepolia transaction whose Attestcoin attestation is already available before the presentation, so the live demo does not depend on new attestation latency during judging.
- Use the same deployed contracts and code paths shown in the public repository and test suite — no separate "demo-only" shortcut path.
- Provide transaction links for every stage, ready to open live if a judge asks.

### Mandatory judge moments

#### Success

> **Senior updates first. Then junior. Exactly as attested.**

#### Fail-closed

> **Attestation failed — balances held at prior state. No funds moved.**

#### Replay protection

> **The same attestation cannot be applied twice.**

---

## 16. Adversarial Test Requirements

The project should demonstrate at least the following cases:

1. A valid attested repayment allocates fully to the senior tranche when senior outstanding exceeds the repayment amount.
2. A valid attested repayment that exceeds senior outstanding allocates the remainder to junior, in the same transaction, in strict order.
3. A second, independent valid attested repayment allocates correctly against the updated tranche state.
4. An invalid Attestcoin proof is rejected; no tranche balance changes.
5. An expired Attestcoin proof is rejected; no tranche balance changes.
6. A timed-out attestation call reverts the entire transaction; no partial write occurs.
7. A replayed (already-applied) attestation ID is rejected.
8. An attempt to allocate to junior before senior is exhausted is rejected.
9. A fuzzed set of random repayment amounts and pre-states always satisfies conservation (INV-6).
10. An attempt to configure a third tranche at runtime is rejected/impossible (tranche count is immutable).
11. Reentrancy cannot cause a single attestation to be applied more than once.

Test quality matters more than an arbitrary test count. Every test protects a specific named invariant (§12) or a specific demo path (§15).

---

## 17. Success Metrics

### Hackathon success

- One real Sepolia repayment event, attested through Attestcoin, drives one real Creditcoin waterfall update.
- Senior tranche visibly updates before junior tranche on stage.
- A bad/expired attestation is rejected live with no funds moved.
- The full INV-1..INV-6 test suite passes and is shown as a deck asset.
- Judges understand the waterfall mechanism and the fail-closed guarantee within three minutes.

### Product validation metrics

- Number of attested repayment events processed.
- Total senior and junior capital funded.
- Number of rejected (invalid/replayed/expired) attestation attempts correctly blocked.
- Median time from Sepolia repayment event to settled Creditcoin allocation.
- Percentage of allocations completed without manual intervention.

### North-star metric

> **Value of trade-finance capital safely and correctly stratified by attested, on-chain repayment events.**

---

## 18. Business Model

TrancheTrade is infrastructure for trade-finance capital allocation, not a consumer trading app.

### Potential revenue streams

- A small fee on each attested-repayment allocation event.
- A tranche-structuring fee charged to invoice originators or pool arrangers.
- An institutional integration fee for protocols or funds that want to offer tranched exposure to their own attested asset flows.
- Premium reporting/audit exports for institutional junior/senior investors.

### Potential customers

- Trade-finance pools and factoring platforms building on Creditcoin.
- Development-bank-style or multilateral first-loss capital providers seeking on-chain, attested first-loss positions.
- Institutional treasuries seeking senior, protected trade-finance exposure.
- RWA issuers who want a proven risk-stratification layer rather than building one from scratch.

### Long-term position

> **The default risk-stratification layer for attested, on-chain trade-finance and RWA cash flows on Creditcoin.**

---

## 19. Go-to-Market Thesis

### Initial wedge

Target one real or credible-pilot invoice-financing flow on Creditcoin and demonstrate that tranching — not a flat rate — is what actually widens the investor base for it, mirroring the real-world securitization pattern already documented in trade finance.

### Initial offer

One integration package: a tranche-waterfall contract, an Attestcoin attestation wiring guide, and the six named invariants as a reusable test suite for any team building attested repayment-driven products on Creditcoin.

### Adoption strategy

1. Ship the hackathon MVP with one synthetic invoice flow, fully attested and tranched end to end.
2. Publish the invariant test suite and integration guide.
3. Pursue one real or credible-pilot trade-finance/factoring counterpart post-hackathon.
4. Expand tranche templates (e.g., three-tier structures) only after the two-tranche flow is proven and audited.
5. Offer the waterfall pattern as reusable infrastructure to other Creditcoin RWA/credit protocols.

### Credibility milestone

The most valuable post-hackathon evidence is not a larger number of synthetic invoices. It is one real invoice-financing counterpart routing an actual repayment event through this same attested waterfall.

---

## 20. Competitive Positioning

| Alternative (live in this hackathon's field) | What it provides | TrancheTrade difference |
|---|---|---|
| FactorX | Flat soulbound cashflow-passport credit score from an attested event | Same attested-event input, but allocates through a risk-stratified waterfall instead of one blended score |
| LoomCredit | Flat approve/refer/reject credit decision from a bounded AI proposal | Same category of attested decision input, but TrancheTrade's output is a tranche allocation, not a single accept/reject line |
| Collateral Eligibility Ledger | Narrow RWA eligibility check | Different mechanism entirely — no price-threshold or liquidation trigger; low collision, addresses a different question (eligibility, not risk-tiering) |
| VaultBridge | Dual-attestation privacy + soulbound milestones | Different mechanism and different investor-facing structure; no tranche/waterfall element |

The defensible originality claim, independently verified across three live-field searches (roughly 90 checked submissions, ~81% field coverage as of 2026-09-04):

> **TrancheTrade is the only submission in the live field, and the only candidate this team evaluated, that allocates an attested repayment event through a hard-capped, code-enforced senior/junior waterfall rather than a single blended score or decision.**

Do not claim that tranching itself, or risk-stratified structured credit, is a novel invention — it is a well-established real-world pattern (BarnBridge, Saffron, and traditional trade-finance securitization all use senior/junior structures). The originality claim is specifically about applying that established pattern to an Attestcoin-attested, on-chain trade-finance repayment event within this ecosystem — not about inventing tranching itself.

### A note on adjacent structures, disclosed plainly

Senior/junior tranche-token structures have drawn regulatory scrutiny in other contexts (for example, a 2023 SEC enforcement action against a DeFi protocol using an unregistered senior/junior yield-token structure). TrancheTrade's MVP scope deliberately avoids the specific features that heightened that risk: no secondary tranche-token trading, no marketing of guaranteed or insured returns, and no language framing this as an investment product or securities offering. This limitation is recorded here so it is never dropped silently under demo-week pressure.

---

## 21. Key Product Risks

### Risk 1 — Perceived as "just another attest-then-score" wrapper

Judges familiar with this hackathon's dominant pattern (13 of the originally sampled 24 submissions attest an event and unlock/score a single line) may initially pattern-match TrancheTrade to that shape.

**Mitigation:** Foreground the two-beat waterfall cascade visually in the first 30 seconds of the demo — never lead with "we also attest invoices."

### Risk 2 — Regulatory perception of a tranche-token structure

Senior/junior structures can resemble regulated securities products if marketed carelessly.

**Mitigation:** No language implying a securities offering, no secondary tranche trading, no guaranteed-return claims; explicitly disclose this as an open item requiring legal review post-hackathon (§13).

### Risk 3 — No real production invoice data source

**Mitigation:** Disclose synthetic/testnet invoice data plainly; anchor credibility instead in the real Sepolia transaction, real Attestcoin attestation, and real Creditcoin allocation transactions that ARE genuine, not simulated.

### Risk 4 — Documentation/rigor bar in the live field is high

Several live competitors show named security invariants, fail-closed logic, and real transaction hashes as baseline evidence.

**Mitigation:** Ship INV-1 through INV-6 as an actual, passing Foundry test suite (not deck prose), and script the fail-closed failure path as a live demo beat, matching the field's evidentiary bar directly.

### Risk 5 — Execution risk on the 3-hop real transaction chain

Assembling Sepolia → Attestcoin → Creditcoin as one live, working chain carries integration risk under time pressure.

**Mitigation:** Anchor the Sepolia deployment on Day 1 (not demo week), treat the 3-hop integration as a dedicated, whole-team integration milestone (not a late handoff), and prepare a pre-attested fallback transaction for the live demo.

### Risk 6 — Unverified portion of the live competitive field

Roughly one-fifth of the live submission field could not be independently verified due to platform access limitations as of the last check.

**Mitigation:** Run a continuous, team-owned manual spot-check of the unverified field throughout the build window, not only immediately before submission.

---

## 22. Open Product Decisions

1. **Fixed tranche split or investor-adjustable?**
   Recommendation: fixed split for the hackathon MVP (e.g., a disclosed senior/junior sizing rule); investor-adjustable sizing is a post-hackathon feature.

2. **Who pays the attestation/allocation transaction fee?**
   Recommendation: permissionless relayer for the MVP; a sponsored-relay service is a later offering.

3. **Can a single invoice pool support more than one repayment event?**
   Recommendation: yes — the waterfall must correctly handle multiple sequential attested events against evolving tranche balances; this is required for the MVP, not deferred.

4. **Should the fail-closed demo use a real expired attestation or a deliberately malformed one?**
   Recommendation: use a deliberately malformed/invalid proof for reliability in a live demo setting, while documenting that a genuinely expired attestation follows the identical code path.

5. **What is the disclosed credit-risk rule for the MVP?**
   Recommendation: a single fixed rule (e.g., a flat assumed default probability), stated plainly as a simplification, not a scoring engine.

---

## 23. Roadmap

### Phase 1 — Hackathon proof

- Ethereum Sepolia `InvoiceRegistry`.
- Creditcoin CC3 two-tranche waterfall contract.
- Full 3-hop real transaction chain.
- INV-1 through INV-6 as a passing Foundry/fuzz suite.
- Live waterfall cascade + fail-closed demo beats.

### Phase 2 — Real-flow pilot

- One real or credible-pilot invoice-financing counterpart.
- Reusable invariant test suite published for other Creditcoin builders.
- Basic reporting/audit export for institutional senior/junior investors.

### Phase 3 — Structural expansion

- Legal review of the tranche-waterfall regulatory framing.
- Additional tranche templates (e.g., three-tier structures), only after the two-tranche flow is audited.
- Investor-adjustable tranche sizing.

### Phase 4 — Ecosystem infrastructure

- Waterfall pattern offered as reusable infrastructure to other Creditcoin RWA/credit protocols.
- Additional attested asset classes beyond trade-finance invoices.
- Institutional-grade reporting and compliance exports.

---

## 24. Final MVP Definition

TrancheTrade v1 is:

> A Creditcoin execution layer where a real, Attestcoin-attested Ethereum Sepolia invoice-repayment event drives a hard-capped, two-tranche waterfall allocation — senior protected first, junior second — with fail-closed behavior on any invalid or replayed attestation.

The MVP is complete only when all six outcomes are demonstrated:

1. A real Sepolia `InvoiceRepaid` event is attested through Attestcoin.
2. The Creditcoin waterfall contract allocates the attested amount to senior before junior.
3. A second attested event correctly updates tranche state against prior balances.
4. A deliberately bad/expired attestation is rejected and moves no funds.
5. A replayed attestation ID cannot be applied twice.
6. The full INV-1..INV-6 test suite passes and is shown as evidence.

Everything else is secondary.

---

## 25. Final Pitch Narrative

An exporter's invoice gets funded through a Creditcoin trade-finance pool. Today, every investor in that pool — cautious or risk-seeking — receives the same blended rate. That is exactly the structure the real trade-finance industry has already identified as a reason $2.5 trillion a year in financing demand goes unmet, disproportionately shutting out SMEs, who get rejected for trade finance at roughly double the rate of large corporations.

TrancheTrade attests the invoice's repayment event through Attestcoin, then allocates it through a hard-capped, code-enforced waterfall: senior investors protected first, junior investors absorbing first-loss risk for a higher return — the same structure development banks already use in real-world trade-finance securitization to bring conservative capital into an asset class it would otherwise avoid.

The repayment lands. The senior balance updates first, live. Then the junior balance updates, strictly after.

Then we feed it a bad attestation. The contract fails closed — no partial write, no silent skip. Balances stay exactly where they were. No funds move.

Every other attested-event product in this field gives you one number. TrancheTrade gives you a waterfall — verified, ordered, and provably safe to fail.

> **TrancheTrade: one attested repayment, a waterfall, not a flat rate.**
