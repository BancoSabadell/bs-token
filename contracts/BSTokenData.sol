pragma solidity ^0.4.2;

import "Ownable.sol";

contract BSTokenData is Ownable {

    /* Total token supply */
    uint256 public totalSupply;
    /* Get the account balance */
    mapping (address => uint256) public balanceOf;
    
    function addToBalance(address account, uint256 amount) {
        balanceOf[account] += amount;
        totalSupply += amount;
    }

}