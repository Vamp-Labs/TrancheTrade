pragma solidity 0.8.24;

import {INativeQueryVerifier} from "../../src/interfaces/INativeQueryVerifier.sol";

contract MockBlockProver is INativeQueryVerifier {
    bool public inclusionResult = true;
    bool public revertOnVerify;
    uint64 public transactionIndex;

    error BlockProverRejectedProof();

    function setInclusionResult(bool result) external {
        inclusionResult = result;
    }

    function setRevertOnVerify(bool shouldRevert) external {
        revertOnVerify = shouldRevert;
    }

    function setTransactionIndex(uint64 index) external {
        transactionIndex = index;
    }

    function verify(
        uint64,
        uint64,
        bytes calldata,
        MerkleProof calldata,
        ContinuityProof calldata
    ) external view returns (bool) {
        if (revertOnVerify) revert BlockProverRejectedProof();
        return inclusionResult;
    }

    function calculateTxIndex(MerkleProof calldata) external view returns (uint64) {
        return transactionIndex;
    }
}
