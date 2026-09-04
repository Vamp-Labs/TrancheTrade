pragma solidity 0.8.24;

import {TrancheWaterfall} from "../../src/TrancheWaterfall.sol";

struct FullState {
    uint256 seniorOutstanding;
    uint256 juniorOutstanding;
    uint256 seniorPrincipal;
    uint256 juniorPrincipal;
    uint256 seniorAllocatedTotal;
    uint256 juniorAllocatedTotal;
    uint256 seniorCap;
    uint256 juniorCap;
    uint256[] seniorPositions;
    uint256[] juniorPositions;
    bool attestationApplied;
}

library WaterfallState {
    function capture(TrancheWaterfall waterfall, address[] memory trackedActors, bytes32 attestationId)
        internal
        view
        returns (FullState memory state)
    {
        (
            state.seniorOutstanding,
            state.juniorOutstanding,
            state.seniorPrincipal,
            state.juniorPrincipal,
            state.seniorAllocatedTotal,
            state.juniorAllocatedTotal,
            state.seniorCap,
            state.juniorCap
        ) = waterfall.snapshot();

        uint256 actorCount = trackedActors.length;
        state.seniorPositions = new uint256[](actorCount);
        state.juniorPositions = new uint256[](actorCount);

        for (uint256 i; i < actorCount; ++i) {
            (uint256 senior, uint256 junior) = waterfall.positionOf(trackedActors[i]);
            state.seniorPositions[i] = senior;
            state.juniorPositions[i] = junior;
        }

        state.attestationApplied = waterfall.appliedAttestations(attestationId);
    }

    function fingerprint(FullState memory state) internal pure returns (bytes32) {
        return keccak256(abi.encode(state));
    }

    function equals(FullState memory left, FullState memory right) internal pure returns (bool) {
        return fingerprint(left) == fingerprint(right);
    }
}
