pragma solidity ^0.4.2;

import 'Ownable.sol';

contract Stoppable is Ownable {

    bool public emergency;

    modifier stopInEmergency {
        if (emergency) throw;
        _;
    }

    function startEmergency() external onlyOwner {
        emergency = true;
    }

    function stopEmergency() external onlyOwner {
        emergency = false;
    }
}
