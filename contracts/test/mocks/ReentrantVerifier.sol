pragma solidity 0.8.24;

import {
    IAttestationVerifier,
    RepaymentProof,
    AttestedRepayment
} from "../../src/interfaces/IAttestationVerifier.sol";

import {ITrancheWaterfall, Tranche} from "../../src/interfaces/ITrancheWaterfall.sol";

import {ProofBuilder} from "../helpers/ProofBuilder.sol";

enum ReentryTarget {
    Allocate,
    Deposit
}

contract ReentrantVerifier is IAttestationVerifier {
    address public waterfall;
    ReentryTarget public reentryTarget;
    bool public swallowCallbackRevert;

    function configure(address waterfallAddress, ReentryTarget target, bool swallowRevert) external {
        waterfall = waterfallAddress;
        reentryTarget = target;
        swallowCallbackRevert = swallowRevert;
    }

    function verifyRepayment(RepaymentProof calldata proof)
        external
        view
        returns (AttestedRepayment memory attested)
    {
        attested = ProofBuilder.decodeAttestedPayload(proof.encodedTransaction);
        _reenterUnderStaticContext(_callbackPayload(proof));
    }

    function _callbackPayload(RepaymentProof calldata proof)
        private
        view
        returns (bytes memory)
    {
        if (reentryTarget == ReentryTarget.Allocate) {
            return abi.encodeCall(ITrancheWaterfall.allocate, (proof));
        }

        return abi.encodeCall(ITrancheWaterfall.deposit, (Tranche.Senior));
    }

    function _reenterUnderStaticContext(bytes memory payload) private view {
        function(bytes memory) internal mutableReentry = _reenter;
        function(bytes memory) internal view viewReentry;

        assembly {
            viewReentry := mutableReentry
        }

        viewReentry(payload);
    }

    function _reenter(bytes memory payload) private {
        (bool callSucceeded, bytes memory returnData) = waterfall.call(payload);

        if (callSucceeded || swallowCallbackRevert) {
            return;
        }

        assembly {
            revert(add(returnData, 0x20), mload(returnData))
        }
    }
}
