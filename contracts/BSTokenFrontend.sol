import "BSToken.sol";
import "Ownable.sol";
import "Token.sol";
import "BSTokenData.sol";
import "TokenRecipient.sol";

pragma solidity ^0.4.2;

contract BSTokenFrontend is Token, Ownable {
    event CashOut(address indexed receiver, uint256 amount, string bankAccount);

    BSToken public bsToken;
    address public merchant;

    function BSTokenFrontend(address addressBSToken) {
        setBSToken(addressBSToken);
    }

    function balanceOf(address account) constant returns (uint256) {
        return bsToken.balanceOf(account);
    }

    function totalSupply() constant returns (uint256) {
        return bsToken.totalSupply();
    }

    function frozenAccount(address account) constant returns (bool) {
        return bsToken.frozenAccount(account);
    }

    function allowance(address account, address spender) constant returns (uint256) {
        return bsToken.allowance(account, spender);
    }

    function transfer(address to, uint256 value) returns (bool success) {
        if (bsToken.transfer(msg.sender, to, value)) {
            Transfer(msg.sender, to, value);
            return true;
        }

        return false;
    }

    function transferFrom(address from, address to, uint256 value) returns (bool success) {
        if (bsToken.transferFrom(msg.sender, from, to, value)) {
            Transfer(from, to, value);
            return true;
        }

        return false;
    }

    function approve(address spender, uint256 value) returns (bool success) {
        Approval(msg.sender, spender, value);
        return bsToken.approve(msg.sender, spender, value);
    }

    /* Approve and then communicate the approved contract in a single tx */
    function approveAndCall(address spender, address to, string id, uint256 value)  {
        if (approve(spender, value)) {
            TokenRecipient delegate = TokenRecipient(spender);
            delegate.receiveApproval(msg.sender, to, id, value);
        }
    }

    function freezeAccount(address target, bool freeze) onlyAdminOrMerchant {
        bsToken.freezeAccount(target, freeze);
    }

    function setBSToken(address version) onlyAdmin {
        bsToken = BSToken(version);
    }

    function setMerchant(address aMerchant) onlyAdmin {
        merchant = aMerchant;
    }

    function startEmergency() onlyAdminOrMerchant {
        bsToken.startEmergency();
    }

    function stopEmergency() onlyAdminOrMerchant {
        bsToken.stopEmergency();
    }

    function emergency() constant returns (bool) {
        return bsToken.emergency();
    }

    modifier onlyAdmin {
        if (msg.sender != owner) throw;
        _;
    }

    modifier onlyAdminOrMerchant {
        if (msg.sender != owner && msg.sender != merchant) throw;
        _;
    }
}