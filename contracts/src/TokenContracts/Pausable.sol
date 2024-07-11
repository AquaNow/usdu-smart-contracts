// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

import {PermissionAdmin} from "./PermissionAdmin.sol";

/**
 * @title Pausable
 * @notice Base contract which allows children to implement an emergency stop mechanism.
 * @dev Inherits from PermissionAdmin to manage pauser permissions.
 */
contract Pausable is PermissionAdmin {
    address internal _pauser;
    bool public paused;

    /// @notice Emitted when the contract is paused.
    event Paused();

    /// @notice Emitted when the contract is unpaused.
    event Unpaused();

    /// @notice Emitted when the pauser is changed.
    /// @param newPauser The address of the new pauser.
    event PauserChanged(address indexed newPauser);

    /// @notice Error thrown when trying to perform an action while the contract is paused.
    error Pausable__Paused();

    /// @notice Error thrown when the caller is not the pauser.
    error Pausable__CallerNotPauser();

    /// @notice Error thrown when trying to pause the contract when it is already paused.
    error Pausable__AlreadyPaused();

    /// @notice Error thrown when trying to unpause the contract when it is not paused.
    error Pausable__AlreadyUnpaused();

    /// @notice Error thrown when trying to set the pauser to the zero address.
    /// @param account The address that was attempted to be set as the pauser.
    error Pausable__NoZeroAddress(address account);

    /**
     * @dev Modifier to make a function callable only when the contract is not paused.
     */
    modifier whenNotPaused() {
        if (paused) revert Pausable__Paused();
        _;
    }

    /**
     * @dev Modifier to make a function callable only by the pauser.
     */
    modifier onlyPauser() {
        if (msg.sender != _pauser) revert Pausable__CallerNotPauser();
        _;
    }

    /**
     * @notice Returns the current pauser.
     * @return The address of the current pauser.
     */
    function getPauser() external view returns (address) {
        return _pauser;
    }

    /**
     * @notice Called by the pauser to pause the contract, triggering the stopped state.
     * @dev Emits a {Paused} event.
     * @dev Can only be called by the current pauser.
     */
    function pause() external onlyPauser {
        if (paused) revert Pausable__AlreadyPaused();
        paused = true;
        emit Paused();
    }

    /**
     * @notice Initializes the contract in an unpaused state.
     * @dev This function should be called during contract initialization.
     */
    function initializePausable() public onlyInitializing {
        paused = false;
    }

    /**
     * @notice Called by the pauser to unpause the contract, returning to normal state.
     * @dev Emits an {Unpaused} event.
     * @dev Can only be called by the current pauser.
     */
    function unpause() external onlyPauser {
        if (!paused) revert Pausable__AlreadyUnpaused();
        paused = false;
        emit Unpaused();
    }

    /**
     * @notice Updates the pauser role to a new address.
     * @param _newPauser The address of the new pauser.
     * @dev Emits a {PauserChanged} event.
     * @dev Can only be called by the permission admin.
     * @dev The new pauser address cannot be the zero address.
     */
    function updatePauser(address _newPauser) external onlyPermissionAdmin {
        if (_newPauser == address(0)) revert Pausable__NoZeroAddress(_newPauser);
        _pauser = _newPauser;
        emit PauserChanged(_pauser);
    }

    // Storage Gap for future upgrades
    uint256[49] private __gap;
}
