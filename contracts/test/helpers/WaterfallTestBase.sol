pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";

import {TrancheWaterfall} from "../../src/TrancheWaterfall.sol";
import {IAttestationVerifier, RepaymentProof} from "../../src/interfaces/IAttestationVerifier.sol";
import {Tranche} from "../../src/interfaces/ITrancheWaterfall.sol";

import {MockAttestationVerifier} from "../mocks/MockAttestationVerifier.sol";
import {ProofBuilder} from "./ProofBuilder.sol";
import {FullState, WaterfallState} from "./WaterfallState.sol";

abstract contract WaterfallTestBase is Test {
    uint256 internal constant SENIOR_CAP = 70_000 ether;
    uint256 internal constant JUNIOR_CAP = 30_000 ether;
    uint64 internal constant MIN_SOURCE_HEIGHT = 11_600_000;
    uint64 internal constant DEFAULT_SOURCE_HEIGHT = 11_633_495;
    uint256 internal constant DEFAULT_INVOICE_ID = 1;

    bytes32 internal constant SENIOR_ALLOCATED_TOPIC =
        keccak256("SeniorAllocated(bytes32,uint256,uint256)");
    bytes32 internal constant JUNIOR_ALLOCATED_TOPIC =
        keccak256("JuniorAllocated(bytes32,uint256,uint256)");
    bytes32 internal constant REPAYMENT_ALLOCATED_TOPIC =
        keccak256("RepaymentAllocated(bytes32,uint256,uint256,uint256,uint256)");

    address internal constant SENIOR_INVESTOR = address(0xA11CE);
    address internal constant JUNIOR_INVESTOR = address(0xB0B);
    address internal constant MIXED_INVESTOR = address(0xCAFE);
    address internal constant RELAYER = address(0xDEAD1);

    MockAttestationVerifier internal verifier;
    TrancheWaterfall internal waterfall;

    function setUp() public virtual {
        verifier = new MockAttestationVerifier();
        waterfall = _deployWaterfall(IAttestationVerifier(address(verifier)));
    }

    function _deployWaterfall(IAttestationVerifier attestationVerifier)
        internal
        returns (TrancheWaterfall)
    {
        return new TrancheWaterfall(attestationVerifier, SENIOR_CAP, JUNIOR_CAP, MIN_SOURCE_HEIGHT);
    }

    function _trackedActors() internal pure returns (address[] memory actors) {
        actors = new address[](4);
        actors[0] = SENIOR_INVESTOR;
        actors[1] = JUNIOR_INVESTOR;
        actors[2] = MIXED_INVESTOR;
        actors[3] = RELAYER;
    }

    function _deposit(address investor, Tranche tranche, uint256 principal) internal {
        vm.deal(investor, principal);
        vm.prank(investor);
        waterfall.deposit{value: principal}(tranche);
    }

    function _seedPool(uint256 seniorPrincipal, uint256 juniorPrincipal) internal {
        if (seniorPrincipal > 0) _deposit(SENIOR_INVESTOR, Tranche.Senior, seniorPrincipal);
        if (juniorPrincipal > 0) _deposit(JUNIOR_INVESTOR, Tranche.Junior, juniorPrincipal);
    }

    function _proof(bytes32 attestationId, uint256 amount)
        internal
        pure
        returns (RepaymentProof memory)
    {
        return ProofBuilder.proofFor(
            attestationId, DEFAULT_INVOICE_ID, amount, DEFAULT_SOURCE_HEIGHT
        );
    }

    function _allocate(bytes32 attestationId, uint256 amount) internal {
        vm.prank(RELAYER);
        waterfall.allocate(_proof(attestationId, amount));
    }

    function _captureFullState(bytes32 attestationId) internal view returns (FullState memory) {
        return WaterfallState.capture(waterfall, _trackedActors(), attestationId);
    }

    function _assertFullStateUnchanged(FullState memory before, bytes32 attestationId) internal view {
        FullState memory current = _captureFullState(attestationId);

        assertEq(current.seniorOutstanding, before.seniorOutstanding, "seniorOutstanding mutated");
        assertEq(current.juniorOutstanding, before.juniorOutstanding, "juniorOutstanding mutated");
        assertEq(current.seniorPrincipal, before.seniorPrincipal, "seniorPrincipal mutated");
        assertEq(current.juniorPrincipal, before.juniorPrincipal, "juniorPrincipal mutated");
        assertEq(
            current.seniorAllocatedTotal, before.seniorAllocatedTotal, "seniorAllocatedTotal mutated"
        );
        assertEq(
            current.juniorAllocatedTotal, before.juniorAllocatedTotal, "juniorAllocatedTotal mutated"
        );
        assertEq(current.seniorCap, before.seniorCap, "seniorCap mutated");
        assertEq(current.juniorCap, before.juniorCap, "juniorCap mutated");

        address[] memory actors = _trackedActors();
        for (uint256 i; i < actors.length; ++i) {
            assertEq(current.seniorPositions[i], before.seniorPositions[i], "senior position mutated");
            assertEq(current.juniorPositions[i], before.juniorPositions[i], "junior position mutated");
        }

        assertEq(current.attestationApplied, before.attestationApplied, "attestation id consumed");
        assertFalse(current.attestationApplied, "failed attempt consumed the attestation id");

        assertEq(
            WaterfallState.fingerprint(current),
            WaterfallState.fingerprint(before),
            "complete state fingerprint changed"
        );
    }

    function _logIndexOfTopic(Vm.Log[] memory logs, bytes32 topic)
        internal
        view
        returns (uint256 index, uint256 occurrences)
    {
        index = type(uint256).max;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(waterfall)) continue;
            if (logs[i].topics.length == 0) continue;
            if (logs[i].topics[0] != topic) continue;
            if (index == type(uint256).max) index = i;
            ++occurrences;
        }
    }

    function _countLogsWithTopic(Vm.Log[] memory logs, address emitter, bytes32 topic)
        internal
        pure
        returns (uint256 count)
    {
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != emitter) continue;
            if (logs[i].topics.length == 0) continue;
            if (logs[i].topics[0] == topic) ++count;
        }
    }

    function _seniorEntitlement(uint256 principal) internal view returns (uint256) {
        return (principal * waterfall.SENIOR_RATE_BPS()) / waterfall.BPS();
    }

    function _juniorEntitlement(uint256 principal) internal view returns (uint256) {
        return (principal * waterfall.JUNIOR_RATE_BPS()) / waterfall.BPS();
    }
}
