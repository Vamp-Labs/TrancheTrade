pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {
    IAttestationVerifier,
    RepaymentProof,
    AttestedRepayment
} from "./interfaces/IAttestationVerifier.sol";

import {
    ITrancheWaterfall,
    Tranche,
    RejectionReason,
    Deposited,
    SeniorAllocated,
    JuniorAllocated,
    RepaymentAllocated,
    AttestationFailed,
    RepaymentExceedsOutstanding,
    TrancheCapExceeded,
    DepositAmountZero
} from "./interfaces/ITrancheWaterfall.sol";

contract TrancheWaterfall is ITrancheWaterfall, ReentrancyGuard {
    uint256 public constant TRANCHE_COUNT = 2;
    uint256 public constant SENIOR_RATE_BPS = 10600;
    uint256 public constant JUNIOR_RATE_BPS = 11800;
    uint256 public constant BPS = 10000;

    uint256 public immutable SENIOR_CAP;
    uint256 public immutable JUNIOR_CAP;
    uint64 public immutable MIN_SOURCE_HEIGHT;
    IAttestationVerifier public immutable VERIFIER;

    uint256 public seniorPrincipal;
    uint256 public juniorPrincipal;
    uint256 public seniorOutstanding;
    uint256 public juniorOutstanding;
    uint256 public seniorAllocatedTotal;
    uint256 public juniorAllocatedTotal;

    mapping(address => uint256) public seniorPositionOf;
    mapping(address => uint256) public juniorPositionOf;
    mapping(bytes32 => bool) public appliedAttestations;

    constructor(
        IAttestationVerifier verifier,
        uint256 seniorCap,
        uint256 juniorCap,
        uint64 minSourceHeight
    ) {
        VERIFIER = verifier;
        SENIOR_CAP = seniorCap;
        JUNIOR_CAP = juniorCap;
        MIN_SOURCE_HEIGHT = minSourceHeight;
    }

    function deposit(Tranche tranche) external payable nonReentrant {
        if (msg.value == 0) revert DepositAmountZero();

        uint256 entitlement;

        if (tranche == Tranche.Senior) {
            uint256 attemptedPrincipal = seniorPrincipal + msg.value;
            if (attemptedPrincipal > SENIOR_CAP) {
                revert TrancheCapExceeded(Tranche.Senior, SENIOR_CAP, attemptedPrincipal);
            }
            entitlement = (msg.value * SENIOR_RATE_BPS) / BPS;
            seniorPrincipal = attemptedPrincipal;
            seniorOutstanding += entitlement;
            seniorPositionOf[msg.sender] += entitlement;
        } else {
            uint256 attemptedPrincipal = juniorPrincipal + msg.value;
            if (attemptedPrincipal > JUNIOR_CAP) {
                revert TrancheCapExceeded(Tranche.Junior, JUNIOR_CAP, attemptedPrincipal);
            }
            entitlement = (msg.value * JUNIOR_RATE_BPS) / BPS;
            juniorPrincipal = attemptedPrincipal;
            juniorOutstanding += entitlement;
            juniorPositionOf[msg.sender] += entitlement;
        }

        emit Deposited(msg.sender, tranche, msg.value, entitlement);
    }

    function allocate(RepaymentProof calldata proof) external nonReentrant {
        AttestedRepayment memory attested = VERIFIER.verifyRepayment(proof);

        if (attested.sourceHeight < MIN_SOURCE_HEIGHT) {
            revert AttestationFailed(attested.attestationId, RejectionReason.StaleProof);
        }

        if (appliedAttestations[attested.attestationId]) {
            revert AttestationFailed(attested.attestationId, RejectionReason.AlreadyApplied);
        }

        if (attested.repaymentAmount == 0) {
            revert AttestationFailed(attested.attestationId, RejectionReason.AmountZero);
        }

        uint256 totalOutstanding = seniorOutstanding + juniorOutstanding;
        if (attested.repaymentAmount > totalOutstanding) {
            revert RepaymentExceedsOutstanding(attested.repaymentAmount, totalOutstanding);
        }

        appliedAttestations[attested.attestationId] = true;

        uint256 seniorAllocation = attested.repaymentAmount < seniorOutstanding
            ? attested.repaymentAmount
            : seniorOutstanding;
        seniorOutstanding -= seniorAllocation;
        seniorAllocatedTotal += seniorAllocation;

        emit SeniorAllocated(attested.attestationId, seniorAllocation, seniorOutstanding);

        uint256 juniorAllocation = attested.repaymentAmount - seniorAllocation;
        if (juniorAllocation > 0) {
            assert(seniorOutstanding == 0);
            juniorOutstanding -= juniorAllocation;
            juniorAllocatedTotal += juniorAllocation;
        }

        emit JuniorAllocated(attested.attestationId, juniorAllocation, juniorOutstanding);

        emit RepaymentAllocated(
            attested.attestationId,
            attested.invoiceId,
            attested.repaymentAmount,
            seniorAllocation,
            juniorAllocation
        );
    }

    function trancheCount() external pure returns (uint256) {
        return TRANCHE_COUNT;
    }

    function snapshot()
        external
        view
        returns (
            uint256 seniorOutstanding_,
            uint256 juniorOutstanding_,
            uint256 seniorPrincipal_,
            uint256 juniorPrincipal_,
            uint256 seniorAllocatedTotal_,
            uint256 juniorAllocatedTotal_,
            uint256 seniorCap_,
            uint256 juniorCap_
        )
    {
        return (
            seniorOutstanding,
            juniorOutstanding,
            seniorPrincipal,
            juniorPrincipal,
            seniorAllocatedTotal,
            juniorAllocatedTotal,
            SENIOR_CAP,
            JUNIOR_CAP
        );
    }

    function positionOf(address investor) external view returns (uint256 senior, uint256 junior) {
        return (seniorPositionOf[investor], juniorPositionOf[investor]);
    }

    function isApplied(bytes32 attestationId) external view returns (bool) {
        return appliedAttestations[attestationId];
    }
}
