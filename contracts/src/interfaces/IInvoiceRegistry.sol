pragma solidity 0.8.24;

event InvoiceIssued(uint256 indexed invoiceId, address indexed issuer, uint256 faceValue, uint256 issuedAt);
event InvoiceRepaid(uint256 indexed invoiceId, address indexed payer, uint256 amount, uint256 repaidAt);

error FaceValueZero();
error RepaymentAmountZero();
error InvoiceDoesNotExist(uint256 invoiceId);

interface IInvoiceRegistry {
    function issueInvoice(uint256 faceValue, string calldata invoiceReference)
        external
        returns (uint256 invoiceId);

    function repayInvoice(uint256 invoiceId, uint256 amount) external;

    function invoiceCount() external view returns (uint256);

    function getInvoice(uint256 invoiceId)
        external
        view
        returns (
            address issuer,
            uint256 faceValue,
            uint256 issuedAt,
            uint256 repaidTotal,
            string memory invoiceReference
        );
}
