# 04 — Frontend Engineer (Next.js)

**Project:** TrancheTrade — attestation-gated, risk-stratified trade-finance settlement layer
**Source of truth:** `docs/TrancheTrade_PRD.md` (v1.0). Read §10 Features 4–7, §11, §13, §14, §15, §20.
**Design reference:** `docs/code.html` and `docs/screen.png`. The complete inventory is in
**Appendix A** of this file — you do not need to re-derive anything from the reference.
**Deadline:** 2026-09-13 23:59 ET.
**You own:** `/web/**`.

You do not need to read any other handoff file. Everything you need is here.

---

## Why this role carries the demo

PRD Risk 1 states that judges familiar with this hackathon's dominant "attest-then-score" pattern
will pattern-match TrancheTrade to it, and that the mitigation is to "foreground the two-beat
waterfall cascade visually in the first 30 seconds of the demo."

That mitigation is your interface. The contracts prove the waterfall is correct; your screen is the
only place a judge can *see* that it is a waterfall and not a number ticking up. Two features in
particular are load-bearing and are graded on exact behaviour:

- **Feature 5** — senior updates, then junior, as **two distinct visual beats**, never one combined
  number.
- **Feature 6** — an explicit fail-closed rejection carrying the exact string
  `Attestation failed — balances held at prior state, no funds moved.`

---

## Responsibilities

- Build the TrancheTrade interface as a Next.js App Router application on the design system in
  Appendix A.
- Ship PRD Features 4, 5, 6, and 7: investor buy-in, live waterfall cascade, fail-closed rejection,
  and the activity/audit trail.
- Read tranche state and allocation history **directly from Creditcoin CC3**, with no backend and no
  database between the chain and the screen.
- Render the design system's missing states — loading, empty, pending, rejected — in the reference's
  own visual language.

---

## Scope

### In scope

- `/web/**` — the entire Next.js application, its config, its styles, its components.
- Reading `docs/evidence/deployments.json`, `docs/evidence/abi/*.json`, and
  `docs/evidence/transactions.json` at build or request time.
- Wallet connection and the on-chain deposit transaction.
- All user-facing copy in the application.

### Out of scope

- **Every `.sol` file.** The Contracts Engineer owns all Solidity. If you need a new view function,
  request it through the PM; do not work around a missing one with a multi-call hack that will be
  slower than asking.
- `/contracts/**`, `/relayer/**`.
- `docs/evidence/**` — you read these files; you never write them. In particular
  `docs/evidence/transactions.json` is written by the Integration Engineer and its schema is a
  contract between you (see R-5). Changes go through the PM.
- Any backend, API server, database, or ORM. See Constraints.
- The pitch deck.

---

## Objectives

1. A judge watching the demo sees **two distinct update beats** — senior, then junior — and could
   not mistake it for a single combined change. This survives `prefers-reduced-motion`.
2. The fail-closed rejection is unmistakable, carries the exact mandated string, and shows both
   balances unchanged with real before/after values in the same view.
3. Every number on screen traces to a transaction hash a judge can open.
4. The interface looks like it belongs to the reference in Appendix A — editorial, hairline, warm
   off-white, two type scales — and not like a generic dashboard.
5. Nothing in the interface implies a securities offering, a guaranteed return, or a scoring engine.

---

## Requirements

### R-1 — Stack

- Next.js 15+, App Router, TypeScript strict.
- Tailwind CSS v4 (or v3 with the config in Appendix A §1 — v3 matches the reference exactly and is
  the lower-risk choice for nine days; if you use v4, port the tokens to `@theme` and keep the
  identical values).
- `viem` for chain reads; `wagmi` for wallet connection and the deposit write.
- No UI component library. The design system in Appendix A is small and specific; a component
  library would fight it on every surface and cost more than it saves.

**Pre-approved dependencies, nothing else without PM approval:** `next`, `react`, `react-dom`,
`typescript`, `tailwindcss`, `viem`, `wagmi`, `@tanstack/react-query` (required by wagmi), and the
matching `@types/*`.

`tsconfig.json` must set `"strict": true` and `"noUncheckedIndexedAccess": true`.

### R-2 — Rendering architecture

**Server Components are the default.** `use client` goes on the leaf that needs interactivity,
never on a layout and never on a page to make one button work. Concretely:

| Component | Kind | Why |
|---|---|---|
| `app/layout.tsx`, `app/page.tsx`, `app/activity/page.tsx` | Server | They fetch chain state and render structure |
| `TranchePanel` (static render of balances) | Server | Pure display |
| `CascadeController` | Client | Polls for new allocations, drives the two beats |
| `DepositForm` | Client | Wallet, form state |
| `WalletButton` | Client | Wallet |
| `HashLink`, `AuditTable`, `StatusSticker` | Server | Pure display |

The cascade's *animated* numerals live inside `CascadeController`; the server-rendered
`TranchePanel` provides the initial values so the page is correct with JavaScript disabled.

### R-3 — Reading the chain

Read Creditcoin CC3 directly. There is no API layer and no database, and that is a product decision:
PRD §10 Feature 7 requires an auditor to trace every number to a transaction, and an intermediary
would weaken that claim. It is also why PRD §12 can list the UI hosting environment as untrusted.

```
chain:      Creditcoin CC3 testnet
chainId:    102031
rpc:        https://rpc.cc3-testnet.creditcoin.network
explorer:   https://creditcoin-testnet.blockscout.com
symbol:     tCTC
block time: 15s, finality 1–3 blocks
```

Sepolia, for source links only: chainId `11155111`, explorer `https://sepolia.etherscan.io`.

Contract addresses and ABIs come from `docs/evidence/deployments.json` and
`docs/evidence/abi/*.json`. Import them; never hardcode an address in a component.

Server reads use a `viem` public client with `http(...)`. Cache with `revalidate` no longer than
15 seconds (one CC3 block) on the pool view, and use `cache: 'no-store'` on anything the cascade
depends on.

**Live updates.** Poll every 4 seconds from `CascadeController` using a browser-side `viem` public
client against the CC3 RPC, comparing the latest `RepaymentAllocated` log against the last one
rendered.

If the public CC3 RPC does not send permissive CORS headers to a browser, fall back to a single
Next.js Route Handler at `app/api/pool/route.ts` that performs the same read server-side and returns
JSON. That fallback is permitted **only** for this CORS reason, must contain no business logic, and
must be documented in `/web/README.md` with the CORS response that forced it. Test CORS on Day 1 of
your work so you know which path you are on before you build the cascade.

### R-4 — Contract surface you consume

```solidity
function snapshot() external view returns (
    uint256 seniorOutstanding,
    uint256 juniorOutstanding,
    uint256 seniorPrincipal,
    uint256 juniorPrincipal,
    uint256 seniorAllocatedTotal,
    uint256 juniorAllocatedTotal,
    uint256 seniorCap,
    uint256 juniorCap
);
function positionOf(address investor) external view returns (uint256 senior, uint256 junior);
function trancheCount() external pure returns (uint256);
function deposit(Tranche tranche) external payable;

enum Tranche { Senior, Junior }

event Deposited(address indexed investor, Tranche indexed tranche, uint256 principal, uint256 entitlement);
event SeniorAllocated(bytes32 indexed attestationId, uint256 amount, uint256 seniorOutstandingAfter);
event JuniorAllocated(bytes32 indexed attestationId, uint256 amount, uint256 juniorOutstandingAfter);
event RepaymentAllocated(bytes32 indexed attestationId, uint256 indexed invoiceId, uint256 attestedAmount, uint256 seniorAllocation, uint256 juniorAllocation);

error AttestationFailed(bytes32 attestationId, uint8 reason);

uint256 public constant SENIOR_RATE_BPS = 10600;
uint256 public constant JUNIOR_RATE_BPS = 11800;
```

