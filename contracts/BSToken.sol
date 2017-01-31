import "Ownable.sol";
import "BSTokenData.sol";
import "Stoppable.sol";
import "BSBanking.sol";

pragma solidity ^0.4.2;

contract BSToken is Stoppable {
    BSTokenData public tokenData;
    BSBanking public bsBanking;

    /* Initializes contract with initial supply tokens to the creator of the contract */
    function BSToken(address bsTokenDataAddress, address bsBankingAddress) {
        tokenData = BSTokenData(bsTokenDataAddress);
        bsBanking = BSBanking(bsBankingAddress);
    }

    /* Get the account balance */
    function balanceOf(address account)
        onlyFrontend
        constant returns (uint256) {
            return tokenData.getBalance(account);
    }

    /* Get the total token supply */
    function totalSupply()
        onlyFrontend
        constant returns (uint256) {
            return tokenData.totalSupply();
    }

    function frozenAccount(address account)
        onlyFrontend
        constant returns (bool) {
            return tokenData.frozenAccountForMerchant(account);
    }

    /* Returns the amount which 'spender' is still allowed to withdraw from 'account' */
    function allowance(address account, address spender)
        onlyFrontend
        constant returns (uint256) {
            return tokenData.getAllowance(account, spender);
    }

    /* Send 'value' amount of tokens to address 'to' */
    function transfer(address sender, address to, uint256 value)
        onlyFrontend stopInEmergency accountIsNotFrozen(sender)
        returns (bool success) {
            if (tokenData.getBalance(to) + value < tokenData.getBalance(to)) throw; // Check for overflows

            if (tokenData.getBalance(sender) >= value && value > 0) {
                tokenData.setBalance(sender, tokenData.getBalance(sender) - value);
                tokenData.setBalance(to, tokenData.getBalance(to) + value);
                return true;
            } else {
                return false;
            }
    }

    /* Send 'value' amount of tokens from address 'from' to address 'to'

     The transferFrom method is used for a withdraw workflow, allowing contracts
     to send tokens on your behalf, for example to "deposit" to a contract address
     and/or to charge fees in sub-currencies; the command should fail unless the
     'from' account has deliberately authorized the sender of the message via some
     mechanism
     */
    function transferFrom(address sender, address from, address to, uint256 value)
        onlyFrontend stopInEmergency accountIsNotFrozen(from)
        returns (bool success) {
            if (tokenData.getBalance(to) + value < tokenData.getBalance(to)) throw;  // Check for overflows

            if (tokenData.getBalance(from) >= value && tokenData.getAllowance(from, sender) >= value && value > 0) {
                tokenData.setBalance(to, tokenData.getBalance(to) + value);
                tokenData.setBalance(from, tokenData.getBalance(from) - value);
                tokenData.setAllowance(from, sender, tokenData.getAllowance(from, sender) - value);
                return true;
            } else {
                return false;
            }
    }

    /* Allow 'spender' to withdraw from your account, multiple times, up to the
     'value' amount. If this function is called again it overwrites the current
     allowance with 'value'.
     */
    function approve(address sender, address spender, uint256 value)
        onlyFrontend stopInEmergency accountIsNotFrozen(sender)
        returns (bool success) {
            tokenData.setAllowance(sender, spender, value);
            return true;
    }

    function freezeAccount(address target, bool freeze)
        onlyFrontend {
            tokenData.freezeAccountForMerchant(target, freeze);
    }

    function cashOut(address sender, uint256 amount, string bankAccount)
        onlyFrontend stopInEmergency accountIsNotFrozen(sender) {
            bsBanking.cashOut(sender, amount, bankAccount);
    }

    modifier accountIsNotFrozen(address target) {
        if (frozenAccount(target))
            throw;
        _;
    }

    modifier onlyFrontend {
        if (msg.sender != owner) throw;
        _;
    }

    /* This unnamed function is called whenever someone tries to send ether to it */
    function () {
        throw;     // Prevents accidental sending of ether
    }
}