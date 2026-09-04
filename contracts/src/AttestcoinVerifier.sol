pragma solidity 0.8.24;

import {INativeQueryVerifier} from "./interfaces/INativeQueryVerifier.sol";

import {
    IAttestationVerifier,
    RepaymentProof,
    AttestedRepayment
} from "./interfaces/IAttestationVerifier.sol";

import {RejectionReason, AttestationFailed} from "./interfaces/ITrancheWaterfall.sol";

import {EvmTransactionDecoder} from "./libraries/EvmTransactionDecoder.sol";

contract AttestcoinVerifier is IAttestationVerifier {
    using EvmTransactionDecoder for bytes;

    address public constant CANONICAL_BLOCK_PROVER_PRECOMPILE =
        0x0000000000000000000000000000000000000FD2;

    bytes32 public constant INVOICE_REPAID_EVENT_SIGNATURE =
        keccak256("InvoiceRepaid(uint256,address,uint256,uint256)");

    uint256 internal constant INVOICE_REPAID_TOPIC_COUNT = 3;
    uint256 internal constant INVOICE_REPAID_DATA_LENGTH = 64;
    uint8 internal constant SUCCESSFUL_RECEIPT_STATUS = 1;

    INativeQueryVerifier public immutable BLOCK_PROVER;
    uint64 public immutable EXPECTED_CHAIN_KEY;
    address public immutable INVOICE_REGISTRY;

    error BlockProverAddressZero();
    error InvoiceRegistryAddressZero();

    constructor(INativeQueryVerifier blockProver, uint64 expectedChainKey, address invoiceRegistry) {
        if (address(blockProver) == address(0)) revert BlockProverAddressZero();
        if (invoiceRegistry == address(0)) revert InvoiceRegistryAddressZero();

        BLOCK_PROVER = blockProver;
        EXPECTED_CHAIN_KEY = expectedChainKey;
        INVOICE_REGISTRY = invoiceRegistry;
    }

    function verifyRepayment(RepaymentProof calldata proof)
        external
        view
        returns (AttestedRepayment memory)
    {
        if (proof.chainKey != EXPECTED_CHAIN_KEY) {
            revert AttestationFailed(bytes32(0), RejectionReason.InvalidProof);
        }

        _requireProvenInclusion(proof);

        EvmTransactionDecoder.ReceiptFields memory receipt =
            EvmTransactionDecoder.decodeReceiptFields(proof.encodedTransaction);

        if (receipt.receiptStatus != SUCCESSFUL_RECEIPT_STATUS) {
            revert AttestationFailed(bytes32(0), RejectionReason.InvalidProof);
        }

        (uint256 invoiceId, uint256 repaymentAmount) = _readSoleRepaymentLog(receipt);

        return AttestedRepayment({
            attestationId: _deriveAttestationId(proof),
            invoiceId: invoiceId,
            repaymentAmount: repaymentAmount,
            sourceHeight: proof.height
        });
    }

    function _requireProvenInclusion(RepaymentProof calldata proof) internal view {
        bool included = BLOCK_PROVER.verify(
            proof.chainKey,
            proof.height,
            proof.encodedTransaction,
            proof.merkleProof,
            proof.continuityProof
        );

        if (!included) {
            revert AttestationFailed(bytes32(0), RejectionReason.InvalidProof);
        }
    }

    function _deriveAttestationId(RepaymentProof calldata proof) internal view returns (bytes32) {
        uint64 transactionIndex = BLOCK_PROVER.calculateTxIndex(proof.merkleProof);

        return keccak256(abi.encodePacked(proof.chainKey, proof.height, transactionIndex));
    }

    function _readSoleRepaymentLog(EvmTransactionDecoder.ReceiptFields memory receipt)
        internal
        view
        returns (uint256 invoiceId, uint256 repaymentAmount)
    {
        uint256 logCount = receipt.receiptLogs.length;
        uint256 matchCount;
        uint256 matchIndex;

        for (uint256 i; i < logCount; ++i) {
            EvmTransactionDecoder.LogEntry memory candidate = receipt.receiptLogs[i];
            if (candidate.emitter != INVOICE_REGISTRY) continue;
            if (candidate.topics.length == 0) continue;
            if (candidate.topics[0] != INVOICE_REPAID_EVENT_SIGNATURE) continue;

            ++matchCount;
            matchIndex = i;
        }

        if (matchCount != 1) {
            revert AttestationFailed(bytes32(0), RejectionReason.InvalidProof);
        }

        EvmTransactionDecoder.LogEntry memory repaidLog = receipt.receiptLogs[matchIndex];

        if (repaidLog.topics.length != INVOICE_REPAID_TOPIC_COUNT) {
            revert AttestationFailed(bytes32(0), RejectionReason.InvalidProof);
        }
        if (repaidLog.data.length != INVOICE_REPAID_DATA_LENGTH) {
            revert AttestationFailed(bytes32(0), RejectionReason.InvalidProof);
        }

        invoiceId = uint256(repaidLog.topics[1]);
        (repaymentAmount,) = abi.decode(repaidLog.data, (uint256, uint256));
    }
}
