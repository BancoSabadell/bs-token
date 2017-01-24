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

    function setBalance(address account, uint256 balance) onlyOwner {
        accounts[account].balance = balance;
    }

    function getBalance(address account) onlyOwner constant returns (uint256) {
        return accounts[account].balance;
    }

    function setTotalSupply(uint256 aTotalSupply) onlyOwner {
        totalSupply = aTotalSupply;
    }

    function getTotalSupply() onlyOwner returns (uint256) {
        return totalSupply;
    }

    function setAllowance(address account, address spender, uint256 amount) onlyOwner {
        accounts[account].allowance[spender] = amount;
    }

    function getAllowance(address account, address spender) onlyOwner constant returns (uint256) {
        return accounts[account].allowance[spender];
    }

    function freezeAccount(address account, bool freeze) onlyOwner {
        accounts[account].frozen = freeze;
    }

    function frozenAccount(address account) onlyOwner constant returns (bool) {
        return accounts[account].frozen;
    }
}