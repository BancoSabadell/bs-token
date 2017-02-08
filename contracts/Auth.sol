pragma solidity ^0.4.2;

import "PermissionManager.sol";

contract Auth {
    PermissionManager pm;
    address public merchant;

    modifier onlyAdminOrMerchant {
        if (!pm.getNetworkAdmin(pm.getRol(msg.sender)) && msg.sender != merchant) throw;
        _;
    }

    modifier onlyAdmin {
        if (!pm.getNetworkAdmin(pm.getRol(msg.sender))) throw;
        _;
    }

    function init(address theMerchant, address permissionManagerAddress) internal {
        merchant = theMerchant;
        pm = PermissionManager(permissionManagerAddress);
    }
}
