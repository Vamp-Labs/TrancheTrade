# 02 — Invariant & Adversarial Test Engineer

**Project:** TrancheTrade — attestation-gated, risk-stratified trade-finance settlement layer
**Source of truth:** `docs/TrancheTrade_PRD.md` (v1.0). Read §12 and §16 in full; they are your spec.
**Deadline:** 2026-09-13 23:59 ET.
**You own:** `/contracts/test/**` and `docs/evidence/test-output/`.

You do not need to read any other handoff file. Everything you need is here.

---

## Why this role exists separately

PRD §12 states that the six invariants ship "as an actual Foundry property/fuzz test file, not deck
prose only — a screenshot of the passing suite is itself a deck asset." PRD Risk 4 states that
several competing submissions already show named invariants and fail-closed logic as baseline
evidence.

The invariant suite is the most frequently cited deliverable in the entire PRD: it appears in §12,
§14 Must-ship, §16, §17, Risk 4, and §24. It is the project's proof of correctness and its single
strongest evidence artifact.

It is owned by someone other than the contract author on purpose. You are the adversary. Your job is
to try to break `TrancheWaterfall`, not to confirm that it works.

---

## Responsibilities

- Prove INV-1 through INV-6 with Foundry unit, fuzz, and stateful invariant tests.
- Cover all eleven adversarial cases in PRD §16.
- Build the mock infrastructure that makes every negative path reachable.
- Capture the passing suite output as a committed deck asset.
- Report every failure you find to the PM with a minimal failing test as evidence. **You never fix
  `/contracts/src`.** That is the Contracts Engineer's file; a fix from you would break the
  independence that makes this suite credible.

---

## Scope

### In scope

- `/contracts/test/**` — every unit, fuzz, invariant, and fork test; every mock; every handler.
- `/contracts/test/mocks/**`
- `docs/evidence/test-output/**`
- `.github/workflows/contracts.yml` if you want CI (optional; local capture is sufficient).
- Reporting bugs, with a failing test, to the PM.

### Out of scope

- `/contracts/src/**` and `/contracts/script/**` — the Contracts Engineer owns these. **Do not edit
  them, not even to fix a bug you found, not even a one-line fix.** Report instead.
- `/contracts/foundry.toml` — owned by Contracts. If you need a fuzz-runs or invariant-depth change,
  request it from the PM.
- `/relayer/**`, `/web/**`.
- `docs/evidence/deployments.json`, `abi/`, `transactions.json`, `judge-verification.md`, `runbook.md`.
- Deploying anything to a live network. Your fork tests read; they never broadcast.

---

## Objectives

1. Every one of INV-1..INV-6 has at least one **stateful invariant test** (`invariant_*`) and at
   least one **fuzz test**, not just a unit test. A unit test proves one case; the PRD's claim is
   universal.
2. All eleven PRD §16 adversarial cases have a named, failing-if-broken test.
3. `forge test` output is captured to `docs/evidence/test-output/` in a form a judge can read
   without running anything.
4. Any invariant violation is found by you before a judge finds it.

---

## Requirements

### R-1 — Test layout

```
/contracts/test
  TrancheWaterfall.unit.t.sol
  TrancheWaterfall.fuzz.t.sol
  TrancheWaterfall.invariant.t.sol
  TrancheWaterfall.adversarial.t.sol
  InvoiceRegistry.t.sol
  AttestcoinVerifier.fork.t.sol
  handlers/
    WaterfallHandler.sol
  mocks/
    MockAttestationVerifier.sol
    RevertingVerifier.sol
    ReentrantVerifier.sol
```

Name every test after the invariant or case it protects. PRD §16 says verbatim: "Test quality
matters more than an arbitrary test count. Every test protects a specific named invariant (§12) or a
specific demo path (§15)." A test whose name does not say what it protects should not exist.

Naming convention, used consistently:

```
test_INV1_juniorAllocationRequiresSeniorExhausted()
testFuzz_INV6_conservationHoldsForAnyAmount(uint256 amount)
invariant_INV2_juniorNeverDecreasesWhileSeniorOutstanding()
test_Case07_replayedAttestationIdIsRejected()
```

### R-2 — The interface you test against

`TrancheWaterfall` holds an immutable `IAttestationVerifier` and calls exactly one function on it.
That is the seam that makes every negative path testable.

