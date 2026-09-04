# Verifying TrancheTrade yourself

**Status: live.** All three contracts are deployed to their target chains, and a full live three-hop
cycle has run end to end: two successful cross-chain allocations, a deliberately corrupted-proof
rejection, and a replay-of-an-already-applied-attestation rejection. Every address, transaction hash,
and block number in this document comes straight from `docs/evidence/deployments.json` and
`docs/evidence/transactions.json`, which are themselves generated from real broadcasts, not written by
hand. Nothing in this file is invented; anything this file cannot support with a hash from those two
files is left honestly unlabeled rather than guessed at.

---

## 1. What to expect

TrancheTrade settles a trade-finance repayment across three chains. A repayment is recorded on
Ethereum Sepolia, that log is attested by the Attestcoin protocol, and the attestation is submitted
to a senior/junior waterfall contract on Creditcoin CC3 testnet, which allocates the attested amount
to the senior tranche first and the junior tranche second. A deliberately malformed attestation is
also submitted, and is rejected with no state change.

**All invoice data in this project is synthetic and lives on public testnets.** There is no real
invoice, no real obligor, and no real money. Allocation records an accounting entitlement against an
attested repayment; it does not transfer repayment cash. Read section 7 before drawing conclusions
about what this system does.

Everything below can be checked in a browser. The `cast` commands in section 6 are for anyone who
wants to read the chain directly instead of trusting this page.

---

## 2. Contracts