`RejectionReason` ordinals: `0 InvalidProof`, `1 ExpiredProof`, `2 StaleProof`, `3 AlreadyApplied`,
`4 AmountZero`, `5 ExceedsOutstanding`.

`SeniorAllocated` is always emitted at a strictly lower log index than `JuniorAllocated`, and both
are emitted even when the junior allocation is zero. **Derive the two beats from this event
ordering.** Do not synthesise beats from a balance diff; the ordering is the on-chain fact and using
it is what makes the animation an honest depiction rather than a decoration.

All monetary values are 18-decimal `bigint`. Never convert to `Number` before formatting; use
`viem`'s `formatUnits` and format the resulting string. A precision error here puts a wrong figure
on screen during judging.

### R-5 — `docs/evidence/transactions.json`

Written by the Integration Engineer. This schema is a contract between the two of you; neither may
change it unilaterally. It supplies the cross-chain links that CC3 alone cannot give you — the
Sepolia source transaction and the attestation metadata.

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

- `kind` is `"allocation"` or `"rejection"`; exactly one of `allocation` / `rejection` is non-null.
- `attestation.status` is `"pending" | "attested" | "failed" | "corrupted"`. **You must render
  `"pending"` and `"failed"` as visibly different states** — PRD Feature 2's acceptance criterion is
  precisely that a failed attestation is distinguishable from a pending one.
- `rejection.reason` is `InvalidProof | ExpiredProof | StaleProof | AlreadyApplied | AmountZero |
  ExceedsOutstanding`.
- All monetary values are decimal strings. Parse with `BigInt(...)`, never `Number(...)`.
- The manifest deliberately does **not** carry the user-facing rejection sentence. **You own that
  string as a constant in your codebase**, so that a typo in generated JSON can never corrupt a
  string the PRD mandates verbatim.

Build the whole interface against a committed fixture copy of this shape from day one. Do not block
on the real file arriving.

### R-6 — Routes

```
/                     Pool view: hero, two tranche panels, deposit, cascade, rejection beat
/activity             Full audit trail
/activity/[cycleId]   One cycle traced across all three hops
```

Three routes. Not more. A three-minute demo cannot visit a fourth.

### R-7 — Feature 4: Investor buy-in (PRD §10 Feature 4)

Requirements from the PRD, each of which must be visible on `/`:

- Each tranche's current outstanding balance, its historical allocated total, and its **relative
  seniority**.
- The fixed two-tranche cap, shown explicitly, with no implication that more tranches could be added.
- Per investor: which tranche they hold and their current exposure.
- Plain disclosure that invoice data is synthetic/testnet, **in the same view**.

Design direction:

- Two panels, ordered senior above/before junior in both DOM and visual order. Senior carries a
  **2px** top rule and the serif ordinal `I`; junior carries a **1px** top rule and the ordinal `II`.
  Seniority is expressed through rule weight, ordinal, and order — **not through colour**. The
  reference has no semantic colour and colour-coding risk as red/green is both off-idiom and
  inaccessible to colour-blind viewers.
- A single line under the pair, in the reference's utility type:
  `TRANCHE STRUCTURE — 2 OF 2 · FIXED AT DEPLOYMENT · IMMUTABLE`. Read `trancheCount()` from the
  chain rather than hardcoding `2`, so the claim is sourced.
- Deposit form: a tranche choice (segmented text toggle, Appendix A §7.2), an amount input
  (underline input, Appendix A §8.2), and a primary button. Show the resulting entitlement live:
  `You deposit 10,000 tCTC · Your entitlement 10,600 tCTC (senior, 1.06×)`.
- Next to the rate, a plain sentence, always visible: `A single fixed disclosed rule. Not a credit
  score and not a risk model.` PRD §13 and §22.5 require this framing.
- The synthetic-data disclosure uses the **rotated status sticker** from the reference (Appendix A
  §7.5) — the reference's own "Ausstellung bereits beendet" component, reused for
  `Testnet — synthetic invoice data`. It sits in the header, in the same position as the reference's.

**Wallet and deposit.** Connect via wagmi's injected connector; if the connected chain is not
`102031`, show a switch-chain prompt rather than a disabled button with no explanation.

**Fallback if wallet integration slips:** tranches can be pre-funded by the relayer, and the deposit
form then renders in its disabled state (Appendix A §9.5) with the honest label
`Deposits are executed from the relayer in this build`. Take this fallback only with PM approval,
and only after Day 7. It costs a Must-ship item; do not reach for it early.

### R-8 — Feature 5: the live waterfall cascade (PRD §10 Feature 5)

This is the most important 2.1 seconds in the project.

**Trigger.** A new `RepaymentAllocated` log appears for an `attestationId` not yet rendered.

**Choreography — full motion:**

| Time | Beat | What happens |
|---|---|---|
| 0 ms | — | The `attestationId` and the attested amount appear above the panels, with a link to the CC3 transaction |
| 0–900 ms | **Beat 1 — Senior** | The senior panel's top rule sweeps left→right; its outstanding figure counts from before to after in tabular numerals; the allocated-total figure counts up. The junior panel is visually **inert** — no movement of any kind. |
| 900–1200 ms | **The hold** | 300 ms of complete stillness. Nothing animates. This silence is what makes it two beats rather than one; do not fill it. |
| 1200–2100 ms | **Beat 2 — Junior** | The junior panel's top rule sweeps; its figures count. The senior panel is now inert. |
| 2100 ms | — | The cycle is appended to the activity trail with its three hash links |

Constraints on the animation:

- The two panels must **never** animate simultaneously. If a reviewer pauses the recording at any
  frame between 0 and 2100 ms, at most one panel is in motion.
- Numerals are tabular (`font-variant-numeric: tabular-nums`) so digits do not reflow mid-count.
  A reflowing counter reads as noise and destroys the beat.
- When `juniorAllocation == 0`, Beat 2 still runs: the junior rule still sweeps and the junior
  figure still resolves — to the same value. The beat that shows *nothing moved* is the strongest
  possible demonstration of the waterfall's order, and the PRD requires two beats, not
  "two beats when both are nonzero."
- Use CSS transitions and `requestAnimationFrame`. Do not add an animation library.

**`prefers-reduced-motion: reduce` — the two beats must survive:**

- No sweep, no counting. Values change instantly.
- Beat 1 at 0 ms: the senior figure updates and a status line reads `Senior allocated 25,000.00 tCTC`.
- 700 ms of stillness.
- Beat 2 at 700 ms: the junior figure updates and a status line reads
  `Junior allocated 0.00 tCTC — senior not yet exhausted`.
- Announce both through a single `aria-live="polite"` region, sequentially. A screen-reader user
  and a reduced-motion user both perceive two ordered events. **The meaning must survive the removal
  of the motion** — this is the test of whether the animation was decoration or information.

**Linking.** The cascade shows the CC3 allocation transaction link immediately, and the Sepolia
source and attestation links as soon as they are available from the manifest. PRD Feature 5's second
acceptance criterion requires both linked transactions to be real and independently verifiable.

### R-9 — Feature 6: the fail-closed rejection beat (PRD §10 Feature 6)

A **second, distinct demo beat**, never folded into the cascade. It occupies the same region of the
page the cascade does, replacing it.

The exact string, which appears verbatim and is not paraphrased, abbreviated, or wrapped in other
words:

```
Attestation failed — balances held at prior state, no funds moved.
```

The dash is an em dash (U+2014) with a single space either side. Define it once:

```typescript
export const REJECTION_MESSAGE =
  'Attestation failed — balances held at prior state, no funds moved.';
```

Compose the beat with everything below, in this order (full spec with values in Appendix A §9.4):

1. Eyebrow: `REJECTED` — 11px, uppercase, `tracking-[0.08em]`, `khmAlert`.
2. The exact message, 15px sans, `khmDark`.
3. The machine reason and the decoded error, in utility type:
   `AttestationFailed(0x8f3a…21c4, InvalidProof)`.
