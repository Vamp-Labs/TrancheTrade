pragma solidity 0.8.24;

import {Vm} from "forge-std/Vm.sol";

import {TrancheWaterfall} from "../src/TrancheWaterfall.sol";
import {IAttestationVerifier, RepaymentProof} from "../src/interfaces/IAttestationVerifier.sol";
import {Tranche, RepaymentExceedsOutstanding} from "../src/interfaces/ITrancheWaterfall.sol";

import {WaterfallTestBase} from "./helpers/WaterfallTestBase.sol";
import {AbiIntrospection} from "./helpers/AbiIntrospection.sol";
import {ProofBuilder} from "./helpers/ProofBuilder.sol";
import {FullState} from "./helpers/WaterfallState.sol";
import {MockAttestationVerifier} from "./mocks/MockAttestationVerifier.sol";
import {RevertingVerifier} from "./mocks/RevertingVerifier.sol";
import {VerifierFailureMode, RevertShapes} from "./mocks/VerifierFailureMode.sol";

contract TrancheWaterfallFuzzTest is WaterfallTestBase {
    string internal constant ARTIFACT_PATH = "out/TrancheWaterfall.sol/TrancheWaterfall.json";

    function testFuzz_INV1_nonzeroJuniorAllocationImpliesSeniorExhausted(
        uint256 seniorPrincipal,
        uint256 juniorPrincipal,
        uint256 amountSeed,
        uint256 idSeed
    ) public {
        (uint256 senior, uint256 junior) = _seedBounded(seniorPrincipal, juniorPrincipal);
        uint256 amount = bound(amountSeed, 1, senior + junior);

        uint256 juniorBefore = waterfall.juniorOutstanding();
        _allocate(keccak256(abi.encode("inv1", idSeed)), amount);

        uint256 juniorAllocation = juniorBefore - waterfall.juniorOutstanding();
        if (juniorAllocation > 0) {
            assertEq(
                waterfall.seniorOutstanding(),
                0,
                "junior received value while senior was still outstanding"
            );
        }
        assertEq(waterfall.juniorAllocatedTotal(), juniorAllocation);
    }

    function testFuzz_INV2_juniorUnchangedWhenSeniorStaysOutstanding(
        uint256 seniorPrincipal,
        uint256 juniorPrincipal,
        uint256 amountSeed,
        uint256 idSeed
    ) public {
        (uint256 senior,) = _seedBounded(seniorPrincipal, juniorPrincipal);

        uint256 amount = bound(amountSeed, 1, senior);
        uint256 seniorBefore = waterfall.seniorOutstanding();
        uint256 juniorBefore = waterfall.juniorOutstanding();

        _allocate(keccak256(abi.encode("inv2", idSeed)), amount);

        uint256 seniorAfter = waterfall.seniorOutstanding();
        if (seniorBefore > 0 && seniorAfter > 0) {
            assertEq(
                waterfall.juniorOutstanding(), juniorBefore, "junior skipped ahead of senior"
            );
        }
    }

    function testFuzz_INV3_anyVerifierFailureLeavesCompleteStateUnchanged(
        uint256 seniorPrincipal,
        uint256 juniorPrincipal,
        uint8 failureSeed,
        uint256 amountSeed,
        uint256 idSeed
    ) public {
        (uint256 senior, uint256 junior) = _seedBounded(seniorPrincipal, juniorPrincipal);

        VerifierFailureMode mode = VerifierFailureMode(
            bound(failureSeed, RevertShapes.LOWEST_REVERTING_MODE, RevertShapes.HIGHEST_CHEAP_REVERTING_MODE)
        );
        RevertingVerifier revertingVerifier = new RevertingVerifier(mode);
        vm.etch(address(verifier), address(revertingVerifier).code);
        RevertingVerifier(address(verifier)).setFailureMode(mode);

        bytes32 attestationId = keccak256(abi.encode("inv3", idSeed));
        uint256 amount = bound(amountSeed, 1, senior + junior);
        FullState memory before = _captureFullState(attestationId);

        vm.prank(RELAYER);
        (bool succeeded,) = address(waterfall).call(
            abi.encodeCall(TrancheWaterfall.allocate, (_proof(attestationId, amount)))
        );

        assertFalse(succeeded, "verification failure must revert the allocation");
        _assertFullStateUnchanged(before, attestationId);
    }

    function testFuzz_INV4_successfulAllocationCountEqualsDistinctAttestationIdCount(
        uint8 idCount,
        uint256 idSeed,
        uint256 duplicateSeed
    ) public {
        _seedPool(SENIOR_CAP / 2, JUNIOR_CAP / 2);

        uint256 count = bound(idCount, 2, 12);
        bytes32[] memory ids = new bytes32[](count);
        uint256 distinctCount;

        for (uint256 i; i < count; ++i) {
            bool duplicate = i > 0 && (uint256(keccak256(abi.encode(duplicateSeed, i))) % 2 == 0);
            ids[i] = duplicate
                ? ids[uint256(keccak256(abi.encode(idSeed, i))) % i]
                : keccak256(abi.encode("inv4", idSeed, i));
        }

        for (uint256 i; i < count; ++i) {
            bool seenBefore;
            for (uint256 j; j < i; ++j) {
                if (ids[j] == ids[i]) seenBefore = true;
            }
            if (!seenBefore) ++distinctCount;
        }

        uint256 successes;
        for (uint256 i; i < count; ++i) {
            vm.prank(RELAYER);
            try waterfall.allocate(_proof(ids[i], 1 ether)) {
                ++successes;
            } catch {}
        }

        assertEq(successes, distinctCount, "applied allocations must equal distinct attestation ids");
    }

    function testFuzz_INV5_noCalldataEncodingReachesAThirdTranche(uint8 trancheByte, uint96 value)
        public
    {
        uint256 principal = bound(value, 1, 1 ether);
        uint256 outOfRangeTranche = bound(trancheByte, 2, type(uint8).max);
        vm.deal(MIXED_INVESTOR, principal);

        vm.prank(MIXED_INVESTOR);
        (bool succeeded,) = address(waterfall).call{value: principal}(
            abi.encodeWithSelector(TrancheWaterfall.deposit.selector, outOfRangeTranche)
        );

        assertFalse(succeeded, "an out-of-range tranche value must not decode");
        assertEq(waterfall.TRANCHE_COUNT(), 2);
        assertEq(waterfall.seniorPrincipal(), 0);
        assertEq(waterfall.juniorPrincipal(), 0);
    }

    function testFuzz_INV6_conservationHoldsForAnyAmount(
        uint256 seniorPrincipal,
        uint256 juniorPrincipal,
        uint256 amountSeed,
        uint256 idSeed
    ) public {
        (uint256 senior, uint256 junior) = _seedBounded(seniorPrincipal, juniorPrincipal);
        uint256 amount = bound(amountSeed, 1, senior + junior);

        uint256 seniorBefore = waterfall.seniorOutstanding();
        uint256 juniorBefore = waterfall.juniorOutstanding();

        vm.recordLogs();
        _allocate(keccak256(abi.encode("inv6", idSeed)), amount);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        (uint256 index, uint256 count) = _logIndexOfTopic(logs, REPAYMENT_ALLOCATED_TOPIC);
        assertEq(count, 1);

        (uint256 attestedAmount, uint256 seniorAllocation, uint256 juniorAllocation) =
            abi.decode(logs[index].data, (uint256, uint256, uint256));

        assertEq(attestedAmount, amount);
        assertEq(seniorAllocation + juniorAllocation, attestedAmount, "event conservation violated");

        uint256 seniorDelta = seniorBefore - waterfall.seniorOutstanding();
        uint256 juniorDelta = juniorBefore - waterfall.juniorOutstanding();
        assertEq(seniorDelta + juniorDelta, amount, "balance-delta conservation violated");
        assertEq(seniorDelta, seniorAllocation);
        assertEq(juniorDelta, juniorAllocation);
        assertEq(
            waterfall.seniorAllocatedTotal() + waterfall.juniorAllocatedTotal(),
            amount,
            "running allocated totals disagree with the attested amount"
        );
    }

    function testFuzz_INV6_anyAmountAboveTotalOutstandingRevertsAndLeavesStateUnchanged(
        uint256 seniorPrincipal,
        uint256 juniorPrincipal,
        uint256 overshootSeed,
        uint256 idSeed
    ) public {
        (uint256 senior, uint256 junior) = _seedBounded(seniorPrincipal, juniorPrincipal);
        uint256 total = senior + junior;
        uint256 amount = total + bound(overshootSeed, 1, type(uint128).max);

        bytes32 attestationId = keccak256(abi.encode("inv6-over", idSeed));
        FullState memory before = _captureFullState(attestationId);

        vm.prank(RELAYER);
        vm.expectRevert(
            abi.encodeWithSelector(RepaymentExceedsOutstanding.selector, amount, total)
        );
        waterfall.allocate(_proof(attestationId, amount));

        _assertFullStateUnchanged(before, attestationId);
    }

    function testFuzz_sequentialAllocationsNeverExceedTotalEntitlement(
        uint256 seniorPrincipal,
        uint256 juniorPrincipal,
        uint256 firstSeed,
        uint256 secondSeed,
        uint256 idSeed
    ) public {
        (uint256 senior, uint256 junior) = _seedBounded(seniorPrincipal, juniorPrincipal);
        uint256 total = senior + junior;

        uint256 first = bound(firstSeed, 1, total);
        _allocate(keccak256(abi.encode("seq-a", idSeed)), first);

        uint256 remaining = total - first;
        if (remaining == 0) {
            assertEq(waterfall.seniorOutstanding() + waterfall.juniorOutstanding(), 0);
            return;
        }

        uint256 second = bound(secondSeed, 1, remaining);
        _allocate(keccak256(abi.encode("seq-b", idSeed)), second);

        assertEq(
            waterfall.seniorAllocatedTotal() + waterfall.juniorAllocatedTotal(),
            first + second,
            "cumulative allocations diverged from cumulative attested amounts"
        );
        assertEq(
            waterfall.seniorOutstanding() + waterfall.juniorOutstanding(),
            total - first - second,
            "outstanding entitlement diverged"
        );
    }

    function testFuzz_depositEntitlementNeverExceedsCapDerivedCeiling(
        uint256 seniorPrincipal,
        uint256 juniorPrincipal
    ) public {
        _seedBounded(seniorPrincipal, juniorPrincipal);

        assertLe(waterfall.seniorPrincipal(), SENIOR_CAP);
        assertLe(waterfall.juniorPrincipal(), JUNIOR_CAP);
        assertLe(
            waterfall.seniorOutstanding(), (SENIOR_CAP * waterfall.SENIOR_RATE_BPS()) / waterfall.BPS()
        );
        assertLe(
            waterfall.juniorOutstanding(), (JUNIOR_CAP * waterfall.JUNIOR_RATE_BPS()) / waterfall.BPS()
        );
    }

    function _seedBounded(uint256 seniorPrincipal, uint256 juniorPrincipal)
        internal
        returns (uint256 seniorOutstanding, uint256 juniorOutstanding)
    {
        uint256 seniorAmount = bound(seniorPrincipal, 1 ether, SENIOR_CAP);
        uint256 juniorAmount = bound(juniorPrincipal, 1 ether, JUNIOR_CAP);

        _deposit(SENIOR_INVESTOR, Tranche.Senior, seniorAmount);
        _deposit(JUNIOR_INVESTOR, Tranche.Junior, juniorAmount);

        seniorOutstanding = waterfall.seniorOutstanding();
        juniorOutstanding = waterfall.juniorOutstanding();
    }
}
