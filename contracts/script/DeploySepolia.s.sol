pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";

import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";

contract DeploySepolia is Script {
    uint256 internal constant ETHEREUM_SEPOLIA_CHAIN_ID = 11155111;

    error UnexpectedChainId(uint256 actual, uint256 expected);

    function run() external returns (InvoiceRegistry registry) {
        if (block.chainid != ETHEREUM_SEPOLIA_CHAIN_ID) {
            revert UnexpectedChainId(block.chainid, ETHEREUM_SEPOLIA_CHAIN_ID);
        }

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        registry = new InvoiceRegistry();
        vm.stopBroadcast();

        console.log("chainId", block.chainid);
        console.log("deployBlockNumber", block.number);
        console.log("InvoiceRegistry", address(registry));
    }
}