4. **An unchanged-balances proof, with real values from the manifest's `rejection` object:**

   ```
   SENIOR OUTSTANDING    49,200.00  →  49,200.00      unchanged
   JUNIOR OUTSTANDING    35,400.00  →  35,400.00      unchanged
   ```

   Both before and after values are rendered. The word `unchanged` is rendered. This is PRD Feature
   6's requirement to "confirm, in the same view, that both tranche balances are unchanged from
   their pre-call values."
5. A link to the **reverted** CC3 transaction, labelled so it is clear the transaction is real and
   reverted: `Reverted transaction on Creditcoin CC3 ↗`.

Hard prohibitions, from PRD Feature 6's acceptance criterion — "no spinner, silent retry, or
ambiguous state is shown on failure; the rejection is explicit":

- No spinner, anywhere in this beat, at any time.
- No automatic retry and no "retrying…" copy.
- No toast, no transient notification. The beat is persistent until the operator moves on.
- No generic red error banner. It is the reference's own visual language: warm ground, hairline
  border, one oxblood accent (Appendix A §9.4).
- The senior and junior panels do not animate during this beat. They are inert, and that is the
  point.

**A replay rejection** (`reason: "AlreadyApplied"`) uses the identical component and adds the
supporting line `This attestation was already applied.` PRD §15 lists "The same attestation cannot
be applied twice" as a mandatory judge moment.

### R-10 — Feature 7: activity and audit trail (PRD §10 Feature 7)

`/activity` renders every cycle from the manifest, plus every `RepaymentAllocated` read live from
CC3, in chronological order — **successful allocations and rejections together, visually distinct.**

Table columns (component spec in Appendix A §8.1):

| When | Cycle | Invoice | Attested | Senior | Junior | Result | Sepolia | Attestation | Creditcoin |
|---|---|---|---|---|---|---|---|---|---|

- Rejections show `—` in the Senior and Junior columns, never `0`. `0` reads as "allocated nothing";
  `—` reads as "did not allocate". The distinction is the whole point of the column.
- The `Result` column shows `ALLOCATED` (`khmPositive`) or `REJECTED · <Reason>` (`khmAlert`), in
  11px uppercase utility type.
- Every hash cell is a middle-truncated link (`0x8f3a…21c4`) to the correct explorer for its chain.
  Do not render a Sepolia hash against the Creditcoin explorer; the two chains are different columns
  and different hosts, and getting this wrong in front of a judge is fatal to the audit claim.
- `/activity/[cycleId]` shows one cycle traced across all three hops vertically, with the amount
  shown at each hop so a reader can confirm the Sepolia amount and the Creditcoin `attestedAmount`
  are the same number. PRD Feature 7's acceptance criterion is that "an auditor can trace any senior
  or junior balance change back to a specific Sepolia repayment event" — this page is that trace.

### R-11 — Copy constraints (PRD §13, §20, §21)

Every word on screen is subject to these. They are product constraints, not tone preferences.

- Never imply a registered securities offering, a fund, an investment contract, or a guaranteed or
  insured return. No "guaranteed", "insured", "protected returns", "APY", "yield product".
  "Senior investors are paid first" is accurate; "senior returns are protected" is not.
- Never call the fixed 1.06×/1.18× rule a score, a rating, a model, or an engine.
- Never claim TrancheTrade prevents a crisis (PRD §3.5).
- Never claim tranching is novel. If the interface says anything about originality, it is the narrow
  claim: applying an established senior/junior waterfall to an Attestcoin-attested on-chain
  trade-finance repayment event.
- Always disclose synthetic/testnet invoice data in the same view as the invoice data.
- Allocation is an accounting entitlement against an attested repayment, not a transfer of repayment
  cash. Do not write "funds received", "paid out", or "withdraw" anywhere. The one exception is the
  PRD-mandated rejection string, which contains "no funds moved" and is used verbatim because the
  PRD mandates it.

---

## Dependencies

| You need | From | When |
|---|---|---|
| `docs/evidence/abi/TrancheWaterfall.json` | Contracts Engineer | End of Day 2 — you start when this lands |
| `docs/evidence/deployments.json` with CC3 addresses | Contracts Engineer | End of Day 3 |
| `docs/evidence/transactions.json`, first real cycle | Integration Engineer | Day 5 |
| Full manifest: 2 allocations + malformed rejection + replay rejection | Integration Engineer | End of Day 7 |

Build against a committed fixture manifest of the R-5 shape from your first hour. **Never block on
chain work.** By the time the real addresses land, the entire interface should already work against
fixtures, and switching should be a config change.

---

## Constraints

### Standing rules

- **English everywhere.** Identifiers, strings, docs, commit messages, and all UI copy.
- **No comments in code.** Not block, not single-line, not JSDoc. Name components, props, and
  variables so the comment is unnecessary. The sole exception is scaffolding the user has explicitly
  framed as temporary, which gets exactly one line:
  `// TEMPORARY — <what it is>; delete with <what to remove>`.
- **TypeScript stays strict.** No `any`, no `@ts-ignore`, no non-null assertion used to silence a
  genuinely nullable value.
- **No new dependency without asking.** Only the R-1 list is pre-approved. In particular: no UI kit,
  no animation library, no chart library, no icon package — the reference uses inline SVG at
  `stroke-width: 1.5`, and you should too.
- **Server Components are the default.** `use client` on leaves only, never on a layout or a page.
- **Every animation respects `prefers-reduced-motion`,** and the animation's *meaning* must survive
  its removal. R-8 specifies exactly how for the cascade.
- **Never read, write, or echo `.env*` files or secrets.** The only configuration you need is public:
  RPC URLs and contract addresses. There is no secret in this application. If you find yourself
  wanting one, stop and report it.
- **Never run `git commit`, `git push`, or any destructive git command unless the user asks.** Never
  `git add -A` or `git add .` — stage explicit paths.
- **Never fabricate a transaction hash, address, or balance,** including in fixtures used for
  screenshots. Fixture data must be visibly labelled as fixture data. A fabricated hash on a judge's
  screen is a disqualifying failure.

### Architectural constraints

- No backend, no API server, no database, no ORM, no auth. The single permitted Route Handler is the
  CORS fallback in R-3, which contains no logic.
- No global state manager. wagmi's provider plus React state is sufficient for three routes.
- All monetary values are `bigint` end to end; format only at the render boundary.
- No `dangerouslySetInnerHTML`.
- Images: the reference's artwork is a remote Google-hosted asset. Do not depend on it — TrancheTrade
  has no artwork requirement. If you use any image, it is local and in `/web/public`.

### Accessibility

- Every interactive element has a visible `:focus-visible` style. The reference defines none
  (Appendix A §9.1 records this as a gap); Appendix A §9.2 specifies the extension. Implement it.
- The cascade announces both beats through one `aria-live="polite"` region, sequentially.
- The rejection beat is `role="status"`, not `role="alert"` — it is a deliberate, expected outcome
  being demonstrated, not an interruption.
- Colour is never the sole carrier of meaning. Seniority is rule weight, ordinal, and order.
  Allocation versus rejection carries a text label, not just a hue.
- Target contrast: 4.5:1 for body text against `#f6f4ee`. `khmGray #767676` on `khmBg #f6f4ee`
  measures approximately 4.6:1 and is acceptable for body text; do not go lighter.

---

## Deliverables

1. `/web` — a Next.js App Router application that builds clean with `next build` and passes
   `tsc --noEmit` under `strict`.
2. Tailwind configuration carrying every token in Appendix A §1 and §2, with the extended tokens
   from Appendix A §11 clearly separated in the config.
