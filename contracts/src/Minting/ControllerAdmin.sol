// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {Ownable} from "../TokenContracts/Ownable.sol";

/**
 * @title ControllerAdmin
 * @notice Contract that lets the owner set a controller admin who can add or remove controllers. Only the contract owner can modify the admin.
 * @dev Inherits from the Ownable contract to manage ownership functionality.
 */
contract ControllerAdmin is Ownable {
    /// @notice The address of the controller admin.
    address internal _controllerAdmin;

    /// @notice The maximum number of minters allowed.
    uint256 internal _maxNumOfMinters;

    /// @notice Emitted when the controller admin is changed.
    /// @param admin The new admin address.
    event ControllerAdminChanged(address indexed admin);

    /// @notice Modifier to check if the caller is the controller admin.
    modifier onlyControllerAdmin() {
        if (msg.sender != _controllerAdmin) {
            revert ControllerAdmin__CallerNotControllerAdmin();
        }
        _;
    }

    /* Errors */
    error ControllerAdmin__NoZeroAddress();
    error ControllerAdmin__CallerNotControllerAdmin();
    error ControllerAdmin__MaxMintersCannotBeZero();

    /**
     * @notice Gets the address of the current controller admin.
     * @return The address of the controller admin.
     */
    function getControllerAdmin() external view returns (address) {
        return _controllerAdmin;
    }

    /**
     * @notice Sets a new controller admin.
     * @dev Only the contract owner can call this function.
     * @param _newAdmin The address of the new controller admin.
     */
    function setControllerAdmin(address _newAdmin) external onlyOwner {
        if (_newAdmin == address(0)) {
            revert ControllerAdmin__NoZeroAddress();
        }
        _controllerAdmin = _newAdmin;
        emit ControllerAdminChanged(_controllerAdmin);
    }

    /**
     * @notice Sets the maximum number of minters allowed.
     * @dev Only the controller admin can call this function.
     * @param _newMax The new maximum number of minters.
     */
    function setMaxNumberOfMinters(uint256 _newMax) external onlyControllerAdmin {
        _setMaxNumberOfMinters(_newMax);
    }

    /**
     * @notice Internal function to set the maximum number of minters allowed.
     * @param _newMax The new maximum number of minters.
     */
    function _setMaxNumberOfMinters(uint256 _newMax) internal {
        if (_newMax == 0) {
            revert ControllerAdmin__MaxMintersCannotBeZero();
        }
        _maxNumOfMinters = _newMax;
    }

    /**
     * @notice Gets the maximum number of minters allowed.
     * @return The maximum number of minters.
     */
    function getMaxMinters() external view returns (uint256) {
        return _maxNumOfMinters;
    }

    // Storage Gap for future upgrades
    uint256[49] private __gap;
}
