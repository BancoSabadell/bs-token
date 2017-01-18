pragma solidity ^0.4.2;

import "Ownable.sol";

contract BSTokenData is Ownable {

    struct Account {
        uint256 balance;
    }

    /* Total token supply */
    uint256 public totalSupply;
    /* Get the account balance */
    mapping (address => Account) internal accounts;

    function balanceOf(address account) onlyOwner constant returns (uint256) {
        return accounts[account].balance;
    }

    function addToBalance(address account, uint256 amount) onlyOwner {
        accounts[account].balance += amount;
        totalSupply += amount;
    }

}