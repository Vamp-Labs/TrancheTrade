pragma solidity 0.8.24;

import {
    IAttestationVerifier,
    RepaymentProof,
    AttestedRepayment
} from "../../src/interfaces/IAttestationVerifier.sol";

import {ProofBuilder} from "../helpers/ProofBuilder.sol";
import {VerifierFailureMode, RevertShapes} from "./VerifierFailureMode.sol";

contract MockAttestationVerifier is IAttestationVerifier {
    VerifierFailureMode public armedFailureMode;

    function armFailureMode(VerifierFailureMode mode) external {
        armedFailureMode = mode;
    }

    function verifyRepayment(RepaymentProof calldata proof)
        external
        view
        returns (AttestedRepayment memory attested)
    {
        attested = ProofBuilder.decodeAttestedPayload(proof.encodedTransaction);
        RevertShapes.trigger(armedFailureMode, attested.attestationId);
    }
}