3. Route `/` implementing PRD Features 4, 5, and 6.
4. Route `/activity` and `/activity/[cycleId]` implementing PRD Feature 7.
5. `CascadeController` implementing R-8, including the reduced-motion path.
6. `RejectionBeat` implementing R-9, including the `REJECTION_MESSAGE` constant.
7. Committed fixture manifest at `/web/fixtures/transactions.fixture.json` for offline development,
   visibly labelled as fixture data in any UI that renders it.
8. `/web/README.md` — install, dev, build, which environment variables are read (names only), and
   whether the CORS fallback was needed and why.
9. A short note to the PM listing anything in Appendix A you deviated from and why.

---

## Acceptance criteria

**Feature 5 — the two beats**

- [ ] On a successful allocation, the senior figure changes and completes its change **before** the
      junior figure begins to change. Verifiable by recording the screen and stepping frames.
- [ ] At no frame between 0 and 2100 ms are both panels animating.
- [ ] A 300 ms interval exists in which neither panel is animating and no other element moves.
- [ ] When `juniorAllocation == 0`, Beat 2 still runs and is still visible as a distinct beat.
- [ ] The beats are derived from `SeniorAllocated` / `JuniorAllocated` log ordering, not from a
      balance diff. Verifiable by reading `CascadeController`.
- [ ] With `prefers-reduced-motion: reduce` set, two sequential status updates still occur, 700 ms
      apart, in the order senior then junior, announced through `aria-live`.
- [ ] Numerals use `font-variant-numeric: tabular-nums`; digits do not reflow during the count.
- [ ] Both the CC3 allocation transaction link and the Sepolia source link are present and resolve.

**Feature 6 — the rejection beat**

- [ ] The rendered string is byte-identical to
      `Attestation failed — balances held at prior state, no funds moved.` including the em dash.
      Verify with `grep -F` against the built output, not by eye.
- [ ] The string is defined once as `REJECTION_MESSAGE` and referenced, not duplicated.
- [ ] Both tranches show a real before value, a real after value, and the word `unchanged`.
- [ ] The decoded `AttestationFailed(id, reason)` is displayed.
- [ ] A link to the reverted CC3 transaction is present and resolves to a transaction whose status
      is `reverted`.
- [ ] `grep -rn "spinner\|Spinner\|animate-spin\|retry\|Retrying" /web/src` returns nothing inside
      the rejection path.
- [ ] The rejection beat is visually and structurally distinct from the cascade — it is a separate
      component, not a variant flag on the cascade.
- [ ] The replay case renders `AlreadyApplied` with its supporting line.

**Feature 4 — buy-in**

- [ ] A viewer who has not read any contract code can identify which tranche is paid first, from the
      screen alone.
- [ ] The two-tranche cap is visible on `/`, and the count is read from `trancheCount()` on chain.
- [ ] Seniority is legible with colour removed. Verify by screenshotting in greyscale.
- [ ] Per-investor exposure appears for a connected wallet holding a position.
- [ ] The synthetic/testnet disclosure is visible in the same view as the invoice data.
- [ ] The fixed-rule sentence is present next to the rate.

**Feature 7 — audit trail**

- [ ] Allocations and rejections both appear, in chronological order, visually distinct.
- [ ] Rejections show `—` in Senior and Junior, not `0`.
- [ ] Every hash links to the correct explorer host for its chain. Check every link.
- [ ] `/activity/[cycleId]` shows the Sepolia amount and the Creditcoin `attestedAmount` on one
      screen, as the same number.

**Design fidelity to Appendix A**

- [ ] `khmBg #f6f4ee`, `khmDark #121212`, `khmGray #767676`, `khmBorder #dedbd2` are present in the
      Tailwind config with exactly these values.
- [ ] The page ground is `khmBg`. Nothing is pure white and nothing is pure black.
- [ ] `border-radius` is `0` everywhere. `grep -rn "rounded" /web/src` returns nothing.
- [ ] The only shadow in the application is the status sticker's `0 2px 6px rgba(0,0,0,0.06)`.
- [ ] Display type is the serif stack; UI type is the sans stack. No third family.
- [ ] All borders are 1px hairlines except the senior panel's 2px seniority rule.
- [ ] Container is `max-w-[1400px]` with `px-6 md:px-12` gutters, matching the reference.
- [ ] Ghost buttons use `hover:opacity-70 transition-opacity`, matching the reference's idiom rather
      than a colour shift.
- [ ] The rotated status sticker is reused for the testnet disclosure, at `rotate(-3deg)`.

**General**

- [ ] `next build` succeeds. `tsc --noEmit` passes under `strict` with zero errors.
- [ ] `grep -rln "use client" /web/src/app` shows no `layout.tsx` and no `page.tsx`.
- [ ] `grep -rn "//" /web/src` returns nothing other than `// TEMPORARY —` lines explicitly
      sanctioned by the user.
- [ ] `grep -rn ": any\|@ts-ignore" /web/src` returns nothing.
- [ ] No prohibited copy: `grep -rniE "guaranteed|insured|APY|credit score|risk model|securities|prevents a crisis" /web/src` returns nothing.
- [ ] Every interactive element shows a visible focus ring on keyboard navigation.
- [ ] No file under `/contracts`, `/relayer`, or `/docs/evidence` was modified by this role.

---
---

# Appendix A — TrancheTrade design system

**Sources.** Everything marked `[REF]` is inventoried directly from `docs/code.html` with the line
number given, or observed in the rendered `docs/screen.png`. Everything marked `[EXTENDED]` does not
exist in the reference and was designed for TrancheTrade, with the basis stated.

**Why extension was necessary, stated plainly.** The reference is a Kunsthistorisches Museum
exhibition landing page. It has no tables, no forms, no inputs, no modals, no data-dense components,
and no badge other than one rotated status sticker. It also has no loading, error, empty, or
rejected state. TrancheTrade needs tranche balance displays, a deposit flow, an audit-trail table,
and an unmistakable fail-closed rejection. Every extension below stays inside the reference's own
rules: sharp corners, hairline borders, warm off-white ground, two type scales, opacity-based
hover, and no decoration that is not information.

---

## §1 Colour tokens

### Inventoried `[REF]`

| Token | Value | Where it is used in the reference |
|---|---|---|
| `khmBg` | `#f6f4ee` | Page ground. `body class="bg-khmBg"` — line 48 |
| `khmDark` | `#121212` | All primary text; SVG stroke; active language `DE` — lines 48, 54, 63, 73 |
| `khmGray` | `#767676` | Secondary and inactive text: the `/` separator and inactive `EN` — lines 74–75 |
| `khmBorder` | `#dedbd2` | Hairline borders — lines 50, 88 |

Opacity usage in the reference, which is part of the system, not an accident:

| Usage | Value | Line |
|---|---|---|
| Header bottom rule | `border-khmBorder/60` | 50 |
| Status sticker border | `border-khmBorder/80` | 88 |
| Status sticker text | `text-khmDark/80` | 88 |
| Status sticker fill | literal `#f9f8f4` — a one-off, one step lighter than `khmBg` | 88 |
| Status sticker shadow | `rgba(0, 0, 0, 0.06)` | 44 |

There is **no semantic colour of any kind** in the reference — no success, no warning, no error, no
accent. The palette is four warm neutrals and nothing else.

### Extended `[EXTENDED]`

Basis: a financial UI must signal allocated versus rejected, and PRD Feature 6 requires an
unmistakable rejection. A conventional `#ef4444` red would tear a hole in a warm, ink-on-paper
palette. These are chosen as *print inks* — the single spot colour a museum catalogue would use —
so they read as belonging to the same object.

