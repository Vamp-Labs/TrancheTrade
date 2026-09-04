pragma solidity 0.8.24;

import {
    IAttestationVerifier,
    RepaymentProof,
    AttestedRepayment
} from "../../src/interfaces/IAttestationVerifier.sol";

import {ProofBuilder} from "../helpers/ProofBuilder.sol";
import {VerifierFailureMode, RevertShapes} from "./VerifierFailureMode.sol";

contract RevertingVerifier is IAttestationVerifier {
    VerifierFailureMode public failureMode;

    constructor(VerifierFailureMode initialFailureMode) {
        failureMode = _reverting(initialFailureMode);
    }

    function setFailureMode(VerifierFailureMode mode) external {
        failureMode = _reverting(mode);
    }

    function verifyRepayment(RepaymentProof calldata proof)
        external
        view
        returns (AttestedRepayment memory attested)
    {
        attested = ProofBuilder.decodeAttestedPayload(proof.encodedTransaction);
        RevertShapes.trigger(failureMode, attested.attestationId);
    }

    function _reverting(VerifierFailureMode mode) private pure returns (VerifierFailureMode) {
        return mode == VerifierFailureMode.None ? VerifierFailureMode.CustomError : mode;
    }
}
