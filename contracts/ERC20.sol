pragma solidity ^0.4.4;

/*
 * ERC: Token standard
 * https://github.com/ethereum/EIPs/issues/20
 *
 * The following describes standard functions a token contract can implement.
 *
 * Those will allow dapps and wallets to handle tokens across multiple interfaces/dapps.
 * The most important here are: transfer(), balanceOf() and the Transfer event.
 */
contract ERC20 {

    /* Triggered when tokens are transferred. */
    event Transfer(address indexed _from, address indexed _to, uint256 _value);

    /* Triggered whenever approve(address _spender, uint256 _value) is called. */
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);

    /* Get the total token supply */
    function totalSupply() constant returns (uint256 totalSupply);

    /* Get the account balance of another account with address _owner */
    function balanceOf(address _owner) constant returns (uint256 balance);

    /* Send _value amount of tokens to address _to */
    function transfer(address _to, uint256 _value) returns (bool success);

    /* Send _value amount of tokens from address _from to address _to

     The transferFrom method is used for a withdraw workflow, allowing
     contracts to send tokens on your behalf, for example to "deposit"
     to a contract address and/or to charge fees in sub-currencies; the
     command should fail unless the _from account has deliberately authorized
     the sender of the message via some mechanism;
     */
    function transferFrom(address _from, address _to, uint256 _value) returns (bool success);

    /* Allow _spender to withdraw from your account, multiple times, up
    to the _value amount. If this function is called again it overwrites
    the current allowance with _value.
     */
    function approve(address spender, uint value) returns (bool ok);

    /* Returns the amount which _spender is still allowed to withdraw from _owner */
    function allowance(address owner, address spender) constant returns (uint);
}
