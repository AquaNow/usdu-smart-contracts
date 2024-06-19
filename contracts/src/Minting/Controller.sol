// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

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
    /// @notice Mapping to check if an address is a minter.
    mapping(address => bool) public isMinter;

    /// @notice Event emitted when a controller is configured.
    event ControllerConfigured(address indexed _controller, address indexed _minter);
    /// @notice Event emitted when a controller is removed.
    event ControllerRemoved(address indexed _controller);
    /// @notice Event emitted when a signer is modified.
    event SignerModified(address indexed _signer);

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
     * @param _controller The address of the controller.
     * @param _minter The address of the minter.
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
        if (minterController[_minter] == address(0)) {
            minterController[_minter] = _controller;
        }
        if (minterController[_minter] != _controller) {
            revert Controller__MinterHasController();
        }
        controllers[_controller].push(_minter);
        isMinter[_minter] = true;
        isController[_controller] = true;
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
        if (!isController[msg.sender]) {
            revert Controller__CallerNotController();
        }
        return controllers[_controller];
    }

    /**
     * @notice Disables a controller by setting its worker to address(0).
     * @param _controller The address of the controller to disable.
     */
    function removeController(address _controller) external onlyControllerAdmin {
        if (_controller == address(0)) {
            revert Controller__ControllerAddressIsZero();
        }
        isController[_controller] = false;
        delete controllers[_controller];
        emit ControllerRemoved(_controller);
    }
}
