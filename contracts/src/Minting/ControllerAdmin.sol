// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {Ownable} from "../TokenContracts/Ownable.sol";

/**
 * @notice Contract that lets owner set a controller admin that can add or remove
 * controllers. Only the contract owner can modify the admin.
 */
contract ControllerAdmin is Ownable {
    address internal _controllerAdmin;
    uint256 internal _maxNumOfMinters;

    event ControllerAdminChanged(address indexed admin);

    modifier onlyControllerAdmin() {
        if (msg.sender == address(0)) {
            revert ControllerAdmin__NoZeroAddress();
        }
        if (msg.sender != _controllerAdmin) {
            revert ControllerAdmin__CallerNotControllerAdmin();
        }
        _;
    }

    /* Errors */
    error ControllerAdmin__NoZeroAddress();
    error ControllerAdmin__CallerNotControllerAdmin();

    function getControllerAdmin() external view returns (address) {
        return _controllerAdmin;
    }

    function setControllerAdmin(address _newAdmin) external onlyOwner {
        if (_newAdmin == address(0)) {
            revert ControllerAdmin__NoZeroAddress();
        }
        _controllerAdmin = _newAdmin;
        emit ControllerAdminChanged(_controllerAdmin);
    }

    function setMaxNumberOfMinters(uint256 _newMax) external onlyControllerAdmin {
        _setMaxNumberOfMinters(_newMax);
    }

    function _setMaxNumberOfMinters(uint256 _newMax) internal {
        if (_newMax == 0) {
            revert ControllerAdmin__NoZeroAddress();
        }
        _maxNumOfMinters = _newMax;
    }

    function getMaxMinters() external view returns (uint256) {
        return _maxNumOfMinters;
    }
}