```solidity
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

The surface under test:

```solidity
uint256 public constant TRANCHE_COUNT = 2;
uint256 public constant SENIOR_RATE_BPS = 10600;
uint256 public constant JUNIOR_RATE_BPS = 11800;

uint256 public immutable SENIOR_CAP;
uint256 public immutable JUNIOR_CAP;
uint64  public immutable MIN_SOURCE_HEIGHT;
IAttestationVerifier public immutable VERIFIER;

uint256 public seniorOutstanding;
uint256 public juniorOutstanding;
uint256 public seniorPrincipal;
uint256 public juniorPrincipal;
uint256 public seniorAllocatedTotal;
uint256 public juniorAllocatedTotal;
mapping(address => uint256) public seniorPositionOf;
mapping(address => uint256) public juniorPositionOf;
mapping(bytes32 => bool) public appliedAttestations;

function deposit(Tranche tranche) external payable;
function allocate(RepaymentProof calldata proof) external;
function snapshot() external view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256);
function positionOf(address) external view returns (uint256, uint256);

enum Tranche { Senior, Junior }
enum RejectionReason { InvalidProof, ExpiredProof, StaleProof, AlreadyApplied, AmountZero, ExceedsOutstanding }

error AttestationFailed(bytes32 attestationId, RejectionReason reason);
error RepaymentExceedsOutstanding(uint256 attestedAmount, uint256 totalOutstanding);
error TrancheCapExceeded(Tranche tranche, uint256 cap, uint256 attempted);

