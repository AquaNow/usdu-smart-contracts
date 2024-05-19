// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {PermissionAdmin} from "./PermissionAdmin.sol";

/**
 * @notice Base contract which allows children to implement an emergency stop
 * mechanism
 */
contract Pausable is PermissionAdmin {

    address internal _pauser;
    bool public paused;

    event Paused();
    event Unpaused();
    event PauserChanged(address indexed newPauser);

    error Pausable__Paused();
    error Pausable__NotPauser();
    error Pausable__AlreadyPaused();
    error Pausable__AlreadyUnpaused();
    error Pausable__NoZeroAddress(address account);

    /**
     * @dev Modifier to make a function callable only when the contract is not paused.
     */
    modifier whenNotPaused() {
        if (paused) revert Pausable__Paused();
        _;
    }

    /**
     * @dev throws if called by any account other than the pauser
     */
    modifier onlyPauser() {
        if (msg.sender != _pauser) revert Pausable__NotPauser();
        _;
    }

    /**
     * @notice Returns current pauser
     * @return Pauser's address
     */
    function getPauser() external view returns (address) {
        return _pauser;
    }

    /**
     * @dev called by the owner to pause, triggers stopped state
     */
    function pause() external onlyPauser {       
        if (paused) revert Pausable__AlreadyPaused();
        paused = true;
        emit Paused();
    }

    function initPaused() public onlyInitializing {
        paused = false;
    }

    /**
     * @dev called by the owner to unpause, returns to normal state
     */
    function unpause() external onlyPauser {
        if (!paused) revert Pausable__AlreadyUnpaused();
        paused = false;
        emit Unpaused();
    }

    /**
     * @dev update the pauser role
     */
    function updatePauser(address _newPauser) external onlyPermissionAdmin {
        if (_newPauser == address(0)) revert Pausable__NoZeroAddress(_newPauser);
        _pauser = _newPauser;
        emit PauserChanged(_pauser);
    }
}
