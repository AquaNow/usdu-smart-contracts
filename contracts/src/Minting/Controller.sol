// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {ControllerAdmin} from "./ControllerAdmin.sol";

/**
 * @title Controller
 * @notice Generic implementation of the owner-controller-worker model.
 * One owner manages many controllers. Each controller manages one worker.
 * Workers may be reused across different controllers.
 */
contract Controller is ControllerAdmin {
    /**
     * @notice A controller manages a single worker address.
     * controllers[controller] = worker
     */
    mapping(address => address[]) public controllers;
    mapping(address => address) public minterController;
    mapping(address => bool) public isController;
    mapping(address => bool) public isMinter;

    event ControllerConfigured(
        address indexed _controller,
        address indexed _minter
    );

    event ControllerRemoved(address indexed _controller);
    event SignerModified(address indexed _signer);

    /**
     * @notice Ensures that caller is the controller of a non-zero worker
     * address.
     */
    modifier onlyController() {
        if (!isController[msg.sender]) {
            revert Controller__OnlyControllers();
        }
        _;
    }

    /* Errors */
    error Controller__OnlyControllers();
    error Controller__NoZeroAddress();
    error Controller__MinterHasController();
    error Controller__ControllerNoMinters();
    error Controller__CallerNotController();
    error Controller__ControllerHasNoMinters();

    function configureController(address _controller, address _minter)
        external
        onlyControllerAdmin
    {
        if (_controller == address(0)) {
            revert Controller__NoZeroAddress();
        }
        if (_minter == address(0)) {
            revert Controller__NoZeroAddress();
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
     * @notice Gets the minter at address _controller.
     */
    function getMinters(address _controller)
        external
        view
        returns (address[] memory)
    {
        if (controllers[_controller].length == 0) {
            revert Controller__ControllerNoMinters();
        }
        if (!isController[msg.sender]) {
            revert Controller__CallerNotController();
        }
        return controllers[_controller];
    }

    /**
     * @notice disables a controller by setting its worker to address(0).
     * @param _controller The controller to disable.
     */
    function removeController(address _controller) external onlyControllerAdmin {
        if (_controller == address(0)) {
            revert Controller__NoZeroAddress();
        }
        if (controllers[_controller].length == 0) {
            revert Controller__ControllerHasNoMinters();
        }
        isController[_controller] = false;
        delete controllers[_controller];
        emit ControllerRemoved(_controller);
    }
}