| Token | Value | Use | Basis |
|---|---|---|---|
| `khmAlert` | `#8a2b22` | Rejection eyebrow, rejection rule, rejected row marker. **Nothing else.** | Oxblood; a printer's spot red, saturated enough to signal, warm enough to sit on `#f6f4ee` |
| `khmAlertBg` | `#f4eae7` | Rejection band fill | `khmBg` shifted toward `khmAlert` by the same small step `#f9f8f4` shifts from `khmBg` in the reference (line 88) |
| `khmPositive` | `#2f5d3a` | `ALLOCATED` label only | Deep forest; the second and last spot ink. Never used for a balance figure, never as a fill |
| `khmPositiveBg` | `#eef1ec` | Allocation confirmation band fill | Same construction as `khmAlertBg` |
| `khmMuted` | `#a8a49a` | Disabled controls, skeleton placeholders, `—` glyphs | Sits between `khmGray` and `khmBorder`; visibly inactive without introducing a fifth hue |

Rules governing the extended colours, which keep them from spreading:

1. `khmAlert` and `khmPositive` appear only as **text and 3px rules**, never as a large fill and
   never on a balance figure.
2. Seniority is **never** encoded in colour. See §7.1.
3. No gradient anywhere. The reference has none.
4. Total palette is nine tokens. Adding a tenth is a PM escalation.

---

## §2 Typography

### Inventoried `[REF]`

**Families** — lines 19–22:

```
serif: '"Times New Roman"', 'Times', 'Baskerville', 'Georgia', 'serif'
sans:  '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'
```

The reference loads **no web font**. Both stacks are system stacks. Keep it that way: it is free,
instant, and correct on the exhibition-print reference this is drawn from.

`font-sans` is the body default (line 48). Serif is used for exactly one element: the display title
(line 107).

**The display scale** — `.main-title`, lines 29–34:

```css
font-size: clamp(3.75rem, 8.5vw, 9.5rem);   /* 60px → 152px */
line-height: 0.95;
letter-spacing: -0.015em;
font-weight: 400;
```

Note the weight: **400**. The reference achieves its authority through size, not through bold. Do
not set a display heading to 600 or 700.

**The wordmark** — `.museum-logo`, lines 35–38, applied at line 63:

```css
letter-spacing: 0.08em;
line-height: 1.15;
```
rendered as `uppercase text-[11px] md:text-[12px] font-bold tracking-wider`.

**Every remaining type size in the reference:**

| Element | Spec | Line |
|---|---|---|
| Index nav label | `text-[15px] font-normal`, parent `text-sm tracking-wide` | 53, 58 |
| Artist attribution | `text-lg md:text-xl font-normal leading-tight tracking-normal` | 101 |
| Exhibition dates | `text-lg md:text-xl font-normal leading-tight tracking-normal` | 114 |
| Language switch | `text-xs tracking-wider font-medium`; active adds `font-semibold` | 72–73 |
| Audio label | `text-[11px] uppercase tracking-wide` | 83 |
| Status sticker | `text-[11px]` | 88 |

**The signature of this system, observed in `docs/screen.png`:** there are exactly **two type
scales and nothing between them.** Utility type at 11–15px, display type at roughly 150px. No 24px,
no 32px, no 48px. That extreme jump is the composition's entire voice, and the most common way to
ruin it is to introduce a comfortable mid-size heading.

**Weights in use:** 400 (normal), 500 (medium), 600 (semibold), 700 (bold). Display is 400 only.

### Extended `[EXTENDED]`

Basis: the reference's two-scale system has no home for a tranche balance. A balance at 11px is
unreadable at demo distance; at 152px it swamps the page. TrancheTrade needs one mid tier — and
exactly one, so the two-scale character survives with a third register rather than a continuum.

| Class | Spec | Use |
|---|---|---|
| `.figure-lg` | `font-family: serif; font-size: clamp(2.25rem, 4.5vw, 4rem); line-height: 1.0; letter-spacing: -0.01em; font-weight: 400; font-variant-numeric: tabular-nums;` | Tranche outstanding balances. The two headline numbers on `/` |
| `.figure-md` | `font-family: sans; font-size: 1.25rem; line-height: 1.2; font-weight: 400; font-variant-numeric: tabular-nums;` | Secondary figures: allocated totals, per-investor exposure |
| `.figure-sm` | `font-family: sans; font-size: 0.9375rem; line-height: 1.4; font-weight: 400; font-variant-numeric: tabular-nums;` | Table cells, before/after values in the rejection beat |
| `.label-utility` | `font-family: sans; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.08em; line-height: 1.15;` | Every label, eyebrow, and column header. Reuses the wordmark's exact tracking from line 36 |
| `.hash-mono` | `font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8125rem; letter-spacing: 0;` | Transaction hashes and attestation ids only |

`.figure-lg` uses the **serif** family deliberately: it borrows the display face's authority for the
one number that matters, and it visually separates the balance from every label around it. It uses
weight 400, matching `.main-title`.

`tabular-nums` on every figure class is not cosmetic. The cascade in R-8 counts digits; proportional
numerals reflow mid-count and the animation reads as jitter rather than as a value changing.

`.hash-mono` is the one place a monospace family is permitted. Hashes must be visually comparable
character by character against an explorer, and a proportional font makes that materially harder.

---

## §3 Spacing rhythm

### Inventoried `[REF]`

Everything in the reference is on a 4px grid. Every value observed:

| Value | Tailwind | Where | Line |
|---|---|---|---|
| 2px | `py-0.5` | Sticker vertical padding | 88 |
| 4px | `space-x-1` | Audio icon to label | 78 |
| 8px | `gap-2`, `mt-2` | Nav icon to label; sticker offset below the language row | 53, 87 |
| 10px | `px-2.5` | Sticker horizontal padding | 88 |
| 12px | `space-x-3`, `pl-3` | Language switch spacing; audio button left padding | 72, 77 |
| 20px | `py-5` | Header vertical padding | 50 |
| 24px | `px-6`, `gap-6`, `pt-6` | Mobile gutter; hero grid gap; column top padding at `md` | 50, 98, 100 |
| 32px | `pt-8` | Main top padding, mobile | 96 |
| 48px | `px-12` | Desktop gutter | 50 |
| 56px | `pt-14` | Main top padding, desktop | 96 |

Also `-mt-1 md:-mt-3` (line 109) — a negative 4px/12px pull tightening the display title's second
line against its first. Optical, not systematic; reuse the technique only on multi-line display type.

**Composition observed in `docs/screen.png`:** the vertical rhythm is `rule → void → type → void →
image`. Two large empty regions carry the page. The header band is roughly 90px tall; the title
block occupies roughly 150–330px on a 1280×880 viewport; the artwork band begins around 48% of
viewport height. Roughly 55% of the page is empty ground. That emptiness is the design, and the
easiest way to destroy the reference's character is to fill it with cards.

### Extended `[EXTENDED]`

Basis: a data-dense view needs section rhythm the reference never had to define.

| Token | Value | Use |
|---|---|---|
| Section gap | `py-16 md:py-24` (64/96px) | Between major page sections |
| Panel internal padding | `p-6 md:p-8` (24/32px) | Inside a tranche panel |
| Table row padding | `py-4` (16px) | Audit-trail rows |
| Table header padding | `pb-3` (12px) | Above the header hairline |
| Label to figure | `mb-3` (12px) | Between a `.label-utility` and its figure |

All on the 4px grid. Preserve the reference's generosity: a tranche panel is mostly empty space with
a figure in it, not a filled card.

---

## §4 Radii, shadows, borders

### Inventoried `[REF]`

**Radii: zero. Everywhere.** No `rounded-*` class appears anywhere in `docs/code.html`. The status
sticker (line 88), the buttons (lines 53, 77), and the image (line 123) all have square corners.
This is the single most recognisable property of the system and the easiest to lose. In TrancheTrade,
`border-radius: 0` on every element, with no exceptions.

**Shadows: exactly one.** `.closed-badge`, line 44:

```css
box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
```

It exists to lift a rotated paper sticker off the page. There is no other shadow. No card shadow, no
hover shadow, no elevation scale.