event Deposited(address indexed investor, Tranche indexed tranche, uint256 principal, uint256 entitlement);
event SeniorAllocated(bytes32 indexed attestationId, uint256 amount, uint256 seniorOutstandingAfter);
event JuniorAllocated(bytes32 indexed attestationId, uint256 amount, uint256 juniorOutstandingAfter);
event RepaymentAllocated(bytes32 indexed attestationId, uint256 indexed invoiceId, uint256 attestedAmount, uint256 seniorAllocation, uint256 juniorAllocation);
```

Read the actual source in `/contracts/src` before writing tests; if the deployed shape differs from
this, the source wins and you report the divergence to the PM.

### R-3 — Mocks

**`MockAttestationVerifier`** — implements `IAttestationVerifier` as a programmable `view` function.
A test sets the `AttestedRepayment` it should return, keyed by the proof bytes or by a stored slot,
then calls `allocate`. This is how you drive the happy path and every amount/id combination without
touching Attestcoin.

**`RevertingVerifier`** — reverts on every call, with a configurable revert selector so you can
simulate: an invalid Merkle proof, a failed continuity proof (this is the *expired* case — see
below), an unsuccessful source receipt, and a panic/out-of-gas. This is your INV-3 instrument.

**`ReentrantVerifier`** — attempts to call back into `TrancheWaterfall.allocate` from inside
`verifyRepayment`. Because `verifyRepayment` is declared `view`, the EVM enters it via `STATICCALL`
and any re-entrant state write reverts. Your test asserts that the whole transaction reverts and
that `snapshot()` is unchanged. This makes PRD §16 case 11 provable rather than argued.

### R-4 — A note on the "expired proof" case, so you do not test a fiction

Attestcoin proofs **do not expire**. Verified against the Attestcoin documentation: age raises gas
cost (attestations are pruned into sparser checkpoints after roughly 24 hours, lengthening the
continuity proof) but does not invalidate a proof. There is no timestamp expiry to test.

The genuine expiry mode is a continuity proof whose anchoring attestation has been pruned or
replaced, which fails continuity verification inside the precompile and reverts — the **identical
code path** as an invalid proof. PRD §22.4 asserts exactly this, and it is true.

So:

- `test_Case05_expiredProofIsRejected()` uses `RevertingVerifier` configured with a continuity
  failure, asserts the full revert and unchanged state, and is a **separate named test** from
  `test_Case04_invalidProofIsRejected()` even though both travel the same path. The PRD asks for
  both cases; naming them separately is what makes the coverage legible.
- Additionally test the one real staleness guard the contract does enforce:
  `test_StaleProofBelowMinSourceHeightIsRejected()` — a proof whose `sourceHeight` precedes the
  Sepolia block in which `InvoiceRegistry` was deployed reverts with
  `AttestationFailed(id, RejectionReason.StaleProof)`.
- **Do not write a test that asserts a wall-clock `MAX_PROOF_AGE`.** No such rule exists, and
  asserting one would be evidence of a mechanism the protocol does not have.

### R-5 — The six invariants

Each needs a unit test, a fuzz test, and a stateful `invariant_` test.

**INV-1 — Waterfall Order.** On any attested repayment event, the contract allocates to
`seniorOutstanding` first; a nonzero junior allocation is impossible unless `seniorOutstanding == 0`
after that allocation.

- Unit: repayment < senior outstanding → junior allocation is exactly 0, `juniorOutstanding`
  unchanged.
- Unit: repayment > senior outstanding → `seniorOutstanding == 0` after, junior receives exactly the
  remainder.
- Fuzz: for any `amount` and any reachable pre-state, if `juniorAllocation > 0` then
  `seniorOutstanding == 0` post-call.
- Invariant: across a random sequence of deposits and allocations, `juniorAllocatedTotal > 0`
  implies `seniorOutstanding == 0`.
- Event ordering: use `vm.recordLogs()` and assert `SeniorAllocated` appears at a strictly lower log
  index than `JuniorAllocated` in every successful allocation. **This assertion is a product
  requirement, not a style check** — PRD Feature 5's two distinct visual beats are derived from this
  ordering by the frontend. Assert it in at least one test that a reviewer can find by name.

**INV-2 — No Junior Skip-Ahead.** `juniorOutstanding` cannot decrease in the same transaction where
`seniorOutstanding > 0` both before and after senior allocation.

- Invariant: snapshot `seniorOutstanding` and `juniorOutstanding` before each handler call and
  compare after. If senior was positive before and is still positive after, junior must be equal.
- Fuzz over pre-states where `seniorOutstanding` is deliberately large relative to the amount.

**INV-3 — Fail-Closed on Attestation Failure.** A reverted, timed-out, or invalid attestation call
writes to neither tranche and leaves state exactly at its pre-call value.

- Capture the full `snapshot()` tuple plus both position mappings before the call; assert every
  field is byte-identical after the reverted call.
- Cover four distinct failure shapes with `RevertingVerifier`: revert with custom error, revert with
  a string reason, revert with empty return data, and an out-of-gas / panic. A `try/catch` in the
  source would swallow at least one of these and this is how you would catch it.
- Assert `appliedAttestations[id] == false` after a failed call — a failed attempt must not consume
  the id.
- Invariant: a handler that randomly injects verification failures never changes state on those
  calls.

**INV-4 — Replay Protection.** Each attestation ID can be applied at most once.

- Unit: apply, then reapply the identical proof → `AttestationFailed(id, AlreadyApplied)`.
- Unit: two *different* source transactions producing different ids both succeed.
- Fuzz: from a set of N ids with duplicates in random order, the number of successful allocations
  equals the number of distinct ids.
- Invariant: `appliedAttestations` never transitions from `true` back to `false`.

**INV-5 — Two-Tranche Cap, Enforced in Code.** The tranche count is an immutable constant fixed at
deploy time to exactly 2.

- Assert `TRANCHE_COUNT == 2`.
- Assert there is no ABI entry that could change it: read `out/TrancheWaterfall.sol/TrancheWaterfall.json`
  with `vm.readFile` and assert no function in the ABI is non-`view`/non-`pure` and takes a tranche
  count, and that no function name matches a setter pattern. Alternatively assert the full set of
  state-mutating external function selectors equals exactly `{deposit, allocate}`. **Do this
  selector-set assertion — it is the strongest available proof of INV-5 and it also catches an
  accidental admin function being added later.**
- Adversarial: `Tranche` is a two-member enum; calling `deposit` with an out-of-range enum value
  reverts at the ABI decoder. Prove it with a low-level `call` carrying `abi.encodeWithSelector(sel, uint8(2))`
  and assert failure. This is PRD §16 case 10.

**INV-6 — Conservation.** For any single attested repayment event,
`seniorAllocation + juniorAllocation` exactly equals the attested repayment amount.

- Fuzz across the full `uint256` amount range, bounded to reachable values, plus targeted boundary
  values: `0`, `1`, `seniorOutstanding - 1`, `seniorOutstanding`, `seniorOutstanding + 1`,
  `seniorOutstanding + juniorOutstanding`, `seniorOutstanding + juniorOutstanding + 1`.
- Assert the `RepaymentAllocated` event's `seniorAllocation + juniorAllocation == attestedAmount`.
- Assert the delta form too: `(seniorOutstandingBefore - seniorOutstandingAfter) +
  (juniorOutstandingBefore - juniorOutstandingAfter) == attestedAmount`. Two independent
  formulations catch a bookkeeping bug that a single one would miss.
- Invariant: `seniorAllocatedTotal + juniorAllocatedTotal == sum of all attested amounts applied`,
  tracked by the handler as a ghost variable.
- Boundary: `amount == seniorOutstanding + juniorOutstanding + 1` must revert with
  `RepaymentExceedsOutstanding`, leaving state unchanged. This is the deliberate design decision
  that keeps INV-6 true verbatim rather than introducing a surplus bucket; test it explicitly so the
  choice is visible in the suite.

### R-6 — PRD §16 adversarial cases, one named test each

| # | Case | Test name |
|---|---|---|
| 1 | Valid repayment allocates fully to senior when senior outstanding exceeds the amount | `test_Case01_fullAllocationToSeniorWhenSeniorExceedsRepayment` |
| 2 | Valid repayment exceeding senior outstanding sends the remainder to junior in the same transaction, in strict order | `test_Case02_remainderCascadesToJuniorInSameTransaction` |
| 3 | A second independent valid repayment allocates correctly against the updated state | `test_Case03_sequentialRepaymentAgainstUpdatedState` |
| 4 | Invalid proof rejected, no balance changes | `test_Case04_invalidProofIsRejected` |
| 5 | Expired proof rejected, no balance changes | `test_Case05_expiredProofIsRejected` |
| 6 | Timed-out attestation call reverts the whole transaction, no partial write | `test_Case06_timedOutVerificationRevertsEntirely` |
| 7 | Replayed attestation id rejected | `test_Case07_replayedAttestationIdIsRejected` |
| 8 | Allocating to junior before senior is exhausted is rejected | `test_Case08_juniorBeforeSeniorExhaustedIsImpossible` |
| 9 | Fuzzed random amounts and pre-states always satisfy conservation | `testFuzz_Case09_conservationUnderRandomAmountsAndPreStates` |
| 10 | Configuring a third tranche at runtime is impossible | `test_Case10_thirdTrancheIsUnreachable` |
| 11 | Reentrancy cannot apply a single attestation more than once | `test_Case11_reentrancyCannotDoubleApply` |

Notes on the harder ones:

- **Case 6** (timeout): an on-chain call has no wall-clock timeout; the EVM equivalent is the
  verification call consuming all forwarded gas and failing. Model it with a `RevertingVerifier`
  variant that burns gas in an unbounded loop, invoke `allocate` with a bounded gas stipend, and
  assert the transaction reverts and state is unchanged. Name the test so a reader understands the
  mapping; do not silently substitute a plain revert and call it a timeout.
- **Case 8**: there is no function that allocates to junior directly, so the honest test asserts
  *unreachability*: enumerate the contract's state-mutating external selectors and assert none
  writes `juniorOutstanding` without first satisfying the senior branch, plus a fuzz test that no
  reachable sequence produces a junior decrease while senior is positive. State plainly in the test
  name that this is an unreachability proof.
- **Case 11**: with `verifyRepayment` declared `view`, the callback runs under `STATICCALL` and
  cannot write. Assert that `ReentrantVerifier` causes the outer transaction to revert and that
  `appliedAttestations` records at most one application. Also assert the `nonReentrant` guard exists
  by attempting reentry through any other reachable path.

### R-7 — Stateful invariant handler

`handlers/WaterfallHandler.sol` bounds and drives the fuzzer:

- Actions: `depositSenior(uint256)`, `depositJunior(uint256)`, `allocateValid(uint256 amount, uint256 idSeed)`, `allocateReplay(uint256 idSeed)`, `allocateFailing(uint8 failureMode)`.
- Bound deposits to the remaining cap so the sequence does not degenerate into all-reverts.
- Ghost variables: `ghost_totalAttestedApplied`, `ghost_appliedIdCount`, `ghost_maxSeniorOutstandingSeen`.
- `targetContract(address(handler))` and `targetSelector` so the fuzzer only calls the handler.
- Set `fail_on_revert = false` in the invariant profile (already configured), and additionally
  assert a meaningful **call-success ratio** in an `afterInvariant` hook — an invariant suite where
  99% of calls revert proves nothing, and this is the standard way that suite silently rots.

### R-8 — `InvoiceRegistry` tests

Lighter, but not skipped:

- `issueInvoice` assigns sequential ids and emits exactly one `InvoiceIssued`.
- `repayInvoice` emits **exactly one** `InvoiceRepaid` per transaction. This is load-bearing: the
  attestation id is derived per source transaction, so two repayment logs in one transaction would
  make the second permanently unapplicable. Assert the log count is 1 with `vm.recordLogs()`.
- `repayInvoice` on a nonexistent invoice reverts.
- The contract has no owner and no access-controlled function.

### R-9 — Fork test for the real verifier (best effort)

`AttestcoinVerifier.fork.t.sol`, run with `--fork-url https://rpc.cc3-testnet.creditcoin.network`:

