pragma solidity 0.8.24;

import {RejectionReason, AttestationFailed} from "../../src/interfaces/ITrancheWaterfall.sol";

enum VerifierFailureMode {
    None,
    CustomError,
    ContinuityFailure,
    StringReason,
    EmptyRevertData,
    GasExhaustion
}

error GasBurnLoopEscaped(uint256 accumulator);

string constant CONTINUITY_STRING_REASON = "block prover rejected the continuity proof";

library RevertShapes {
    uint256 internal constant LOWEST_REVERTING_MODE = 1;
    uint256 internal constant HIGHEST_CHEAP_REVERTING_MODE = 4;
    uint256 internal constant HIGHEST_REVERTING_MODE = 5;

    function trigger(VerifierFailureMode mode, bytes32 attestationId) internal pure {
        if (mode == VerifierFailureMode.None) {
            return;
        }

        if (mode == VerifierFailureMode.CustomError) {
            revert AttestationFailed(attestationId, RejectionReason.InvalidProof);
        }

        if (mode == VerifierFailureMode.ContinuityFailure) {
            revert AttestationFailed(attestationId, RejectionReason.ExpiredProof);
        }

        if (mode == VerifierFailureMode.StringReason) {
            revert(CONTINUITY_STRING_REASON);
        }

        if (mode == VerifierFailureMode.EmptyRevertData) {
            assembly {
                revert(0, 0)
            }
        }

        burnAllRemainingGas(uint256(attestationId));
    }

    function burnAllRemainingGas(uint256 seed) internal pure {
        uint256 accumulator = uint256(keccak256(abi.encodePacked(seed)));

        while (true) {
            accumulator = uint256(keccak256(abi.encodePacked(accumulator)));
            if (accumulator == type(uint256).max) {
                revert GasBurnLoopEscaped(accumulator);
            }
        }
    }
}
