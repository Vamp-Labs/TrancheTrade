pragma solidity 0.8.24;

import {RepaymentProof} from "./IAttestationVerifier.sol";

enum Tranche {
    Senior,
    Junior
}

enum RejectionReason {
    InvalidProof,
    ExpiredProof,
    StaleProof,
    AlreadyApplied,
    AmountZero,
    ExceedsOutstanding
}

event Deposited(address indexed investor, Tranche indexed tranche, uint256 principal, uint256 entitlement);
event SeniorAllocated(bytes32 indexed attestationId, uint256 amount, uint256 seniorOutstandingAfter);
event JuniorAllocated(bytes32 indexed attestationId, uint256 amount, uint256 juniorOutstandingAfter);
event RepaymentAllocated(
    bytes32 indexed attestationId,
    uint256 indexed invoiceId,
    uint256 attestedAmount,
    uint256 seniorAllocation,
    uint256 juniorAllocation
);

error AttestationFailed(bytes32 attestationId, RejectionReason reason);
error RepaymentExceedsOutstanding(uint256 attestedAmount, uint256 totalOutstanding);
error TrancheCapExceeded(Tranche tranche, uint256 cap, uint256 attempted);
error DepositAmountZero();

interface ITrancheWaterfall {
    function deposit(Tranche tranche) external payable;

    function allocate(RepaymentProof calldata proof) external;

    function trancheCount() external pure returns (uint256);

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
        );

    function positionOf(address investor) external view returns (uint256 senior, uint256 junior);

    function isApplied(bytes32 attestationId) external view returns (bool);
}
