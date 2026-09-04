pragma solidity 0.8.24;

library AbiIntrospection {
    bytes internal constant FUNCTION_ENTRY_MARKER = bytes('"type":"function"');
    bytes internal constant NAME_KEY_MARKER = bytes('"name":"');
    bytes internal constant STATE_MUTABILITY_KEY_MARKER = bytes('"stateMutability":"');
    bytes internal constant ABI_SECTION_TERMINATOR = bytes('],"bytecode"');
    bytes internal constant NONPAYABLE_MUTABILITY = bytes("nonpayable");
    bytes internal constant PAYABLE_MUTABILITY = bytes("payable");

    error AbiSectionNotFound();
    error MalformedAbiEntry(uint256 offset);

    function stateMutatingFunctionNames(string memory artifactJson)
        internal
        pure
        returns (string[] memory)
    {
        bytes memory raw = bytes(artifactJson);
        uint256 abiEnd = indexOf(raw, ABI_SECTION_TERMINATOR, 0);
        if (abiEnd == type(uint256).max) revert AbiSectionNotFound();

        string[] memory collected = new string[](64);
        uint256 collectedCount;
        uint256 cursor;

        while (true) {
            uint256 entryStart = indexOf(raw, FUNCTION_ENTRY_MARKER, cursor);
            if (entryStart == type(uint256).max || entryStart > abiEnd) break;

            uint256 nameStart = indexOf(raw, NAME_KEY_MARKER, entryStart);
            if (nameStart == type(uint256).max) revert MalformedAbiEntry(entryStart);
            nameStart += NAME_KEY_MARKER.length;
            uint256 nameEnd = indexOfQuote(raw, nameStart);

            uint256 mutabilityStart = indexOf(raw, STATE_MUTABILITY_KEY_MARKER, nameEnd);
            if (mutabilityStart == type(uint256).max) revert MalformedAbiEntry(entryStart);
            mutabilityStart += STATE_MUTABILITY_KEY_MARKER.length;
            uint256 mutabilityEnd = indexOfQuote(raw, mutabilityStart);

            bytes memory mutability = slice(raw, mutabilityStart, mutabilityEnd);

            if (
                keccak256(mutability) == keccak256(NONPAYABLE_MUTABILITY)
                    || keccak256(mutability) == keccak256(PAYABLE_MUTABILITY)
            ) {
                collected[collectedCount] = string(slice(raw, nameStart, nameEnd));
                ++collectedCount;
            }

            cursor = mutabilityEnd;
        }

        string[] memory names = new string[](collectedCount);
        for (uint256 i; i < collectedCount; ++i) {
            names[i] = collected[i];
        }
        return names;
    }

    function allFunctionNames(string memory artifactJson) internal pure returns (string[] memory) {
        bytes memory raw = bytes(artifactJson);
        uint256 abiEnd = indexOf(raw, ABI_SECTION_TERMINATOR, 0);
        if (abiEnd == type(uint256).max) revert AbiSectionNotFound();

        string[] memory collected = new string[](128);
        uint256 collectedCount;
        uint256 cursor;

        while (true) {
            uint256 entryStart = indexOf(raw, FUNCTION_ENTRY_MARKER, cursor);
            if (entryStart == type(uint256).max || entryStart > abiEnd) break;

            uint256 nameStart = indexOf(raw, NAME_KEY_MARKER, entryStart);
            if (nameStart == type(uint256).max) revert MalformedAbiEntry(entryStart);
            nameStart += NAME_KEY_MARKER.length;
            uint256 nameEnd = indexOfQuote(raw, nameStart);

            collected[collectedCount] = string(slice(raw, nameStart, nameEnd));
            ++collectedCount;
            cursor = nameEnd;
        }

        string[] memory names = new string[](collectedCount);
        for (uint256 i; i < collectedCount; ++i) {
            names[i] = collected[i];
        }
        return names;
    }

    function indexOf(bytes memory haystack, bytes memory needle, uint256 from)
        internal
        pure
        returns (uint256)
    {
        uint256 needleLength = needle.length;
        if (needleLength == 0 || haystack.length < needleLength) return type(uint256).max;

        uint256 limit = haystack.length - needleLength;
        for (uint256 i = from; i <= limit; ++i) {
            bool matched = true;
            for (uint256 j; j < needleLength; ++j) {
                if (haystack[i + j] != needle[j]) {
                    matched = false;
                    break;
                }
            }
            if (matched) return i;
        }

        return type(uint256).max;
    }

    function indexOfQuote(bytes memory haystack, uint256 from) internal pure returns (uint256) {
        for (uint256 i = from; i < haystack.length; ++i) {
            if (haystack[i] == 0x22) return i;
        }
        revert MalformedAbiEntry(from);
    }

    function slice(bytes memory data, uint256 start, uint256 end)
        internal
        pure
        returns (bytes memory result)
    {
        result = new bytes(end - start);
        for (uint256 i; i < end - start; ++i) {
            result[i] = data[start + i];
        }
    }

    function contains(string[] memory values, string memory needle) internal pure returns (bool) {
        bytes32 target = keccak256(bytes(needle));
        for (uint256 i; i < values.length; ++i) {
            if (keccak256(bytes(values[i])) == target) return true;
        }
        return false;
    }
}
