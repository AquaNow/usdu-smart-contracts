// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

import {Ownable} from "./Ownable.sol";

/**
 * @title PermissionAdmin
 * @notice Base contract which allows the owner to set an admin with the ability to select the pauser, blacklister, and rescuer.
 * @dev Only the contract owner can modify the admin. The admin has special permissions defined by this contract.
 */
abstract contract PermissionAdmin is Ownable {
    address private _permissionAdmin;

    /// @notice Emitted when the permission admin is changed.
    /// @param admin The new permission admin.
    event PermissionAdminChanged(address indexed admin);

    /// @notice Error thrown when the caller is not the permission admin.
    error PermissionAdmin__CallerNotPermissionAdmin();

    /// @notice Error thrown when trying to set the permission admin to the zero address.
    error PermissionAdmin__NoZeroAddress();
    
    /**
     * @dev Modifier to make a function callable only by the permission admin.
     */
    modifier onlyPermissionAdmin() {
        if (msg.sender != _permissionAdmin) {
            revert PermissionAdmin__CallerNotPermissionAdmin();
        }
        _;
    }

    /**
     * @notice Returns the current permission admin.
     * @return The address of the current permission admin.
     */
    function getPermissionAdmin() external view returns (address) {
        return _permissionAdmin;
    }

    /**
     * @notice Sets a new permission admin.
     * @param _newAdmin The address of the new permission admin.
     * @dev Only the contract owner can call this function. The new admin address cannot be the zero address.
     */
    function setPermissionAdmin(address _newAdmin) external onlyOwner {
        if (_newAdmin == address(0)) revert PermissionAdmin__NoZeroAddress();
        _permissionAdmin = _newAdmin;
        emit PermissionAdminChanged(_permissionAdmin);
    }

    // Storage Gap for future upgrades
    uint256[49] private __gap;
}
