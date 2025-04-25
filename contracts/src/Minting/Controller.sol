// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

import {ControllerAdmin} from "./ControllerAdmin.sol";

/**
 * @title Controller
 * @notice Generic implementation of the owner-controller-minters model.
 * One owner manages many controllers. Each controller manages multiple minters.
 * Each minter is associated with a single controller.
 * @dev Inherits from the ControllerAdmin contract.
 */
contract Controller is ControllerAdmin {
    /**
     * @notice A controller manages multiple minter addresses.
     * controllers[controller] = array of minters
     */
    mapping(address => address[]) public controllers;
    /// @notice Mapping from minter addresses to their controllers.
    mapping(address => address) public minterController;
    /// @notice Mapping to check if an address is a controller.
    mapping(address => bool) public isController;
    /// @notice Total number of active controllers
    uint256 public numberOfControllers;

    /// @notice Event emitted when a controller is configured.
    event ControllerConfigured(address indexed _controller, address indexed _minter);
    /// @notice Event emitted when a controller is removed.
    event ControllerRemoved(address indexed _controller);

    /**
     * @notice Ensures that the caller is the controller of a non-zero minter address.
     */
    modifier onlyController() {
        if (!isController[msg.sender]) {
            revert Controller__OnlyControllers();
        }
        _;
    }

    /* Errors */
    error Controller__OnlyControllers();
    error Controller__ControllerAddressIsZero();
    error Controller__MinterAddressIsZero();
    error Controller__MinterHasController();
    error Controller__ControllerNoMinters();
    error Controller__CallerNotController();

    /**
    * @notice Configures a controller with a minter.
    * @dev This function is called exclusively by the ControllerAdmin to perform the initial configuration of the controller and minter.
    * @param _controller The address of the controller.
    * @param _minter The address of the minter.
    * @custom:restriction This function can only be called by the ControllerAdmin.
    */
    function configureController(
        address _controller,
        address _minter
    ) external onlyControllerAdmin {
        if (_controller == address(0)) {
            revert Controller__ControllerAddressIsZero();
        }
        if (_minter == address(0)) {
            revert Controller__MinterAddressIsZero();
        }
        if(minterController[_minter] != address(0)) {
            revert Controller__MinterHasController();
        }
        minterController[_minter] = _controller;
        controllers[_controller].push(_minter);
        
        if (!isController[_controller]) {
            isController[_controller] = true;
            numberOfControllers++;
        }
        
        emit ControllerConfigured(_controller, _minter);
    }

    /**
     * @notice Gets the minters for a given controller.
     * @param _controller The address of the controller.
     * @return An array of addresses of minters managed by the controller.
     */
    function getMinters(address _controller) external view returns (address[] memory) {
        if (controllers[_controller].length == 0) {
            revert Controller__ControllerNoMinters();
        }
        return controllers[_controller];
    }

    /**
     * @notice Disables a controller, removing all associated minters and setting the controller's status to inactive.
     * @dev This function will clear the list of minters associated with the specified controller and delete the controller's record. It will also emit a ControllerRemoved event.
     * @param _controller The address of the controller to disable. This address must not be the zero address.
     */
    function removeController(address _controller) external onlyControllerAdmin {
        if (_controller == address(0)) {
            revert Controller__ControllerAddressIsZero();
        }
        address[] memory minters = controllers[_controller];
        for (uint256 i = 0; i < minters.length; i++) {
            minterController[minters[i]] = address(0);
        }
        
        if (isController[_controller]) {
            isController[_controller] = false;
            numberOfControllers--;
        }
        
        delete controllers[_controller];
        emit ControllerRemoved(_controller);
    }

    /**
     * @notice Checks if an address is a minter.
     * @param _minter The address to check.
     * @return True if the address is a minter, false otherwise.
     */
    function isMinter(address _minter) external view returns (bool) {
        return minterController[_minter] != address(0);
    }

    // Storage Gap for future upgrades
    uint256[48] private __gap;
}