| Contract | Chain | Address | Explorer | Deploy tx |
|---|---|---|---|---|
| `InvoiceRegistry` | Ethereum Sepolia (11155111) | `0x049a7c970Bd1e35ff13C15e73F59FbfA690D3ae5` | [sepolia.etherscan.io](https://sepolia.etherscan.io/address/0x049a7c970Bd1e35ff13C15e73F59FbfA690D3ae5) | [`0x772cbd6c…378b907`](https://sepolia.etherscan.io/tx/0x772cbd6cf65a96d914d077b1d20022f9841fd14e5a2289d1882249daf378b907) (block 11633947) |
| `TrancheWaterfall` | Creditcoin CC3 testnet (102031) | `0x11ae52135180Cc0e76d28fbD6c9985393C291868` | [creditcoin-testnet.blockscout.com](https://creditcoin-testnet.blockscout.com/address/0x11ae52135180Cc0e76d28fbD6c9985393C291868) | [`0x4d3c0c02…e0e3bc21b`](https://creditcoin-testnet.blockscout.com/tx/0x4d3c0c02836070d16bb3559d44652a5e924381dd8d3d144d1a0ccade0e3bc21b) (block 5429427) |
| `AttestcoinVerifier` | Creditcoin CC3 testnet (102031) | `0x3b3dfc7609fA394EC268364Df0270444963428F1` | [creditcoin-testnet.blockscout.com](https://creditcoin-testnet.blockscout.com/address/0x3b3dfc7609fA394EC268364Df0270444963428F1) | [`0x576174b7…31763`](https://creditcoin-testnet.blockscout.com/tx/0x576174b70ec030fc3944f30f835e5a28569800c3db89b40a3a2fba0043131763) (block 5429427) |

All three deploys landed on 2026-09-04. `TrancheWaterfall` and `AttestcoinVerifier` share a deploy
block (5429427) because they were broadcast in the same deployment run. Deploy tx links above point
at the transaction hash on the same explorer as the address link; both come straight from
`docs/evidence/deployments.json`.

Source of truth: `docs/evidence/deployments.json` and `docs/evidence/transactions.json`.

### Protocol infrastructure you can check right now

These are Attestcoin and Creditcoin components, not ours, and they are live:

| Component | Address or URL |
|---|---|
| Block prover precompile (CC3 testnet) | `0x0000000000000000000000000000000000000FD2` |
| ChainInfo precompile (CC3 testnet) | `0x0000000000000000000000000000000000000fd3` |
| `EvmV1Decoder` (CC3 testnet) | [`0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f`](https://creditcoin-testnet.blockscout.com/address/0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f) |
| Proof generator API | `https://prover.cc3-testnet.creditcoin.network` |
| CC3 testnet RPC | `https://rpc.cc3-testnet.creditcoin.network` |
| CC3 testnet explorer | `https://creditcoin-testnet.blockscout.com` |

Ethereum Sepolia is `chainKey 1` inside Attestcoin, which is **not** its EVM chain id `11155111`.
You can confirm the mapping yourself:

```
npm run relayer -- chains
```

which reads `getSupportedChains()` from the ChainInfo precompile and prints, as of 2026-09-04:

```
chainKey 3    chainId 1          Ethereum (encoding 1)
chainKey 1    chainId 11155111   Sepolia ethereum (encoding 1)
```

---

## 3. Attestation cycles

Each cycle is a three-row walk. Rows are filled from `transactions.json`.

### Cycle 1 — first attested repayment, senior-only

| Step | What to look at | Link |
|---|---|---|
| 1. Sepolia repayment | `InvoiceRepaid`, block 11633974, log index 78, amount `2000000000000000000000` (2,000 tokens, 18 decimals) | [`0xb54cb83e…3494f18`](https://sepolia.etherscan.io/tx/0xb54cb83ecef6d7d3da44148e514337b9a9e387f49b666ab8d04282a2e3494f18) |
| 2. Attestation | attestation id `0x5450268582d542e8ace2f3243732feb8c580910f20920ac6743f6f4f62736db4`, attested height 11633974, 7 continuity hashes, fetched from `https://prover.cc3-testnet.creditcoin.network` | no explorer page — verify with `npm run relayer -- verify` against the live prover, as in section 4 |
| 3. CC3 allocation | `success`, gas used 179704. Senior outstanding moves 3180 → 1180 tokens; junior outstanding is untouched at 1180 tokens, because the full 2,000-token repayment is absorbed by the senior tranche alone | [`0xc2e49068…44c342`](https://creditcoin-testnet.blockscout.com/tx/0xc2e4906846f82edbccc7724197d106da2ae4d420ff4bd8c30464b0b92544c342) (block 5429481) |

Check that the `attestedAmount` in the CC3 allocation event equals the `amount` in the Sepolia
`InvoiceRepaid` event, exactly. Two explorer pages, one number.

### Cycle 2 — second, independent repayment, spills senior into junior

Same three rows, against the balances left by cycle 1. This is the two-beat waterfall cascade: the
remainder of the senior tranche closes out, and the rest overflows into the junior tranche, inside a
single CC3 transaction.

| Step | What to look at | Link |
|---|---|---|
| 1. Sepolia repayment | `InvoiceRepaid`, block 11634019, log index 217, amount `1500000000000000000000` (1,500 tokens) | [`0x3ac3a2eb…2eefa9`](https://sepolia.etherscan.io/tx/0x3ac3a2eb08bb64d4b7d27860769ac8558c16f5423ff623dd05b63ce30f2eefa9) |
| 2. Attestation | attestation id `0x90a78c69fd78d05ea50f905fec1b0f5d4103d1fd9183c51ffba9717bd67519d8`, attested height 11634019, 2 continuity hashes | no explorer page — verify against the live prover, as in section 4 |
| 3. CC3 allocation | `success`, gas used 179984. Senior outstanding closes 1180 → 0 tokens (`SeniorAllocated` 1,180 tokens), and the remaining 320 tokens spill into `JuniorAllocated`, moving junior outstanding 1180 → 860 tokens. Check on the explorer that the `SeniorAllocated` log has a **strictly lower log index** than `JuniorAllocated` in this same transaction | [`0x93f2afba…12487632`](https://creditcoin-testnet.blockscout.com/tx/0x93f2afba1b375d03f33a254ba24fadb0aa121cd824d4c69d491c777e12487632) (block 5429515) |

### Cycle 3 — deliberately malformed attestation

This cycle resubmits cycle 2's own Sepolia repayment (`0x3ac3a2eb…2eefa9`), but corrupts the
continuity proof (`corruptionMode: "continuity"`) before it reaches CC3.

| What | Value |
|---|---|
| Reverted CC3 transaction | [`0x01d6930b…526e327c4`](https://creditcoin-testnet.blockscout.com/tx/0x01d6930bca16481be5cada95f80b36b212e2cfb7881fbd3f45dc0c5526e327c4) (block 5429522, `reverted`, gas used 170562) |
| Decoded revert | `Error(string)`: `"Continuity proof does not match attestation or checkpoint"` — the corrupted proof is rejected by the Attestcoin verifier itself |
| Reason (`transactions.json`) | `VerifierReverted` |
| `snapshot()` before | senior outstanding 0, junior outstanding `860000000000000000000` (860 tokens) |
| `snapshot()` after | senior outstanding 0, junior outstanding `860000000000000000000` (860 tokens) |

The two snapshots are identical. If they were not, the fail-closed claim would be false.

The demo uses a **deliberately malformed** proof rather than an expired one. Attestcoin proofs do not
expire: age raises the gas cost of the continuity chain, not the validity of the proof. A genuinely
pruned or replaced attestation fails continuity verification and travels the **identical code path**
as a malformed proof. TrancheTrade does not enforce, and does not claim to enforce, a time-based
expiry.

### Cycle 4 — replay of an already-applied attestation

This cycle resubmits cycle 1's Sepolia repayment (`0xb54cb83e…3494f18`) and its already-applied
attestation id (`0x5450268582d542e8ace2f3243732feb8c580910f20920ac6743f6f4f62736db4`), attempting to
claim the same allocation twice.

| What | Value |
|---|---|
| Reverted CC3 transaction | [`0xb4f3872f…5aab797468b`](https://creditcoin-testnet.blockscout.com/tx/0xb4f3872f9c6a0f5e7967f6b5d3e10e71042266459a34a8d1ea87c5aab797468b) (block 5429523, `reverted`, gas used 174832) |
| Decoded revert | `AttestationFailed(bytes32,uint8)` with attestation id `0x5450268582d542e8ace2f3243732feb8c580910f20920ac6743f6f4f62736db4` and reason code `3` (`AlreadyApplied`) |
| `snapshot()` before | senior outstanding 0, junior outstanding `860000000000000000000` (860 tokens) |
| `snapshot()` after | senior outstanding 0, junior outstanding `860000000000000000000` (860 tokens) — identical, unchanged from cycle 3 |

The attestation id is derived inside the contract from the proof's own Merkle path, not supplied by
the relayer, so resubmitting the same source transaction under a fresh id is not possible.

---

## 4. What is already verifiable: the Attestcoin integration

Two real Attestcoin proofs were fetched from the live CC3 testnet prover and confirmed by the live
block prover precompile. They are committed at `docs/evidence/proofs/`.

| Fixture | Sepolia transaction | Block | txIndex | Merkle siblings | Continuity roots | Precompile `verify` |
|---|---|---|---|---|---|---|
| `spike-proof-1.json` | [`0x141b070c…5a076f`](https://sepolia.etherscan.io/tx/0x141b070c83989dc5e15f9aa33f73b1693cd4587277eded64f8f1b93a1b5a076f) | 11633495 | 5 | 7 | 6 | `true` |
| `spike-proof-2.json` | [`0x94961029…29ffcb`](https://sepolia.etherscan.io/tx/0x94961029146c5e99f8f4ce4c29ee63abc0728cf889782cbf28b153b10129ffcb) | 11633480 | 3 | 8 | 1 | `true` |

These prove the Attestcoin pipeline works. They are proofs of arbitrary Sepolia transactions, chosen
because they were in an already-attested block; they are **not** `InvoiceRepaid` proofs and are not
part of the demo narrative.

Reproduce either one:

```
export SEPOLIA_RPC_URL=<any Ethereum Sepolia JSON-RPC endpoint>
cd relayer && npm install
npm run relayer -- verify --proof ../docs/evidence/proofs/spike-proof-1.json
```

The output line `precompile verify   true` is a live read-only call to
`0x0000000000000000000000000000000000000FD2` on Creditcoin CC3 testnet. It needs no key, no gas, and
no deployed TrancheTrade contract.

Every corruption mode was also confirmed against the same live precompile:

| Mode | Live precompile response |
|---|---|
| `merkle-root` | reverts, `Merkle proof validation failed` |
| `sibling` | reverts, `Merkle proof validation failed` |
| `continuity` | reverts, `Continuity proof does not match attestation or checkpoint` |
| `tx-bytes` | reverts, `Merkle proof validation failed` |
| `chain-key` | reverts, `Continuity proof does not match attestation or checkpoint` |

```
npm run relayer -- verify --proof ../docs/evidence/proofs/spike-proof-1.json --corrupt continuity
```

---

## 5. Reading the manifest

`docs/evidence/transactions.json` is the machine-readable version of this page. Every hash in it is
real. Where a stage has not happened, the field is `null` and the adjacent `status` says which stage
is missing. `attestation.status` distinguishes `pending` from `failed`; they are never conflated.

---

## 6. Reproducing the balances yourself

`TrancheWaterfall` is deployed at `0x11ae52135180Cc0e76d28fbD6c9985393C291868` on Creditcoin CC3
testnet (chain id 102031). Read `snapshot()` directly at the block before and the block after any
allocation, rather than trusting this page:

```
export CC3=https://rpc.cc3-testnet.creditcoin.network
export WATERFALL=0x11ae52135180Cc0e76d28fbD6c9985393C291868

cast call $WATERFALL "snapshot()" --rpc-url $CC3 --block <blockNumber - 1>
cast call $WATERFALL "snapshot()" --rpc-url $CC3 --block <blockNumber>
```

For example, cycle 1's allocation landed in CC3 block 5429481 (see section 3), so
`--block 5429480` and `--block 5429481` should differ, and the difference should match cycle 1's
senior/junior outstanding figures above.

For the rejection cycle, both reads must return byte-identical data.

Decode a reverted transaction's revert data:

```
cast 4byte-decode <revertData from transactions.json>
```

The relayer does the same thing without Foundry:

```
npm run relayer -- snapshot --block <blockNumber>
```

Confirm the chain you are talking to before believing any of it:

```
cast chain-id --rpc-url $CC3          # must print 102031, not 102030
```

---

## 7. What this does not do

Stated plainly, because a limitation you find yourself is worth less to you than one we tell you.

- **The invoice data is synthetic.** `InvoiceRegistry` is a testnet contract holding invented
  invoices. There is no real production invoice source, no ERP integration, and no obligor.
- **There is no KYC and no investor eligibility check.** Anyone with a testnet key can deposit.
- **This is not a securities offering, a fund, or an investment contract**, and nothing here is a
  guaranteed return. It is a demonstration of a settlement mechanism on public testnets.
- **Allocation is an accounting entitlement, not a fund transfer.** The repayment happens on Sepolia.
  No value crosses to Creditcoin. An allocation reduces a tranche's outstanding entitlement and
  increases its claimed amount; it does not move CTC or any other asset.
- **The 6% / 18% senior/junior split is a single disclosed flat rule**, fixed at deploy time. It is
  not a credit-scoring engine, and no risk model produced those numbers.
- **Tranching is not novel.** Senior/junior waterfalls are decades old. The narrow claim here is
  applying one to an Attestcoin-attested, cross-chain trade-finance repayment event.
- **There is no time-based attestation expiry.** See cycle 3.
- **The relayer is untrusted and unprivileged**, which is a design property, not a security proof.
  The contracts are unaudited testnet code.
