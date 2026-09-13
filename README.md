# TrancheTrade

**One attested repayment. A waterfall, not a flat rate.**

TrancheTrade is an attestation-gated, risk-stratified trade-finance settlement layer. A real
invoice-repayment event on Ethereum Sepolia is attested by **Attestcoin**, then allocated on
**Creditcoin CC3** through a hard-capped, code-enforced two-tranche waterfall — senior investors
paid first, junior investors absorbing first-loss risk for a higher return, exactly the pattern
real-world trade-finance securitization already uses to bring conservative capital into an asset
class it would otherwise avoid.

Built for **BUIDL CTC 2026 Fall** (Creditcoin / Attestcoin Protocol, DoraHacks).

**Live app:** https://tranhetrade-production.up.railway.app
**Full pitch / submission writeup:** [`docs/SUBMISSION.md`](docs/SUBMISSION.md)
**Product requirements:** [`docs/TrancheTrade_PRD.md`](docs/TrancheTrade_PRD.md)
**Judge verification guide:** [`docs/evidence/judge-verification.md`](docs/evidence/judge-verification.md)
**3-minute demo script:** [`docs/DEMO_SCRIPT_3MIN.md`](docs/DEMO_SCRIPT_3MIN.md)

---

## The problem, in one breath

The global trade-finance gap is **$2.5 trillion a year**. SMEs get rejected for financing at
roughly **double** the rate of large corporations, because every investor in a pooled trade-finance
position gets the same blended rate regardless of how much risk they actually want to carry.
Undifferentiated pooling is a documented, named reason conservative capital stays out of this
asset class — not a UX inconvenience.

## The mechanism

<img width="2092" height="752" alt="image" src="https://github.com/user-attachments/assets/ead662bc-9499-49ee-bc46-464b6d29a2a8" />


1. An invoice repayment lands as a real `InvoiceRepaid` event on Ethereum Sepolia.
2. Attestcoin attests that event and returns a proof carrying the exact amount and a unique
   attestation id.
3. Any permissionless relayer submits the proof to `TrancheWaterfall` on Creditcoin CC3, which
   allocates the full amount to the senior tranche first, then any remainder to junior — never
   the reverse.
4. If the proof is invalid, corrupted, or already applied, the contract reverts the entire
   transaction. Tranche state after a failed call is bit-for-bit identical to before it.

Six invariants (INV-1 through INV-6 — waterfall order, no junior skip-ahead, fail-closed,
replay protection, the immutable two-tranche cap, and conservation of value) are enforced in
Solidity and shipped as a **36/36 passing** Foundry unit + fuzz suite (9 fuzz properties ×
10,000 runs each).

## What's real, stated plainly

- **Real deployments** on Ethereum Sepolia and Creditcoin CC3 testnet — see [Deployed
  contracts](#deployed-contracts) below, or query them yourself with `cast`.
- **Four real, independently verifiable transaction cycles** already recorded in
  [`docs/evidence/transactions.json`](docs/evidence/transactions.json): a senior-only
  allocation, a senior-exhausts-into-junior allocation, a corrupted-proof rejection, and a
  replay-of-an-applied-attestation rejection — every hash resolves on a public explorer.
- **Invoice data is synthetic and disclosed as such**, on a self-deployed `InvoiceRegistry`.
  There is no real production invoice source, no KYC, and no securities offering. Allocation is
  an accounting entitlement against an attested repayment, not a transfer of repayment cash —
  see `docs/evidence/judge-verification.md` §7 for the full list of what this does not do.

## Deployed contracts

| Contract | Chain | Address |
|---|---|---|
| `InvoiceRegistry` | Ethereum Sepolia (`11155111`) | [`0x049a7c970Bd1e35ff13C15e73F59FbfA690D3ae5`](https://sepolia.etherscan.io/address/0x049a7c970Bd1e35ff13C15e73F59FbfA690D3ae5) |
| `TrancheWaterfall` | Creditcoin CC3 testnet (`102031`) | [`0x11ae52135180Cc0e76d28fbD6c9985393C291868`](https://creditcoin-testnet.blockscout.com/address/0x11ae52135180Cc0e76d28fbD6c9985393C291868) |
| `AttestcoinVerifier` | Creditcoin CC3 testnet (`102031`) | [`0x3b3dfc7609fA394EC268364Df0270444963428F1`](https://creditcoin-testnet.blockscout.com/address/0x3b3dfc7609fA394EC268364Df0270444963428F1) |

Full deploy transactions, block numbers, and reproduction commands (`cast call snapshot()`,
etc.) are in `docs/evidence/judge-verification.md`.

---

## Repository layout

```
contracts/   Foundry project — TrancheWaterfall, AttestcoinVerifier, InvoiceRegistry, INV-1..6 tests
relayer/     Permissionless CLI relayer — Sepolia → Attestcoin → Creditcoin CC3
web/         Next.js 15 App Router frontend — pool view, live cascade, audit trail
docs/        PRD, demo script, submission writeup, and the evidence bundle judges verify against
```

Each subproject has its own README with full setup instructions:
[`contracts/README.md`](contracts/README.md) · [`relayer/README.md`](relayer/README.md) ·
[`web/README.md`](web/README.md).

## Quick start

### Frontend (the fastest way to see it working)

```bash
cd web
npm install
npm run dev
# open http://localhost:3000
```

The frontend reads `docs/evidence/transactions.json` at build time and Creditcoin CC3 directly
at request time — no backend, no database, no intermediary between the chain and the screen.

### Contracts

```bash
cd contracts
forge test          # 36/36 passing — unit + fuzz (INV-1..INV-6)
forge test -vvv      # verbose, to see each invariant assertion
```

### Relayer

```bash
cd relayer
npm install
npm run relayer -- chains     # confirm chainKey 1 -> chainId 11155111
npm run relayer -- snapshot   # read current tranche balances live from CC3
```

Full command reference (`issue`, `repay`, `prove`, `verify`, `allocate`, `manifest`, corruption
modes for the fail-closed demo) is in `relayer/README.md`.

## Deploying the frontend

The live app is deployed on Railway from the repo root, using the root `package.json` to
delegate `build`/`start` into `web/` (the frontend imports `docs/evidence/*.json` via a path
alias, so the build needs the full repo, not just `web/`, in its context):

```bash
railway up
```

---

## Security model

Attestcoin's verified proof of the Sepolia `InvoiceRepaid` event is the **sole trusted input**
driving tranche allocation. The relayer, the UI hosting environment, and anyone proposing an
allocation transaction are all untrusted — they can transport proofs and trigger allocation, but
cannot alter tranche contents, order, or caps. Full trust model in `docs/TrancheTrade_PRD.md`
§12.

## License

No repository-wide `LICENSE` file has been added yet. `relayer/package.json` declares MIT for
that subproject; treat the rest as unlicensed until a `LICENSE` file is added.