- Assert the block prover precompile at `0x0000000000000000000000000000000000000FD2` is present.
  **Precompiles report `extcodesize == 0`,** so the usual `code.length > 0` check may behave
  unexpectedly — use the `NativeQueryVerifierLib.hasPrecompile()` pattern from
  `@gluwa/asc-contracts` and, if it is ambiguous on a fork, assert on a successful `staticcall`
  return instead.
- Replay one real proof captured by the Integration Engineer (they will provide a JSON fixture) and
  assert `AttestcoinVerifier.verifyRepayment` returns the expected invoice id and amount.
- Assert a byte-mutated copy of that same proof reverts.

This test is allowed to be skipped with `vm.skip(true)` and a clear name if the fork RPC is
unavailable, so it never blocks the main suite. It must not be silently deleted.

### R-10 — Evidence capture

Write to `docs/evidence/test-output/`:

- `forge-test.txt` — full output of `forge test -vv`, including the fuzz and invariant run counts.
- `forge-test-summary.txt` — output of `forge test --summary`, which is the readable artifact for
  the deck.
- `gas-report.txt` — `forge test --gas-report`.
- `coverage.txt` — `forge coverage --report summary` for `src/`.
- `invariant-config.txt` — the exact `[fuzz]` and `[invariant]` settings the run used, so a reader
  knows `runs = 10000` was real.
