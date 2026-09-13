# TrancheTrade Contracts

Foundry project for the three contracts behind TrancheTrade's waterfall.

| Contract | Chain | Role |
|---|---|---|
| `InvoiceRegistry.sol` | Ethereum Sepolia | Emits real `InvoiceIssued` / `InvoiceRepaid` events for a synthetic/testnet invoice |
| `AttestcoinVerifier.sol` | Creditcoin CC3 testnet | Verifies an Attestcoin proof against the live block-prover precompile before any state write |
| `TrancheWaterfall.sol` | Creditcoin CC3 testnet | Allocates an attested repayment to the senior tranche first, junior second; enforces INV-1..INV-6 |

## Requirements

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`)
- `solc 0.8.24` (managed automatically by Foundry)

## Build and test

```bash
forge build
forge test          # 36/36 passing: 27 unit tests + 9 fuzz properties (10,000 runs each)
forge test -vvv      # verbose — see each invariant assertion fire
```

Fuzz runs are configured in `foundry.toml` (`[fuzz] runs = 10000`). Every fuzz test targets one
named invariant from `docs/TrancheTrade_PRD.md` §12: `testFuzz_INV1_…` through
`testFuzz_INV6_…`, plus two supporting properties (`testFuzz_sequentialAllocationsNeverExceedTotalEntitlement`,
`testFuzz_depositEntitlementNeverExceedsCapDerivedCeiling`).

## The six invariants

| # | Name | What it guarantees |
|---|---|---|
| INV-1 | Waterfall order | A nonzero junior allocation is impossible unless senior is fully exhausted in the same event |
| INV-2 | No junior skip-ahead | `juniorOutstanding` cannot decrease while `seniorOutstanding > 0` both before and after |
| INV-3 | Fail-closed | A reverted, invalid, or malformed attestation writes to neither tranche; state is bit-for-bit unchanged |
| INV-4 | Replay protection | Each attestation id can be applied at most once |
| INV-5 | Immutable two-tranche cap | Tranche count is fixed at exactly 2, set at deploy time, with no mutating accessor |
| INV-6 | Conservation | `seniorAllocation + juniorAllocation` exactly equals the attested repayment amount, for every event |

## Deploy scripts

| Script | Target | Effect |
|---|---|---|
| `script/DeploySepolia.s.sol` | Ethereum Sepolia | Deploys `InvoiceRegistry` |
| `script/DeployCreditcoin.s.sol` | Creditcoin CC3 testnet | Deploys `AttestcoinVerifier` and `TrancheWaterfall` |
| `script/SeedSepoliaInvoice.s.sol` | Ethereum Sepolia | Issues a synthetic invoice for the demo flow |

```bash
forge script script/DeploySepolia.s.sol --rpc-url sepolia --broadcast --verify
forge script script/DeployCreditcoin.s.sol --rpc-url creditcoin --broadcast
```

RPC endpoints are configured in `foundry.toml` under `[rpc_endpoints]`; `SEPOLIA_RPC_URL` is read
from the environment.

## Reading deployed state without a key

```bash
export CC3=https://rpc.cc3-testnet.creditcoin.network
export WATERFALL=0x11ae52135180Cc0e76d28fbD6c9985393C291868

cast call $WATERFALL "snapshot()" --rpc-url $CC3
cast chain-id --rpc-url $CC3   # must print 102031, not 102030
```

Full deployed addresses, deploy transaction hashes, and reproduction commands for the live
attestation cycles are in [`../docs/evidence/judge-verification.md`](../docs/evidence/judge-verification.md).

## Test file map

- `test/TrancheWaterfall.unit.t.sol` — 27 unit tests, deterministic, one assertion per named
  invariant or a specific PRD acceptance criterion.
- `test/TrancheWaterfall.fuzz.t.sol` — 9 fuzz properties, each targeting a named invariant across
  a wide input space.
- `test/handlers`, `test/mocks`, `test/helpers`, `test/fixtures` — shared test infrastructure; no
  test assertions live here.
