pragma solidity ^0.4.2;

import "Ownable.sol";

contract BSTokenData is Ownable {

    struct Account {
        uint256 balance;
        bool frozen;
        mapping (address => uint256) allowance;
    }

    /* Total token supply */
    uint256 public totalSupply;
    /* Accounts or "wallets" */
    mapping (address => Account) internal accounts;

    function balanceOf(address account) onlyOwner constant returns (uint256) {
        return accounts[account].balance;
    }

    function addToBalance(address account, uint256 amount) onlyOwner {
        accounts[account].balance += amount;
        totalSupply += amount;
    }

    function freezeAccount(address account, bool freeze) onlyOwner {
        accounts[account].frozen = freeze;
    }

    function frozenAccount(address account) onlyOwner constant returns (bool) {
        return accounts[account].frozen;
    }

    function approve(address account, address spender, uint256 amount) onlyOwner {
        accounts[account].allowance[spender] = amount;
    }

    function allowance(address account, address spender) onlyOwner constant returns (uint256) {
        return accounts[account].allowance[spender];
    }

    function reduceAllowance(address account, address spender, uint256 amount) onlyOwner {
        accounts[account].allowance[spender] -= amount;
    }

}