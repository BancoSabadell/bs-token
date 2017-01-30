pragma solidity ^0.4.2;

contract Ownable {

    address public owner;

    event SetOwner(address indexed previousOwner, address indexed newOwner);

    function Ownable () {
        owner = msg.sender;
    }

    modifier onlyOwner {
        if (msg.sender != owner) throw;
        _;
    }

    function transferOwnership(address newOwner) onlyOwner {
        SetOwner(owner, newOwner);
        owner = newOwner;
    }

}