**Borders: 1px hairlines only.**

| Border | Line |
|---|---|
| `border-b border-khmBorder/60` — header bottom rule, full-bleed | 50 |
| `border border-khmBorder/80` — status sticker | 88 |

**SVG stroke weights:** `stroke-[1.5]` on the index icon (line 54), `stroke-width="1.8"` on the audio
icon (line 78). Any icon you add uses `stroke-width: 1.5`, `fill="none"`, `stroke="currentColor"`.

### Extended `[EXTENDED]`

| Element | Spec | Basis |
|---|---|---|
| Senior tranche top rule | `2px solid khmDark` | The only 2px rule permitted. It encodes seniority through weight, in a system where weight is already the hierarchy device |
| Junior tranche top rule | `1px solid khmBorder` | The system's default hairline, subordinate by construction |
| Table header rule | `1px solid khmBorder` | Reuses the header rule at line 50 |
| Table row rule | `1px solid khmBorder/60` | Reuses the exact opacity from line 50 |
| Rejection band left rule | `3px solid khmAlert` | Deliberately heavier than the 2px seniority rule so the two are never confused. A rejection is the only place a 3px rule appears |
| Input underline | `1px solid khmBorder`, `khmDark` on focus | The hairline system applied to a control the reference never had |

Radius stays `0` on all of these. No shadow is added to any of them.

---

## §5 Grid, containers, breakpoints

### Inventoried `[REF]`

| Property | Value | Line |
|---|---|---|
| Container | `max-w-[1400px] w-full mx-auto` | 98 |
| Gutters | `px-6 md:px-12` (24px / 48px) | 50, 98 |
| Grid | `grid-cols-1 md:grid-cols-12`, `items-baseline`, `gap-6` | 98 |
| Column split | `md:col-span-3` / `md:col-span-6` / `md:col-span-3` | 100, 106, 113 |
| Mobile reorder | `order-2/1/3` → `md:order-1/2/3` — the title leads on mobile | 100, 106, 113 |
| Page frame | `min-h-screen flex flex-col justify-between overflow-x-hidden` | 48 |
| Bottom band | `mt-auto`, `max-h-[58vh]`, `min-height: 280px` | 120–123 |
| Layering | header `z-20`, main `z-10` | 50, 96 |

**The reference uses exactly one breakpoint: `md` (768px).** No `sm`, no `lg`, no `xl` appears
anywhere. Layout is a single binary switch between a stacked mobile view and a 12-column desktop
view.

`items-baseline` (line 98) is worth naming: the left attribution and right dates align to a text
baseline against a 152px display title, not to its box. In `docs/screen.png` this places the small
type low against the title's second line, which is what makes the composition read as typeset rather
than as a flexbox row.

### Extended `[EXTENDED]`

Basis: a ten-column audit table cannot make a single jump from stacked to 12-column. One additional
breakpoint is added and no more.

| Breakpoint | Width | Purpose |
|---|---|---|
| base | — | Stacked. Tranche panels stack; the audit table becomes stacked records, not a scrolling table |
| `md` | 768px | The reference's own breakpoint. Tranche panels side by side; audit table shows When, Cycle, Attested, Result |
| `lg` | 1024px | Full ten-column audit table with all three hash columns |

Container and gutters are inherited unchanged: `max-w-[1400px]`, `px-6 md:px-12`.

Tranche panel grid: `grid-cols-1 md:grid-cols-12` with senior at `md:col-span-6` and junior at
`md:col-span-6`, senior first in DOM order at every width. **Never reorder them responsively** — the
reference reorders its hero on mobile (line 100), but seniority is semantic and DOM order carries it
for assistive technology.

---

## §6 Page and section structure

### Inventoried `[REF]`

```
body                    bg-khmBg, min-h-screen, flex-col, justify-between, font-sans, select-none   (48)
├── header              full width, border-b hairline, px-6/12, py-5, z-20                          (50)
│   ├── nav-left        icon + "Index" ghost button                                                 (52)
│   ├── museum-brand    absolutely centred, left-1/2 -translate-x-1/2, four stacked uppercase lines (62)
│   └── nav-right       flex-col items-end: language row, then the rotated status sticker below     (71)
├── main                flex-grow flex-col justify-between, pt-8/14, pb-0, z-10                     (96)
│   ├── hero-typography max-w-[1400px], 12-col, 3/6/3, items-baseline                               (98)
│   └── hero-artwork    mt-auto, full-bleed, max-h-[58vh]                                           (120)
└── (no footer)
```

Three structural properties to carry forward:

1. **The brand is absolutely centred**, not flex-centred — it stays optically centred in the viewport
   regardless of how wide the left and right nav clusters grow (line 62).
2. **The status sticker lives below the utility row**, right-aligned, in a `flex-col items-end`
   stack (lines 71, 87). It is chrome, not content.
3. **There is no footer.** The page terminates in a full-bleed band. `justify-between` on the body
   (line 48) plus `mt-auto` on that band (line 120) is what pins it to the bottom.

The reference also sets `select-none` on the body (line 48) and `pointer-events-none` on the artwork
(line 123).

### Extended `[EXTENDED]`

```
body                    bg-khmBg, min-h-screen, flex-col, font-sans
├── header              REF structure, retargeted
│   ├── nav-left        "Activity" ghost button, icon + label      (REF pattern, line 53)
│   ├── brand           absolutely centred, stacked: TRANCHE / TRADE   (REF pattern, line 62)
│   └── nav-right       flex-col items-end
│       ├── network row  SEPOLIA / CC3 segmented indicator + wallet button  (REF pattern, lines 72–75)
│       └── sticker      rotated: "Testnet — synthetic invoice data"        (REF component, line 87)
├── main
│   ├── hero            12-col, 3/6/3, items-baseline
│   │                   left: pool reference · centre: display title · right: attested total
│   ├── tranches        two panels, senior then junior
│   ├── beat-region     cascade OR rejection beat — one region, never both at once
│   └── activity-preview  last five cycles, link to /activity
└── footer              EXTENDED: single hairline rule, one line of utility type carrying the
                        contract addresses and the PRD §13 disclosure
```

**`select-none` is removed on TrancheTrade.** The reference disables selection because it is a
poster; TrancheTrade's users must be able to copy a transaction hash. Keep `select-none` only on
purely decorative type.

The footer is an extension. The reference has none, but PRD §13 and §14 require a persistent
disclosure and public contract addresses, and a hairline rule with one line of `.label-utility`
matches the header rule at line 50 closely enough that it reads as the same object.

**The `beat-region` is one region.** The cascade and the rejection beat occupy the same space and are
never visible simultaneously. PRD Feature 6 requires the failure to be "a second, distinct demo beat,
not folded into" the cascade — one region shown twice, in sequence, is what makes them distinct
rather than adjacent.

---

## §7 Component vocabulary

### §7.1 Tranche panel `[EXTENDED]`

The single most important component. Basis: nothing like it exists in the reference; it is built
from the reference's rules — hairline, no radius, generous void, utility label over a large figure.

```
┌ 2px khmDark ─────────────────────────────┐   ← senior; junior uses 1px khmBorder
│                                          │
│  I                          SENIOR       │   ← serif ordinal 2rem khmGray · .label-utility
│                                          │
│  49,200.00                               │   ← .figure-lg, serif, tabular-nums
│  tCTC OUTSTANDING                        │   ← .label-utility khmGray
│                                          │
│  ─────────────────────────────────────   │   ← 1px khmBorder/60
│  ALLOCATED TO DATE       25,000.00       │   ← .label-utility · .figure-md
│  PRINCIPAL DEPOSITED     70,000.00       │
│  CAP                     70,000.00       │
│  YOUR POSITION           10,600.00       │   ← only when a wallet is connected
│                                          │
│  Paid first from every attested          │   ← 15px sans khmGray
│  repayment.                              │
└──────────────────────────────────────────┘
```

