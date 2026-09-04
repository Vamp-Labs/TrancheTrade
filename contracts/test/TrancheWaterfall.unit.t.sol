pragma solidity 0.8.24;

import {Vm} from "forge-std/Vm.sol";

import {TrancheWaterfall} from "../src/TrancheWaterfall.sol";
import {IAttestationVerifier, RepaymentProof} from "../src/interfaces/IAttestationVerifier.sol";
import {
    Tranche,
    RejectionReason,
    AttestationFailed,
    RepaymentExceedsOutstanding,
    TrancheCapExceeded,
    DepositAmountZero
} from "../src/interfaces/ITrancheWaterfall.sol";

import {WaterfallTestBase} from "./helpers/WaterfallTestBase.sol";
import {MockAttestationVerifier} from "./mocks/MockAttestationVerifier.sol";
import {AbiIntrospection} from "./helpers/AbiIntrospection.sol";
import {ProofBuilder} from "./helpers/ProofBuilder.sol";
import {FullState} from "./helpers/WaterfallState.sol";
import {RevertingVerifier} from "./mocks/RevertingVerifier.sol";
import {VerifierFailureMode, CONTINUITY_STRING_REASON} from "./mocks/VerifierFailureMode.sol";

contract TrancheWaterfallUnitTest is WaterfallTestBase {
    string internal constant ARTIFACT_PATH = "out/TrancheWaterfall.sol/TrancheWaterfall.json";

    uint256 internal seniorOutstandingAfterSeed;
    uint256 internal juniorOutstandingAfterSeed;

    function setUp() public override {
        super.setUp();
        _seedPool(1_000 ether, 500 ether);
        seniorOutstandingAfterSeed = waterfall.seniorOutstanding();
        juniorOutstandingAfterSeed = waterfall.juniorOutstanding();
    }

    function test_depositCreditsSeniorEntitlementAtDisclosedRate() public view {
        assertEq(seniorOutstandingAfterSeed, _seniorEntitlement(1_000 ether));
        assertEq(waterfall.seniorPrincipal(), 1_000 ether);
        (uint256 senior, uint256 junior) = waterfall.positionOf(SENIOR_INVESTOR);
        assertEq(senior, _seniorEntitlement(1_000 ether));
        assertEq(junior, 0);
    }

    function test_depositCreditsJuniorEntitlementAtDisclosedRate() public view {
        assertEq(juniorOutstandingAfterSeed, _juniorEntitlement(500 ether));
        assertEq(waterfall.juniorPrincipal(), 500 ether);
    }

    function test_depositRevertsOnZeroValue() public {
        vm.deal(MIXED_INVESTOR, 1 ether);
        vm.prank(MIXED_INVESTOR);
        vm.expectRevert(DepositAmountZero.selector);
        waterfall.deposit{value: 0}(Tranche.Senior);
    }

    function test_depositRevertsWhenSeniorCapWouldBeExceeded() public {
        uint256 attempted = SENIOR_CAP - 1_000 ether + 1;
        vm.deal(MIXED_INVESTOR, attempted);
        vm.prank(MIXED_INVESTOR);
        vm.expectRevert(
            abi.encodeWithSelector(
                TrancheCapExceeded.selector, Tranche.Senior, SENIOR_CAP, SENIOR_CAP + 1
            )
        );
        waterfall.deposit{value: attempted}(Tranche.Senior);
    }

    function test_depositRevertsWhenJuniorCapWouldBeExceeded() public {
        uint256 attempted = JUNIOR_CAP - 500 ether + 1;
        vm.deal(MIXED_INVESTOR, attempted);
        vm.prank(MIXED_INVESTOR);
        vm.expectRevert(
            abi.encodeWithSelector(
                TrancheCapExceeded.selector, Tranche.Junior, JUNIOR_CAP, JUNIOR_CAP + 1
            )
        );
        waterfall.deposit{value: attempted}(Tranche.Junior);
    }

    function test_INV1_juniorAllocationRequiresSeniorExhausted() public {
        uint256 amount = seniorOutstandingAfterSeed - 1 ether;
        _allocate(keccak256("inv1-below-senior"), amount);

        assertEq(waterfall.seniorOutstanding(), seniorOutstandingAfterSeed - amount);
        assertEq(waterfall.juniorOutstanding(), juniorOutstandingAfterSeed);
        assertEq(waterfall.juniorAllocatedTotal(), 0);
        assertEq(waterfall.seniorAllocatedTotal(), amount);
    }

    function test_INV1_remainderReachesJuniorOnlyAfterSeniorIsZero() public {
        uint256 amount = seniorOutstandingAfterSeed + 10 ether;
        _allocate(keccak256("inv1-above-senior"), amount);

        assertEq(waterfall.seniorOutstanding(), 0);
        assertEq(waterfall.juniorOutstanding(), juniorOutstandingAfterSeed - 10 ether);
        assertEq(waterfall.seniorAllocatedTotal(), seniorOutstandingAfterSeed);
        assertEq(waterfall.juniorAllocatedTotal(), 10 ether);
    }

    function test_INV1_seniorAllocatedLogIndexIsStrictlyLowerThanJuniorAllocated() public {
        vm.recordLogs();
        _allocate(keccak256("inv1-log-order-cascade"), seniorOutstandingAfterSeed + 10 ether);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        (uint256 seniorIndex, uint256 seniorCount) =
            _logIndexOfTopic(logs, SENIOR_ALLOCATED_TOPIC);
        (uint256 juniorIndex, uint256 juniorCount) =
            _logIndexOfTopic(logs, JUNIOR_ALLOCATED_TOPIC);

        assertEq(seniorCount, 1, "SeniorAllocated must be emitted exactly once");
        assertEq(juniorCount, 1, "JuniorAllocated must be emitted exactly once");
        assertLt(seniorIndex, juniorIndex, "SeniorAllocated must precede JuniorAllocated");
    }

    function test_INV1_bothAllocationEventsAreEmittedWhenJuniorAllocationIsZero() public {
        vm.recordLogs();
        _allocate(keccak256("inv1-log-order-senior-only"), seniorOutstandingAfterSeed - 1 ether);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        (uint256 seniorIndex, uint256 seniorCount) =
            _logIndexOfTopic(logs, SENIOR_ALLOCATED_TOPIC);
        (uint256 juniorIndex, uint256 juniorCount) =
            _logIndexOfTopic(logs, JUNIOR_ALLOCATED_TOPIC);

        assertEq(seniorCount, 1, "SeniorAllocated missing on senior-only allocation");
        assertEq(juniorCount, 1, "JuniorAllocated missing on senior-only allocation");
        assertLt(seniorIndex, juniorIndex, "SeniorAllocated must precede JuniorAllocated");

        (uint256 juniorAmount, uint256 juniorOutstandingAfter) =
            abi.decode(logs[juniorIndex].data, (uint256, uint256));
        assertEq(juniorAmount, 0, "junior allocation must be zero");
        assertEq(juniorOutstandingAfter, juniorOutstandingAfterSeed, "junior balance must be intact");
    }

    function test_INV2_juniorOutstandingUnchangedWhileSeniorStaysOutstanding() public {
        uint256 juniorBefore = waterfall.juniorOutstanding();
        _allocate(keccak256("inv2-partial"), seniorOutstandingAfterSeed / 2);

        assertGt(waterfall.seniorOutstanding(), 0, "senior must remain outstanding");
        assertEq(waterfall.juniorOutstanding(), juniorBefore, "junior skipped ahead");
        assertEq(waterfall.juniorAllocatedTotal(), 0);
    }

    function test_INV2_repeatedPartialAllocationsNeverTouchJunior() public {
        uint256 juniorBefore = waterfall.juniorOutstanding();
        uint256 slice = seniorOutstandingAfterSeed / 4;

        _allocate(keccak256("inv2-slice-1"), slice);
        _allocate(keccak256("inv2-slice-2"), slice);
        _allocate(keccak256("inv2-slice-3"), slice);

        assertGt(waterfall.seniorOutstanding(), 0);
        assertEq(waterfall.juniorOutstanding(), juniorBefore);
    }

    function test_INV3_customErrorRevertLeavesCompleteStateUnchanged() public {
        _assertFailingVerifierLeavesStateUnchanged(
            VerifierFailureMode.CustomError, keccak256("inv3-custom-error")
        );
    }

    function test_INV3_continuityFailureRevertLeavesCompleteStateUnchanged() public {
        _assertFailingVerifierLeavesStateUnchanged(
            VerifierFailureMode.ContinuityFailure, keccak256("inv3-continuity")
        );
    }

    function test_INV3_stringRevertLeavesCompleteStateUnchanged() public {
        _assertFailingVerifierLeavesStateUnchanged(
            VerifierFailureMode.StringReason, keccak256("inv3-string")
        );
    }

    function test_INV3_emptyRevertDataLeavesCompleteStateUnchanged() public {
        _assertFailingVerifierLeavesStateUnchanged(
            VerifierFailureMode.EmptyRevertData, keccak256("inv3-empty")
        );
    }

    function test_INV3_gasExhaustionLeavesCompleteStateUnchanged() public {
        bytes32 attestationId = keccak256("inv3-gas");
        _armRevertingVerifier(VerifierFailureMode.GasExhaustion);

        FullState memory before = _captureFullState(attestationId);

        vm.prank(RELAYER);
        (bool succeeded,) = address(waterfall).call{gas: 2_000_000}(
            abi.encodeCall(TrancheWaterfall.allocate, (_proof(attestationId, 10 ether)))
        );

        assertFalse(succeeded, "gas exhausted verification must revert the whole transaction");
        _assertFullStateUnchanged(before, attestationId);
    }

    function test_INV3_revertShapesAreGenuinelyDistinct() public {
        bytes32 attestationId = keccak256("inv3-shapes");
        bytes[] memory returnDatas = new bytes[](4);

        VerifierFailureMode[4] memory modes = [
            VerifierFailureMode.CustomError,
            VerifierFailureMode.ContinuityFailure,
            VerifierFailureMode.StringReason,
            VerifierFailureMode.EmptyRevertData
        ];

        for (uint256 i; i < 4; ++i) {
            TrancheWaterfall subject = _deployWithRevertingVerifier(modes[i]);
            (bool succeeded, bytes memory returnData) = address(subject).call(
                abi.encodeCall(TrancheWaterfall.allocate, (_proof(attestationId, 1 ether)))
            );
            assertFalse(succeeded);
            returnDatas[i] = returnData;
        }

        assertEq(
            returnDatas[0],
            abi.encodeWithSelector(
                AttestationFailed.selector, attestationId, RejectionReason.InvalidProof
            )
        );
        assertEq(
            returnDatas[1],
            abi.encodeWithSelector(
                AttestationFailed.selector, attestationId, RejectionReason.ExpiredProof
            )
        );
        assertEq(returnDatas[2], abi.encodeWithSignature("Error(string)", CONTINUITY_STRING_REASON));
        assertEq(returnDatas[3].length, 0, "empty revert data shape must stay empty");
    }

    function test_INV4_replayingAnAppliedAttestationIdReverts() public {
        bytes32 attestationId = keccak256("inv4-replay");
        _allocate(attestationId, 10 ether);
        assertTrue(waterfall.isApplied(attestationId));

        FullState memory before = _captureFullState(attestationId);

        vm.prank(RELAYER);
        vm.expectRevert(
            abi.encodeWithSelector(
                AttestationFailed.selector, attestationId, RejectionReason.AlreadyApplied
            )
        );
        waterfall.allocate(_proof(attestationId, 10 ether));

        assertEq(waterfall.seniorOutstanding(), before.seniorOutstanding);
        assertEq(waterfall.seniorAllocatedTotal(), before.seniorAllocatedTotal);
    }

    function test_INV4_distinctAttestationIdsFromDifferentSourceTransactionsBothApply() public {
        bytes32 firstId = keccak256("inv4-source-tx-a");
        bytes32 secondId = keccak256("inv4-source-tx-b");

        _allocate(firstId, 10 ether);
        _allocate(secondId, 20 ether);

        assertTrue(waterfall.isApplied(firstId));
        assertTrue(waterfall.isApplied(secondId));
        assertEq(waterfall.seniorAllocatedTotal(), 30 ether);
    }

    function test_INV5_trancheCountIsTwoAndHasNoMutatingAccessor() public view {
        assertEq(waterfall.TRANCHE_COUNT(), 2);
        assertEq(waterfall.trancheCount(), 2);

        string[] memory names = AbiIntrospection.allFunctionNames(vm.readFile(ARTIFACT_PATH));
        for (uint256 i; i < names.length; ++i) {
            assertFalse(
                _hasSetterPrefix(names[i]),
                "TrancheWaterfall must expose no setter-shaped function"
            );
        }
    }

    function test_INV5_stateMutatingSelectorSetIsExactlyDepositAndAllocate() public view {
        string[] memory mutating =
            AbiIntrospection.stateMutatingFunctionNames(vm.readFile(ARTIFACT_PATH));

        assertEq(mutating.length, 2, "state-mutating external surface must have exactly two members");
        assertTrue(AbiIntrospection.contains(mutating, "deposit"), "deposit missing");
        assertTrue(AbiIntrospection.contains(mutating, "allocate"), "allocate missing");

        bytes4[] memory expected = new bytes4[](2);
        expected[0] = TrancheWaterfall.deposit.selector;
        expected[1] = TrancheWaterfall.allocate.selector;

        for (uint256 i; i < mutating.length; ++i) {
            bytes4 selector = _selectorOf(mutating[i]);
            assertTrue(
                selector == expected[0] || selector == expected[1],
                "unexpected state-mutating selector on TrancheWaterfall"
            );
        }
    }

    function test_INV6_conservationAtSevenBoundaryAmounts() public {
        uint256 senior = seniorOutstandingAfterSeed;
        uint256 junior = juniorOutstandingAfterSeed;

        _assertAmountRejected(0, keccak256("inv6-zero"), true);
        _assertConservationForAmount(1, keccak256("inv6-one"));

        _resetPool();
        _assertConservationForAmount(senior - 1, keccak256("inv6-senior-minus-one"));

        _resetPool();
        _assertConservationForAmount(senior, keccak256("inv6-senior-exact"));

        _resetPool();
        _assertConservationForAmount(senior + 1, keccak256("inv6-senior-plus-one"));

        _resetPool();
        _assertConservationForAmount(senior + junior, keccak256("inv6-total-exact"));

        _resetPool();
        _assertAmountRejected(senior + junior + 1, keccak256("inv6-total-plus-one"), false);
    }

    function test_INV6_overRepaymentByOneWeiRevertsAndLeavesStateUnchanged() public {
        uint256 total = waterfall.seniorOutstanding() + waterfall.juniorOutstanding();
        bytes32 attestationId = keccak256("inv6-over-repayment");
        FullState memory before = _captureFullState(attestationId);

        vm.prank(RELAYER);
        vm.expectRevert(
            abi.encodeWithSelector(RepaymentExceedsOutstanding.selector, total + 1, total)
        );
        waterfall.allocate(_proof(attestationId, total + 1));

        _assertFullStateUnchanged(before, attestationId);
    }

    function test_StaleProofBelowMinSourceHeightIsRejected() public {
        bytes32 attestationId = keccak256("stale-proof");
        FullState memory before = _captureFullState(attestationId);

        RepaymentProof memory proof = ProofBuilder.proofFor(
            attestationId, DEFAULT_INVOICE_ID, 10 ether, MIN_SOURCE_HEIGHT - 1
        );

        vm.prank(RELAYER);
        vm.expectRevert(
            abi.encodeWithSelector(
                AttestationFailed.selector, attestationId, RejectionReason.StaleProof
            )
        );
        waterfall.allocate(proof);

        _assertFullStateUnchanged(before, attestationId);
    }

    function test_ProofExactlyAtMinSourceHeightIsAccepted() public {
        bytes32 attestationId = keccak256("min-height-boundary");
        RepaymentProof memory proof = ProofBuilder.proofFor(
            attestationId, DEFAULT_INVOICE_ID, 10 ether, MIN_SOURCE_HEIGHT
        );

        vm.prank(RELAYER);
        waterfall.allocate(proof);

        assertTrue(waterfall.isApplied(attestationId));
    }

    function test_ZeroAttestedAmountIsRejectedWithAmountZeroReason() public {
        bytes32 attestationId = keccak256("amount-zero");
        FullState memory before = _captureFullState(attestationId);

        vm.prank(RELAYER);
        vm.expectRevert(
            abi.encodeWithSelector(
                AttestationFailed.selector, attestationId, RejectionReason.AmountZero
            )
        );
        waterfall.allocate(_proof(attestationId, 0));

        _assertFullStateUnchanged(before, attestationId);
    }

    function test_RepaymentAllocatedEventCarriesTheAttestationAudit() public {
        bytes32 attestationId = keccak256("audit-event");
        uint256 amount = seniorOutstandingAfterSeed + 5 ether;

        vm.recordLogs();
        _allocate(attestationId, amount);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        (uint256 index, uint256 count) = _logIndexOfTopic(logs, REPAYMENT_ALLOCATED_TOPIC);
        assertEq(count, 1, "RepaymentAllocated must be emitted exactly once");
        assertEq(logs[index].topics[1], attestationId);
        assertEq(uint256(logs[index].topics[2]), DEFAULT_INVOICE_ID);

        (uint256 attestedAmount, uint256 seniorAllocation, uint256 juniorAllocation) =
            abi.decode(logs[index].data, (uint256, uint256, uint256));

        assertEq(attestedAmount, amount);
        assertEq(seniorAllocation + juniorAllocation, attestedAmount);
    }

    function _assertConservationForAmount(uint256 amount, bytes32 attestationId) internal {
        uint256 seniorBefore = waterfall.seniorOutstanding();
        uint256 juniorBefore = waterfall.juniorOutstanding();

        vm.recordLogs();
        _allocate(attestationId, amount);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        (uint256 index,) = _logIndexOfTopic(logs, REPAYMENT_ALLOCATED_TOPIC);
        (uint256 attestedAmount, uint256 seniorAllocation, uint256 juniorAllocation) =
            abi.decode(logs[index].data, (uint256, uint256, uint256));

        assertEq(attestedAmount, amount, "attested amount mismatch");
        assertEq(
            seniorAllocation + juniorAllocation,
            attestedAmount,
            "event form of conservation violated"
        );

        uint256 seniorDelta = seniorBefore - waterfall.seniorOutstanding();
        uint256 juniorDelta = juniorBefore - waterfall.juniorOutstanding();
        assertEq(seniorDelta + juniorDelta, amount, "balance-delta form of conservation violated");
        assertEq(seniorDelta, seniorAllocation, "senior delta disagrees with event");
        assertEq(juniorDelta, juniorAllocation, "junior delta disagrees with event");
    }

    function _assertAmountRejected(uint256 amount, bytes32 attestationId, bool expectAmountZero)
        internal
    {
        FullState memory before = _captureFullState(attestationId);

        vm.prank(RELAYER);
        if (expectAmountZero) {
            vm.expectRevert(
                abi.encodeWithSelector(
                    AttestationFailed.selector, attestationId, RejectionReason.AmountZero
                )
            );
        } else {
            uint256 total = before.seniorOutstanding + before.juniorOutstanding;
            vm.expectRevert(
                abi.encodeWithSelector(RepaymentExceedsOutstanding.selector, amount, total)
            );
        }
        waterfall.allocate(_proof(attestationId, amount));

        _assertFullStateUnchanged(before, attestationId);
    }

    function _resetPool() internal {
        verifier = new MockAttestationVerifier();
        waterfall = _deployWaterfall(IAttestationVerifier(address(verifier)));
        _seedPool(1_000 ether, 500 ether);
    }

    function _deployWithRevertingVerifier(VerifierFailureMode mode)
        internal
        returns (TrancheWaterfall subject)
    {
        RevertingVerifier revertingVerifier = new RevertingVerifier(mode);
        subject = new TrancheWaterfall(
            IAttestationVerifier(address(revertingVerifier)),
            SENIOR_CAP,
            JUNIOR_CAP,
            MIN_SOURCE_HEIGHT
        );
    }

    function _armRevertingVerifier(VerifierFailureMode mode) internal {
        RevertingVerifier revertingVerifier = new RevertingVerifier(mode);
        vm.etch(address(verifier), address(revertingVerifier).code);
        RevertingVerifier(address(verifier)).setFailureMode(mode);
    }

    function _assertFailingVerifierLeavesStateUnchanged(
        VerifierFailureMode mode,
        bytes32 attestationId
    ) internal {
        _armRevertingVerifier(mode);

        FullState memory before = _captureFullState(attestationId);

        vm.prank(RELAYER);
        (bool succeeded,) = address(waterfall).call(
            abi.encodeCall(TrancheWaterfall.allocate, (_proof(attestationId, 10 ether)))
        );

        assertFalse(succeeded, "failing verification must revert the allocation");
        _assertFullStateUnchanged(before, attestationId);
    }

    function _hasSetterPrefix(string memory name) internal pure returns (bool) {
        bytes memory raw = bytes(name);
        if (raw.length < 3) return false;
        if (raw[0] == "s" && raw[1] == "e" && raw[2] == "t") return true;

        bytes32 hashed = keccak256(raw);
        return hashed == keccak256("owner") || hashed == keccak256("transferOwnership")
            || hashed == keccak256("renounceOwnership") || hashed == keccak256("upgradeTo")
            || hashed == keccak256("initialize") || hashed == keccak256("configure");
    }

    function _selectorOf(string memory name) internal pure returns (bytes4) {
        bytes32 hashed = keccak256(bytes(name));
        if (hashed == keccak256("deposit")) return TrancheWaterfall.deposit.selector;
        if (hashed == keccak256("allocate")) return TrancheWaterfall.allocate.selector;
        return bytes4(0);
    }
}
