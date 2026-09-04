pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";

import {INativeQueryVerifier} from "../src/interfaces/INativeQueryVerifier.sol";
import {IAttestationVerifier} from "../src/interfaces/IAttestationVerifier.sol";
import {AttestcoinVerifier} from "../src/AttestcoinVerifier.sol";
import {TrancheWaterfall} from "../src/TrancheWaterfall.sol";

contract DeployCreditcoin is Script {
    uint256 internal constant CREDITCOIN_CC3_TESTNET_CHAIN_ID = 102031;
    address internal constant BLOCK_PROVER_PRECOMPILE = 0x0000000000000000000000000000000000000FD2;
    uint256 internal constant DEFAULT_SEPOLIA_CHAIN_KEY = 1;
    uint256 internal constant DEFAULT_SENIOR_CAP = 70_000e18;
    uint256 internal constant DEFAULT_JUNIOR_CAP = 30_000e18;

    error UnexpectedChainId(uint256 actual, uint256 expected);

    function run() external returns (AttestcoinVerifier verifier, TrancheWaterfall waterfall) {
        if (block.chainid != CREDITCOIN_CC3_TESTNET_CHAIN_ID) {
            revert UnexpectedChainId(block.chainid, CREDITCOIN_CC3_TESTNET_CHAIN_ID);
        }

        address invoiceRegistry = vm.envAddress("INVOICE_REGISTRY_ADDRESS");
        uint64 sepoliaChainKey = uint64(vm.envOr("SEPOLIA_CHAIN_KEY", DEFAULT_SEPOLIA_CHAIN_KEY));
        uint64 minSourceHeight = uint64(vm.envUint("MIN_SOURCE_HEIGHT"));
        uint256 seniorCap = vm.envOr("SENIOR_CAP", DEFAULT_SENIOR_CAP);
        uint256 juniorCap = vm.envOr("JUNIOR_CAP", DEFAULT_JUNIOR_CAP);

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        verifier = new AttestcoinVerifier(
            INativeQueryVerifier(BLOCK_PROVER_PRECOMPILE),
            sepoliaChainKey,
            invoiceRegistry
        );
        waterfall = new TrancheWaterfall(
            IAttestationVerifier(address(verifier)),
            seniorCap,
            juniorCap,
            minSourceHeight
        );
        vm.stopBroadcast();

        console.log("chainId", block.chainid);
        console.log("deployBlockNumber", block.number);
        console.log("AttestcoinVerifier", address(verifier));
        console.log("TrancheWaterfall", address(waterfall));
        console.log("blockProverPrecompile", BLOCK_PROVER_PRECOMPILE);
        console.log("invoiceRegistry", invoiceRegistry);
        console.log("sepoliaChainKey", sepoliaChainKey);
        console.log("minSourceHeight", minSourceHeight);
        console.log("seniorCap", seniorCap);
        console.log("juniorCap", juniorCap);
    }
}
