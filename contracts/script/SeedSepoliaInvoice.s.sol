pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";

import {IInvoiceRegistry} from "../src/interfaces/IInvoiceRegistry.sol";

contract SeedSepoliaInvoice is Script {
    uint256 internal constant ETHEREUM_SEPOLIA_CHAIN_ID = 11155111;
    uint256 internal constant DEFAULT_FACE_VALUE = 100_000e18;
    uint256 internal constant DEFAULT_REPAYMENT_AMOUNT = 40_000e18;

    error UnexpectedChainId(uint256 actual, uint256 expected);

    function issue() external returns (uint256 invoiceId) {
        if (block.chainid != ETHEREUM_SEPOLIA_CHAIN_ID) {
            revert UnexpectedChainId(block.chainid, ETHEREUM_SEPOLIA_CHAIN_ID);
        }

        IInvoiceRegistry registry = IInvoiceRegistry(vm.envAddress("INVOICE_REGISTRY_ADDRESS"));
        uint256 faceValue = vm.envOr("INVOICE_FACE_VALUE", DEFAULT_FACE_VALUE);
        string memory invoiceReference = vm.envOr("INVOICE_REFERENCE", string("SYNTHETIC-TESTNET-INVOICE-001"));

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        invoiceId = registry.issueInvoice(faceValue, invoiceReference);
        vm.stopBroadcast();

        console.log("invoiceId", invoiceId);
        console.log("faceValue", faceValue);
    }

    function repay() external {
        if (block.chainid != ETHEREUM_SEPOLIA_CHAIN_ID) {
            revert UnexpectedChainId(block.chainid, ETHEREUM_SEPOLIA_CHAIN_ID);
        }

        IInvoiceRegistry registry = IInvoiceRegistry(vm.envAddress("INVOICE_REGISTRY_ADDRESS"));
        uint256 invoiceId = vm.envUint("INVOICE_ID");
        uint256 amount = vm.envOr("REPAYMENT_AMOUNT", DEFAULT_REPAYMENT_AMOUNT);

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        registry.repayInvoice(invoiceId, amount);
        vm.stopBroadcast();

        console.log("invoiceId", invoiceId);
        console.log("repaymentAmount", amount);
    }
}
