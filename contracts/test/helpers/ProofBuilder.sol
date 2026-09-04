pragma solidity 0.8.24;

import {INativeQueryVerifier} from "../../src/interfaces/INativeQueryVerifier.sol";
import {RepaymentProof, AttestedRepayment} from "../../src/interfaces/IAttestationVerifier.sol";

library ProofBuilder {
    uint64 internal constant SEPOLIA_CHAIN_KEY = 1;

    function attestedPayload(
        bytes32 attestationId,
        uint256 invoiceId,
        uint256 repaymentAmount,
        uint64 sourceHeight
    ) internal pure returns (bytes memory) {
        return abi.encode(attestationId, invoiceId, repaymentAmount, sourceHeight);
    }

    function decodeAttestedPayload(bytes memory payload)
        internal
        pure
        returns (AttestedRepayment memory)
    {
        (bytes32 attestationId, uint256 invoiceId, uint256 repaymentAmount, uint64 sourceHeight) =
            abi.decode(payload, (bytes32, uint256, uint256, uint64));

        return AttestedRepayment({
            attestationId: attestationId,
            invoiceId: invoiceId,
            repaymentAmount: repaymentAmount,
            sourceHeight: sourceHeight
        });
    }

    function proofFor(
        bytes32 attestationId,
        uint256 invoiceId,
        uint256 repaymentAmount,
        uint64 sourceHeight
    ) internal pure returns (RepaymentProof memory) {
        return RepaymentProof({
            chainKey: SEPOLIA_CHAIN_KEY,
            height: sourceHeight,
            encodedTransaction: attestedPayload(attestationId, invoiceId, repaymentAmount, sourceHeight),
            merkleProof: merkleProofFor(attestationId),
            continuityProof: continuityProofFor(attestationId)
        });
    }

    function merkleProofFor(bytes32 seed)
        internal
        pure
        returns (INativeQueryVerifier.MerkleProof memory)
    {
        INativeQueryVerifier.MerkleProofEntry[] memory siblings =
            new INativeQueryVerifier.MerkleProofEntry[](2);

        siblings[0] = INativeQueryVerifier.MerkleProofEntry({
            hash: keccak256(abi.encodePacked(seed, uint8(0))),
            isLeft: true
        });
        siblings[1] = INativeQueryVerifier.MerkleProofEntry({
            hash: keccak256(abi.encodePacked(seed, uint8(1))),
            isLeft: false
        });

        return INativeQueryVerifier.MerkleProof({
            root: keccak256(abi.encodePacked(seed, "root")),
            siblings: siblings
        });
    }

    function continuityProofFor(bytes32 seed)
        internal
        pure
        returns (INativeQueryVerifier.ContinuityProof memory)
    {
        bytes32[] memory roots = new bytes32[](2);
        roots[0] = keccak256(abi.encodePacked(seed, "continuity-0"));
        roots[1] = keccak256(abi.encodePacked(seed, "continuity-1"));

        return INativeQueryVerifier.ContinuityProof({
            lowerEndpointDigest: keccak256(abi.encodePacked(seed, "lower")),
            roots: roots
        });
    }
}
