pragma solidity 0.8.24;

import {
    IInvoiceRegistry,
    InvoiceIssued,
    InvoiceRepaid,
    FaceValueZero,
    RepaymentAmountZero,
    InvoiceDoesNotExist
} from "./interfaces/IInvoiceRegistry.sol";

contract InvoiceRegistry is IInvoiceRegistry {
    struct Invoice {
        address issuer;
        uint256 faceValue;
        uint256 issuedAt;
        uint256 repaidTotal;
        string invoiceReference;
    }

    uint256 public invoiceCount;

    mapping(uint256 => Invoice) private invoices;

    function issueInvoice(uint256 faceValue, string calldata invoiceReference)
        external
        returns (uint256 invoiceId)
    {
        if (faceValue == 0) revert FaceValueZero();

        invoiceId = ++invoiceCount;

        Invoice storage invoice = invoices[invoiceId];
        invoice.issuer = msg.sender;
        invoice.faceValue = faceValue;
        invoice.issuedAt = block.timestamp;
        invoice.invoiceReference = invoiceReference;

        emit InvoiceIssued(invoiceId, msg.sender, faceValue, block.timestamp);
    }

    function repayInvoice(uint256 invoiceId, uint256 amount) external {
        if (amount == 0) revert RepaymentAmountZero();

        Invoice storage invoice = invoices[invoiceId];
        if (invoice.issuedAt == 0) revert InvoiceDoesNotExist(invoiceId);

        invoice.repaidTotal += amount;

        emit InvoiceRepaid(invoiceId, msg.sender, amount, block.timestamp);
    }

    function getInvoice(uint256 invoiceId)
        external
        view
        returns (
            address issuer,
            uint256 faceValue,
            uint256 issuedAt,
            uint256 repaidTotal,
            string memory invoiceReference
        )
    {
        Invoice storage invoice = invoices[invoiceId];
        if (invoice.issuedAt == 0) revert InvoiceDoesNotExist(invoiceId);

        return (
            invoice.issuer,
            invoice.faceValue,
            invoice.issuedAt,
            invoice.repaidTotal,
            invoice.invoiceReference
        );
    }
}