Junior differs in exactly four ways: a 1px `khmBorder` top rule instead of 2px `khmDark`; the ordinal
`II`; the sentence `Paid only after the senior tranche is fully satisfied.`; and its position, second.

**Seniority is never encoded in colour.** It is rule weight, ordinal, sentence, and order. This
survives greyscale, survives colour-blindness, and matches a system whose entire palette is warm
neutrals. Verify by screenshotting the page in greyscale — seniority must still be obvious.

### §7.2 Segmented text toggle `[REF]`, lines 73–75

The reference's `DE / EN` switch, reused unchanged for the tranche selector and the network
indicator:

- Active: `text-khmDark font-semibold`
- Inactive: `text-khmGray hover:text-khmDark transition-colors cursor-pointer`
- Separator: a literal `/` in `khmGray`
- Container: `text-xs tracking-wider font-medium`

No pill, no background, no border, no radius. The state is carried by weight and colour on bare text.

### §7.3 Ghost button `[REF]`, lines 53, 77

- `flex items-center gap-2 text-sm tracking-wide hover:opacity-70 transition-opacity`
- Icon: 16px (`w-4 h-4`), `stroke-[1.5]`, `fill="none"`, `stroke="currentColor"`
- Label: `text-[15px] font-normal`
- `aria-label` when icon-only (line 53); `title` for supplementary hint (line 77)

The hover is **opacity, not colour**. Every ghost interaction in TrancheTrade uses the same
`hover:opacity-70 transition-opacity`.

### §7.4 Stacked wordmark `[REF]`, lines 63–68

Four uppercase lines, `tracking-[0.08em]`, `line-height: 1.15`, `text-[11px] md:text-[12px]`,
`font-bold`. TrancheTrade uses two lines: `TRANCHE` / `TRADE`, same spec, absolutely centred in the
header exactly as line 62 does.

### §7.5 Status sticker `[REF]`, lines 40–46, 87–91

```css
transform: rotate(-3deg);
box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
background: #f9f8f4;
border: 1px solid rgba(222, 219, 210, 0.8);
padding: 2px 10px;
font-size: 11px;
color: rgba(18, 18, 18, 0.8);
white-space: nowrap;
```

The reference uses it once, for `Ausstellung bereits beendet` — an exhibition-status note. That maps
directly onto TrancheTrade's required synthetic-data disclosure: `Testnet — synthetic invoice data`,
in the same header position.

**Rotation is reserved for the single page-level status.** Every other badge uses the identical box
without `transform` and without the shadow. This keeps the rotated sticker meaningful.

### §7.6 Inline status badge `[EXTENDED]`

Basis: derived from §7.5 with the rotation and shadow removed, for statuses that appear in rows and
lists.

`background: #f9f8f4; border: 1px solid khmBorder/80; padding: 2px 10px;` with `.label-utility`
text. Variants change only the text colour:

| Variant | Text colour | Copy |
|---|---|---|
| Allocated | `khmPositive` | `ALLOCATED` |
| Rejected | `khmAlert` | `REJECTED` |
| Pending | `khmGray` | `AWAITING ATTESTATION` |
| Applied | `khmGray` | `ALREADY APPLIED` |

No fill change between variants. The border and background stay constant; only the ink changes —
which is exactly how the reference's one badge behaves.

### §7.7 Hash link `[EXTENDED]`

Basis: the reference has links but no data links. Built from its hairline and hover-colour idioms.

- `.hash-mono`, middle-truncated to `0x8f3a…21c4` using U+2026, never `...`
- `text-decoration: underline; text-decoration-color: khmBorder; text-underline-offset: 3px`
- Hover: `text-decoration-color: khmDark` via `transition-colors`
- External links carry a trailing `↗` and `rel="noopener noreferrer"`
- `title` carries the full hash so it is available on hover and to assistive technology

### §7.8 Editorial metadata row `[REF]`, lines 98–117

`grid-cols-1 md:grid-cols-12`, `items-baseline`, `gap-6`, split 3/6/3, left column left-aligned,
right column `text-left md:text-right`. Reused for the hero on `/`: pool reference at left, display
title centred, total attested at right.

---

## §8 Data components

Everything in this section is `[EXTENDED]`. The reference contains no tabular or form UI whatsoever.
Basis for every choice: hairlines instead of fills, no radius, no zebra striping, utility type for
labels, tabular numerals for figures.

### §8.1 Audit table `[EXTENDED]`

- **No fills. No zebra striping. No vertical rules.** Structure is carried entirely by horizontal
  hairlines, exactly as the header rule at line 50 carries the reference's structure.
- Header row: `.label-utility` in `khmGray`, `pb-3`, `border-bottom: 1px solid khmBorder`
- Body rows: `py-4`, `border-bottom: 1px solid khmBorder/60`
- Numeric cells: `.figure-sm`, right-aligned, `tabular-nums`
- Text cells: 15px sans, left-aligned
- Hash cells: §7.7
- Row hover: `background: rgba(18, 18, 18, 0.02)` — the faintest possible wash. No border change, no
  shadow, no transform.
- A rejected row is marked by a `3px khmAlert` **left** rule on the row and a `REJECTED` badge in the
  Result column. The rest of the row is unchanged; a fully tinted row would be louder than the
  reference tolerates and would make the table hard to scan.
- Below `md`: the table becomes stacked records, each a hairline-separated block of label/value
  pairs. **Never a horizontally scrolling table** — a judge on a laptop should not have to scroll
  sideways to find a hash.
- Empty state: §9.3.

### §8.2 Underline input `[EXTENDED]`

The Tailwind `forms` plugin is already loaded in the reference (`?plugins=forms,container-queries`,
line 8), so its base reset is available and part of the inventoried system.

```
background: transparent;
border: 0;
border-bottom: 1px solid khmBorder;
border-radius: 0;
padding: 12px 0;
font-size: 15px;
font-family: sans;
font-variant-numeric: tabular-nums;   /* amount inputs only */
```

- Placeholder: `khmMuted`
- Hover: `border-bottom-color: khmGray`
- Focus: `border-bottom-color: khmDark` **plus** `outline: 1px solid khmDark; outline-offset: 4px`.
  The outline is required — see §9.1; a border-colour change alone is not a sufficient focus
  indicator.
- Invalid: `border-bottom-color: khmAlert`, with a `.label-utility khmAlert` message below. No icon.
- Disabled: `border-bottom-color: khmBorder`, `color: khmMuted`, `cursor: not-allowed`
- Suffix unit (`tCTC`) sits inline right in `.label-utility khmGray`

### §8.3 Primary button `[EXTENDED]`

The reference has only ghost buttons (§7.3). A deposit needs a committing action.

```
background: khmDark;
color: khmBg;
border-radius: 0;
padding: 12px 24px;
font-size: 13px;
text-transform: uppercase;
letter-spacing: 0.08em;
font-weight: 500;
```

- Hover: `opacity: 0.85` with `transition-opacity` — the reference's own hover idiom (lines 53, 77),
  not a colour shift
- Active: `opacity: 0.75`
- Focus-visible: `outline: 1px solid khmDark; outline-offset: 4px`
- Disabled: `background: khmMuted; color: khmBg; cursor: not-allowed;` no opacity change
- Pending: label swaps to `CONFIRMING…` and the button disables. **No spinner** — see §9.2

### §8.4 Secondary button `[EXTENDED]`

Identical geometry, inverted: `background: transparent; color: khmDark; border: 1px solid khmDark;`
Hover `opacity: 0.7`.

---

## §9 Interaction and state patterns

### §9.1 Inventoried `[REF]`