- `README.md` — a one-page table mapping each of INV-1..INV-6 and each §16 case to its test name and
  its pass status, with the command used to reproduce and the commit SHA.

The captured output must come from a real run on the committed code. **Never hand-edit test output.
Never present a run that included a skipped or filtered test as a full-suite pass.**

---

## Dependencies

| You need | From | When |
|---|---|---|
| Frozen interfaces (`IAttestationVerifier`, `ITrancheWaterfall`) and `/contracts/src` compiling | Contracts Engineer | End of Day 2 — you start when this lands |
| A committed ABI at `docs/evidence/abi/TrancheWaterfall.json` | Contracts Engineer | End of Day 2, for the selector-set assertion |
| One real captured proof fixture (JSON) for the fork test | Integration Engineer, via PM | Day 5, best effort |

| Others need from you | Who | When |
|---|---|---|
| First red/green signal on the waterfall | Contracts Engineer, via PM | Day 4 |
| Full green suite + captured output | PM, and the deck | End of Day 7 |

---

## Constraints

### Standing rules

- **English everywhere.** Identifiers, strings, docs, commit messages.
- **No comments in code.** This includes Solidity tests: no `//`, no `/* */`, no NatSpec. Test names
  are the documentation — that is why the naming convention in R-1 is mandatory. The sole exception
  is scaffolding the user has explicitly framed as temporary, which gets exactly one line:
  `// TEMPORARY — <what it is>; delete with <what to remove>`.
- **No new dependency without asking.** `forge-std` is pre-approved. Anything else: ask the PM.
- **Never read, write, or echo `.env*` files or secrets.**
- **Never run `git commit`, `git push`, or any destructive git command unless the user asks.** Never
  `git add -A` or `git add .` — stage explicit paths.
