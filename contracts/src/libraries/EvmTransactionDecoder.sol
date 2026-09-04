pragma solidity 0.8.24;

import {RejectionReason, AttestationFailed} from "../interfaces/ITrancheWaterfall.sol";

library EvmTransactionDecoder {
    uint8 internal constant HIGHEST_SUPPORTED_TRANSACTION_TYPE = 4;
    uint8 internal constant HIGHEST_THREE_CHUNK_TRANSACTION_TYPE = 2;

    struct LogEntry {
        address emitter;
        bytes32[] topics;
        bytes data;
    }

    struct ReceiptFields {
        uint8 receiptStatus;
        uint64 receiptGasUsed;
        LogEntry[] receiptLogs;
        bytes receiptLogsBloom;
    }

    function decodeReceiptFields(bytes memory encodedTransaction)
        internal
        pure
        returns (ReceiptFields memory)
    {
        return _decodeReceiptChunk(_selectReceiptChunk(encodedTransaction));
    }

    function _selectReceiptChunk(bytes memory encodedTransaction)
        private
        pure
        returns (bytes memory)
    {
        (uint8 transactionType, bytes[] memory chunks) =
            abi.decode(encodedTransaction, (uint8, bytes[]));

        if (transactionType > HIGHEST_SUPPORTED_TRANSACTION_TYPE) {
            revert AttestationFailed(bytes32(0), RejectionReason.InvalidProof);
        }

        uint256 receiptChunkIndex =
            transactionType <= HIGHEST_THREE_CHUNK_TRANSACTION_TYPE ? 2 : 3;

        if (chunks.length != receiptChunkIndex + 1) {
            revert AttestationFailed(bytes32(0), RejectionReason.InvalidProof);
        }

        return chunks[receiptChunkIndex];
    }

    function _decodeReceiptChunk(bytes memory receiptChunk)
        private
        pure
        returns (ReceiptFields memory)
    {
        return abi.decode(abi.encodePacked(uint256(32), receiptChunk), (ReceiptFields));
    }
}
