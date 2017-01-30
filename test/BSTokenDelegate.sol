import "BSTokenFrontend.sol";
import "TokenRecipient.sol";

pragma solidity ^0.4.2;

contract BSTokenDelegate is TokenRecipient {
    BSTokenFrontend token;
    address public someAddress;

    function BSTokenDelegate(address bsTokenAddress){
        token = BSTokenFrontend(bsTokenAddress);
    }

    function receiveApproval(address from, address to, string id, uint256 value) {
        someAddress = from;
    }
}