| Pattern | Spec | Line |
|---|---|---|
| Ghost hover | `hover:opacity-70 transition-opacity` | 53, 77 |
| Inactive-text hover | `hover:text-khmDark transition-colors` | 75 |
| Cursor | `cursor-pointer` on text toggles | 73, 75 |
| Selection | `select-none` on body and image | 48, 123 |
| Pointer events | `pointer-events-none` on the artwork | 123 |
| Icon-only labelling | `aria-label="Open index menu"` | 53 |
| Supplementary hint | `title="Audio Guide"` | 77 |

Transition durations are never specified in the reference, so Tailwind's default applies: **150ms,
`ease`**. Use that as the default everywhere except the cascade, which is specified in R-8.

**Gaps in the reference, recorded honestly:** there is **no** `:focus-visible` style, no `:active`
style, no disabled style, no loading state, no error state, no empty state, and no rejected state.
Everything in §9.2 through §9.6 is therefore `[EXTENDED]`, and §9.2 is additionally a WCAG
requirement the reference does not meet.

### §9.2 Focus `[EXTENDED]` — required, not optional

```css
outline: 1px solid #121212;
outline-offset: 4px;
border-radius: 0;
```

Applied via `:focus-visible` on every interactive element. A 1px hairline offset by 4px is the
system's own vocabulary — it is the header rule, floated. Never `outline: none` without a
replacement.

### §9.3 Loading and empty `[EXTENDED]`

**Loading. No spinners anywhere in this application.** A spinner is a rotating decoration with no
information content, it fights an editorial print aesthetic, and PRD Feature 6 explicitly bans one
on the failure path — permitting them elsewhere would make the failure path's absence ambiguous.

- Figure placeholder: an em-dash run `———` in `khmMuted`, in the same figure class as the value it
  replaces, so the layout does not shift when the value arrives.
- Block placeholder: `background: khmBorder/40`, exact final dimensions, no radius.
- Under `prefers-reduced-motion: no-preference`, a placeholder may breathe between `opacity: 1` and
  `0.6` over 1.6s. Under `reduce`, it is completely static.
- The container carries `aria-busy="true"`.

**Empty:**

```
────────────────────────────────────────   ← 1px khmBorder
              No allocations yet.          ← 20px serif khmGray, centred, py-16
   Waiting for the first attested repayment event.   ← .label-utility khmGray
────────────────────────────────────────
```

No illustration, no icon, no call-to-action button.

### §9.4 The rejection state `[EXTENDED]` — PRD Feature 6, full specification

```
┌ 3px khmAlert ┬───────────────────────────────────────────────────────────┐
│              │                                                            │
│              │  REJECTED                              ← .label-utility, khmAlert
│              │                                                            │
│              │  Attestation failed — balances held at prior state,        │
│              │  no funds moved.                       ← 15px sans, khmDark
│              │                                                            │
│              │  AttestationFailed(0x8f3a…21c4, InvalidProof)              │
│              │                                        ← .hash-mono, khmGray
│              │                                                            │
│              │  SENIOR OUTSTANDING   49,200.00  →  49,200.00   unchanged  │
│              │  JUNIOR OUTSTANDING   35,400.00  →  35,400.00   unchanged  │
│              │       ← .label-utility khmGray · .figure-sm khmDark tabular-nums
│              │         · arrow U+2192 khmMuted · "unchanged" .label-utility khmGray
│              │                                                            │
│              │  Reverted transaction on Creditcoin CC3 ↗   ← §7.7 hash link
│              │                                                            │
└──────────────┴────────────────────────────────────────────────────────────┘
   background: khmAlertBg #f4eae7
   border: 1px solid rgba(138, 43, 34, 0.4)   (khmAlert at 40%)
   border-left: 3px solid khmAlert
   padding: 32px
   border-radius: 0
   box-shadow: none
```

The values shown above are real values from the manifest's `rejection` object, not placeholders.
Render `seniorOutstandingBefore → seniorOutstandingAfter` and the literal word `unchanged`.

Behavioural requirements:

- Appears **instantly**, with no entry animation and no fade. A rejection that eases in reads as
  soft; this one must land.
- `role="status"`, `aria-live="polite"` — it is an expected, demonstrated outcome, not an
  interruption.
- Persistent. No auto-dismiss, no timeout, no toast.
- The tranche panels are **inert** while it is shown — no animation, no highlight, no dimming.
  Their stillness is the evidence.
- No spinner. No retry control. No "try again" copy.

### §9.5 Disabled `[EXTENDED]`

`color: khmMuted; border-color: khmBorder; cursor: not-allowed;` Opacity is **not** used to indicate
disabled, because opacity is already the hover idiom (§7.3) and overloading it makes a disabled
control read as a hovered one.

Every disabled control carries a `.label-utility khmGray` line below it saying why. A disabled
button with no explanation is a dead end in a three-minute demo.

### §9.6 Motion `[EXTENDED]`

| Motion | Duration | Easing |
|---|---|---|
| Default transitions (hover, colour) | 150ms | `ease` (Tailwind default, inherited from the reference) |
| Cascade beat sweep | 900ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Cascade inter-beat hold | 300ms | — (no motion) |
| Numeral count | 900ms, synchronised with the sweep | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Rejection band | 0ms | — (instant) |

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

The global reset above is a floor, not the whole answer. The cascade must still deliver **two ordered
beats** under `reduce`, using sequential value changes and `aria-live` announcements 700ms apart —
the full specification is in R-8. Motion is how the two beats are expressed with animation
available; sequence is how they are expressed without it. The information is the sequence, and it
must survive.

---

## §10 What must never appear

Each of these would break the reference's character. Treat them as build failures.

- Any `border-radius` other than `0`
- Any shadow other than the status sticker's `0 2px 6px rgba(0,0,0,0.06)`
- Any gradient
- Any spinner or rotating loader
- Pure white `#ffffff` or pure black `#000000`
- A third font family beyond the serif and sans stacks, other than `.hash-mono` for hashes
- A mid-scale heading between the utility scale and the display scale — the figure classes in §2 are
  the only permitted middle register
- Bold display type; `.main-title` and `.figure-lg` are weight 400
- Filled cards with borders on all four sides carrying background colour
- Zebra striping in the audit table
- Colour as the sole encoder of seniority, or of allocated-versus-rejected
- An icon library; icons are inline SVG at `stroke-width: 1.5`
- Emoji, anywhere
- A toast or transient notification

---

## §11 Token summary for the Tailwind config

```js
theme: {
  extend: {
    colors: {
      khmBg: '#f6f4ee',          // REF, code.html line 14
      khmDark: '#121212',        // REF, code.html line 15
      khmGray: '#767676',        // REF, code.html line 16
      khmBorder: '#dedbd2',      // REF, code.html line 17
      khmAlert: '#8a2b22',       // EXTENDED
      khmAlertBg: '#f4eae7',     // EXTENDED
      khmPositive: '#2f5d3a',    // EXTENDED
      khmPositiveBg: '#eef1ec',  // EXTENDED
      khmMuted: '#a8a49a'        // EXTENDED
    },
    fontFamily: {
      serif: ['"Times New Roman"', 'Times', 'Baskerville', 'Georgia', 'serif'],   // REF, line 20
      sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto',
             'Helvetica', 'Arial', 'sans-serif'],                                  // REF, line 21
      mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']               // EXTENDED
    },
    maxWidth: {
      container: '1400px'        // REF, line 98
    },
    boxShadow: {
      sticker: '0 2px 6px rgba(0, 0, 0, 0.06)'   // REF, line 44 — the only shadow
    },
    borderRadius: {
      none: '0'                  // REF: the reference has no radius anywhere
    },
    transitionTimingFunction: {
      beat: 'cubic-bezier(0.16, 1, 0.3, 1)'      // EXTENDED
    }
  }
}
```

Keep the `REF` and `EXTENDED` annotations in the committed config. The next person to touch this
needs to know which values are the museum's and which are ours.
