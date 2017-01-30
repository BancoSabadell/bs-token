pragma solidity ^0.4.2;

import "Stoppable.sol";

contract BSTokenData is Stoppable {
    string public standard = 'BSToken 0.1';
    string public name = 'BSToken';
    string public symbol = 'BST';
    uint8 public decimals = 2;

    /* Only merchant contracts can interact with the data */
    mapping (address => bool) public merchants;

    struct Account {
        uint256 balance;
        bool frozen;
        mapping (address => uint256) allowance;
        mapping (address => bool) frozenForMerchant;
    }
    
    /* Total token supply */
    uint256 public totalSupply;
    /* Accounts or "wallets" */
    mapping (address => Account) public accounts;

    function setBalance(address account, uint256 balance) onlyAdminOrMerchants stopInEmergency {
        accounts[account].balance = balance;
    }

    function getBalance(address account) constant returns (uint256) {
        return accounts[account].balance;
    }

    function setTotalSupply(uint256 aTotalSupply) onlyAdminOrMerchants stopInEmergency {
        totalSupply = aTotalSupply;
    }

    function getTotalSupply() constant returns (uint256) {
        return totalSupply;
    }

    function setAllowance(address account, address spender, uint256 amount) onlyAdminOrMerchants stopInEmergency {
        accounts[account].allowance[spender] = amount;
    }

    function getAllowance(address account, address spender) constant returns (uint256) {
        return accounts[account].allowance[spender];
    }

    function freezeAccount(address account, bool freeze) onlyAdmin {
        accounts[account].frozen = freeze;
    }

    function frozenAccount(address account) constant returns (bool) {
        return accounts[account].frozen;
    }

    function freezeAccountForMerchant(address account, bool freeze) onlyAdminOrMerchants stopInEmergency {
        accounts[account].frozenForMerchant[msg.sender] = freeze;
    }

    function frozenAccountForMerchant(address account) constant returns (bool) {
        return accounts[account].frozenForMerchant[msg.sender];
    }

    function addMerchant(address merchant) onlyAdmin {
        merchants[merchant] = true;
    }

    function removeMerchant(address merchant) onlyAdmin {
        delete merchants[merchant];
    }

    modifier onlyAdmin {
        if (msg.sender != owner) throw;
        _;
    }

    modifier onlyAdminOrMerchants {
        if (msg.sender != owner && !merchants[msg.sender]) throw;
        _;
    }
}