pragma solidity 0.8.24;

import {INativeQueryVerifier} from "./INativeQueryVerifier.sol";

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
