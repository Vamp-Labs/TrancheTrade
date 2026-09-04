# TrancheTrade demo runbook

The operational script behind the three-minute demo. Eight steps, each with the exact command, the
expected output, and a fallback.

**Status: rehearsable end to end only after the contracts are deployed and the relayer wallet is
funded.** Steps 3 and the read-only half of step 6 work today. Every step below marked
**BLOCKED (funding)** or **BLOCKED (deployment)** has not yet been rehearsed against a live chain.

---

## Before the presentation

These are not optional. PRD §15 requires all of them.

1. **Pre-attest.** At least one Sepolia transaction must already have a cached proof in
   `relayer/fixtures/` before judging begins. Attestation for Ethereum runs roughly every two
   minutes with checkpoints every twenty; that is usually fine and occasionally is not. Do not gamble
   on it during a live demo.

   ```
   npm run relayer -- prove --tx 0x<the pre-run repayment> --out fixtures/proof-1.json
   ```

2. **Fund both wallets.** tCTC comes from a Discord bot only: join `https://discord.gg/creditcoin`,
   go to `#token-faucet`, run `/faucet address:<your EVM address>`. There is no HTTP faucet. Sepolia
   ETH comes from any public Sepolia faucet. Do this days ahead; it is a human-latency step.

3. **Dry-run every broadcast.** `relayer verify --proof <path>` before each live transaction.

4. **Open the fallback tabs.** Every transaction link in `docs/evidence/transactions.json`, already
   loaded in a browser tab, so that any failed live broadcast can be replaced instantly by a real
   pre-captured transaction rather than by an apology.

5. **Confirm the chain.** `npm run relayer -- chains` must print `chainKey 1 -> chainId 11155111`
   and the RPC must report chain id `102031`, not `102030`.

There is **no demo-only code path.** Every command below is the same command the public repository
and the test suite use, against the same deployed contracts.

---

## The eight steps

### 1. Show the two funded tranches — BLOCKED (deployment)

```
npm run relayer -- snapshot
```

Expected: the full `snapshot()` tuple, with `seniorOutstanding` and `juniorOutstanding` non-zero.
The UI shows the same two numbers.

**Fallback:** read the tranche balances from the UI, which reads the chain directly. If CC3 RPC is
unreachable, show the `snapshot()` values recorded in the most recent cycle of
`docs/evidence/transactions.json` and say plainly that the RPC is down.

### 2. Trigger the real Sepolia repayment — BLOCKED (funding)

```
npm run relayer -- repay --invoice 1 --amount 25000000000000000000000
```

Expected: a Sepolia transaction hash, an Etherscan link, and one `InvoiceRepaid` log with the amount
visible.

**Fallback:** use the pre-run repayment captured before the presentation and open its Etherscan link
from the manifest. The demo narrative is unchanged; only the freshness of the transaction differs,
and say so.

### 3. Show the attestation request and proof — works today

```
npm run relayer -- prove --tx 0x<hash from step 2> --out fixtures/proof-2.json
```

Expected: a waiting line naming the Sepolia height being attested, then the proof summary, ending in
`verify()  true`. That line is a live read-only call to the block prover precompile on CC3.

**Fallback:** the pre-attested `fixtures/proof-1.json` from the preparation step. This is the single
most likely step to be slow, which is exactly why the pre-attestation is mandatory.

### 4. Submit the proof to Creditcoin — BLOCKED (deployment, funding)

```
npm run relayer -- verify   --proof fixtures/proof-2.json
npm run relayer -- allocate --proof fixtures/proof-2.json
```

Expected: `verify` prints `allocate staticcall would succeed`, then `allocate` prints a CC3
transaction hash, a Blockscout link, and the before/after `snapshot()` pair.

**Fallback:** if `verify` says the call would revert, do not broadcast. Open the pre-captured
successful allocation from the manifest instead and explain what the dry run caught. Catching it is
the feature.

### 5. Senior updates, then junior — BLOCKED (deployment)

The UI cascade. `SeniorAllocated` is emitted before `JuniorAllocated`, at a strictly lower log index,
and the interface renders that as two distinct beats.

**Fallback:** open the CC3 transaction on Blockscout and point at the two events in log-index order.
The ordering is on-chain; the animation is only a presentation of it.

### 6. Submit a malformed attestation — read-only half works today

```
npm run relayer -- verify   --proof fixtures/proof-2.json --corrupt continuity
npm run relayer -- allocate --proof fixtures/proof-2.json --corrupt continuity
```

Expected from `verify`, today, against the live precompile:

```
precompile verify   false
precompile revert   Continuity proof does not match attestation or checkpoint
```

Expected from `allocate` once deployed: a **reverted** CC3 transaction with a real hash, the decoded
`AttestationFailed` reason, the before/after `snapshot()` pair showing identical balances, and
finally, verbatim:

```
Attestation failed — balances held at prior state, no funds moved.
```

There is no retry, no spinner, and no ambiguous state on this path. The rejection is the point.

`continuity` is the default mode because its narration is the most honest: this is what a stale or
pruned attestation actually looks like. Say plainly that Attestcoin proofs do not expire, that age
raises gas cost rather than invalidating a proof, and that a genuinely pruned attestation fails
continuity verification on the identical code path. Do not claim a time-based expiry.

**Fallback:** if the reverted broadcast will not mine, run the `verify --corrupt continuity` dry run,
which needs no key and no gas, and open the pre-captured reverted transaction from the manifest.

### 7. Show the explicit rejection — BLOCKED (deployment)

The UI rejection beat, driven by the `rejection` object of the manifest cycle.

**Fallback:** the CLI output from step 6 plus the two `snapshot()` reads, side by side.

### 8. Close on the audit trail — BLOCKED (deployment)

The UI activity view, backed by `docs/evidence/transactions.json`.

**Fallback:** open `docs/evidence/judge-verification.md` and walk the contract table and cycle links
directly.

---

## The replay beat

Not one of the eight steps, but PRD §15 requires it as a judge moment. Resubmit the proof that was
already applied in step 4:

```
npm run relayer -- allocate --proof fixtures/proof-2.json
```

Expected: a reverted CC3 transaction decoding to `AttestationFailed(id, AlreadyApplied)`. The
attestation id is derived inside the contract from the proof's own Merkle path, so a relayer cannot
resubmit the same event under a fresh id.

---

## Afterwards

```
npm run relayer -- manifest
```

Rebuilds `docs/evidence/transactions.json` from `relayer/fixtures/journal.json` by re-reading every
recorded transaction from the chain. Nothing enters the manifest that was not read back from a real
receipt.

---

## Language discipline while presenting

- Invoice data is synthetic and on testnets. Say it in the same breath as the first number on screen.
- Allocation is an accounting entitlement against an attested repayment. It is not a transfer of
  repayment cash, and no value crosses from Sepolia to Creditcoin.
- The 6% / 18% split is one disclosed flat rule, not a credit-scoring engine.
- Tranching is not novel. The narrow claim is applying a senior/junior waterfall to an
  Attestcoin-attested cross-chain repayment event.
- Do not describe this as a fund, a securities offering, or a guaranteed return, and do not say it
  prevents anything.