- **Never broadcast a transaction.** Fork tests read only. No `--broadcast`, ever.
- **Never claim a passing run you did not produce.** Fabricated test output is a disqualifying
  failure for this project.

### Testing constraints

- Never edit `/contracts/src` or `/contracts/script`. Report bugs with a failing test.
- Never weaken a test to make it pass. If a test is correct and the contract is wrong, the test
  stays red and you escalate.
- Never use `vm.assume` so aggressively that the fuzzer explores nothing. Prefer `bound()`.
- Never mark a test `vm.skip` except the fork test in R-9, and only with a name that says why.
- A test that asserts "no revert" and nothing else does not count as coverage of anything.
- Every `invariant_` function must have a corresponding handler action that can actually reach the
  state it claims to protect. Verify this by deliberately introducing a local, uncommitted bug in a
  scratch copy and confirming the invariant catches it. This is the only way to know your suite has
  teeth. Do not commit the deliberate bug.

---

## Deliverables

1. `/contracts/test/` — the full suite as laid out in R-1.
2. Unit + fuzz + stateful invariant coverage for each of INV-1 through INV-6.
3. One named test for each of the eleven PRD §16 adversarial cases, using the names in R-6.
4. `handlers/WaterfallHandler.sol` with ghost variables and a call-success-ratio assertion.
5. `mocks/{MockAttestationVerifier,RevertingVerifier,ReentrantVerifier}.sol`.
6. `docs/evidence/test-output/` with all six artifacts named in R-10.
7. A written report to the PM listing every bug found, its severity, and whether it was fixed.

---

## Acceptance criteria

- [ ] `forge test` passes with zero failures and zero skipped tests, except at most the single fork
      test in R-9, which if skipped is named so the reason is obvious.
- [ ] Each of INV-1, INV-2, INV-3, INV-4, INV-5, INV-6 has at least one `test_INV*`, one
      `testFuzz_INV*`, and one `invariant_INV*` function. `grep -c` on the test directory confirms
      all eighteen exist.
- [ ] Each of the eleven `test_CaseNN_*` names from R-6 exists and passes.
- [ ] `docs/evidence/test-output/README.md` maps every invariant and every §16 case to a test name
      and a pass status, and names the commit SHA the run came from.
- [ ] `docs/evidence/test-output/forge-test.txt` shows a fuzz `runs` count of at least 10000 and an
      invariant `runs`/`depth` of at least 512/64.
- [ ] The INV-3 test asserts the **complete** pre-call state — all eight `snapshot()` fields plus
      both position mappings plus `appliedAttestations[id]` — is byte-identical after the reverted
      call. Asserting only two balances does not satisfy this.
- [ ] The INV-3 suite covers four distinct failure shapes: custom-error revert, string revert, empty
      revert data, and gas exhaustion.
- [ ] The INV-1 suite includes an explicit `vm.recordLogs()` assertion that `SeniorAllocated`
      precedes `JuniorAllocated` in log index, and that both are present when the junior allocation
      is zero.
- [ ] The INV-5 suite asserts the exact set of state-mutating external function selectors on
      `TrancheWaterfall` equals `{deposit, allocate}`.
- [ ] The INV-6 suite tests all seven boundary amounts listed in R-5 and asserts conservation in
      both the event form and the balance-delta form.
- [ ] `test_Case11_reentrancyCannotDoubleApply` uses a verifier that genuinely attempts reentry, and
      asserts at most one application recorded.
- [ ] `test_Case05_expiredProofIsRejected` does **not** assert a wall-clock expiry window; it models
      a pruned-attestation continuity failure. No test anywhere references a `MAX_PROOF_AGE`.
- [ ] `InvoiceRegistry` tests assert exactly one `InvoiceRepaid` log per `repayInvoice` transaction.
- [ ] `afterInvariant` asserts a call-success ratio, so a degenerate all-reverting fuzz run fails
      loudly instead of passing silently.
- [ ] `grep -rn "//" /contracts/test` returns nothing other than `// TEMPORARY —` lines explicitly
      sanctioned by the user.
- [ ] No file under `/contracts/src` or `/contracts/script` was modified by this role. `git diff`
      against those paths is empty for your commits.
