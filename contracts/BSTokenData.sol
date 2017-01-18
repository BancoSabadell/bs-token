pragma solidity ^0.4.2;

import "Ownable.sol";

contract BSTokenData is Ownable {

    /* Get the account balance */
    mapping (address => uint256) public balanceOf;
    
    function addToBalance(address account, uint256 amount) {
        balanceOf[account] += amount;
    }

}