// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

import {PermissionAdmin} from "./PermissionAdmin.sol";

/**
 * @title Blacklistable
 * @notice Contract that allows accounts to be blacklisted by a "blacklister" role.
 * @dev Inherits from PermissionAdmin to manage blacklister permissions.
 */
contract Blacklistable is PermissionAdmin {
    address internal _blacklister;
    mapping(address => bool) public blacklisted;

    /// @notice Emitted when an account is blacklisted.
    /// @param _account The address of the blacklisted account.
    event Blacklisted(address indexed _account);

    /// @notice Emitted when an account is removed from the blacklist.
    /// @param _account The address of the unblacklisted account.
    event UnBlacklisted(address indexed _account);

    /// @notice Emitted when the blacklister is changed.
    /// @param newBlacklister The address of the new blacklister.
    event BlacklisterChanged(address indexed newBlacklister);

    /// @notice Error thrown when the caller is not the blacklister.
    error Blacklistable__CallerNotBlacklister();

    /// @notice Error thrown when trying to set the blacklister to the zero address.
    error Blacklistable__NoZeroAddress();

    /// @notice Error thrown when the account is already blacklisted.
    /// @param account The address that is already blacklisted.
    error Blacklistable__AccountBlacklisted(address account);

    /// @notice Error thrown when trying to blacklist an account that is already blacklisted.
    /// @param account The address that is already blacklisted.
    error Blacklistable__AlreadyBlacklisted(address account);

    /// @notice Error thrown when the blacklister tries to blacklist themselves.
    error Blacklistable__BlacklisterSelfBlacklist();

    /// @notice Error thrown when trying to unblacklst an address that is already non blacklisted.
    error Blacklistable__NotBlacklisted(address account);

    /**
     * @dev Modifier to make a function callable only by the blacklister.
     */
    modifier onlyBlacklister() {
        if (msg.sender != _blacklister) revert Blacklistable__CallerNotBlacklister();
        _;
    }

    /**
     * @dev Modifier to make a function callable only if the blacklister is set and the account is not blacklisted.
     * @param _account The address to check.
     */
    modifier notBlacklisted(address _account) {
        if (_blacklister == address(0)) revert Blacklistable__NoZeroAddress();
        if (blacklisted[_account]) revert Blacklistable__AccountBlacklisted(_account);
        _;
    }

    /**
     * @notice Returns the current blacklister.
     * @return The address of the current blacklister.
     */
    function getBlacklister() external view returns (address) {
        return _blacklister;
    }

    /**
     * @notice Checks if an account is blacklisted.
     * @param _account The address to check.
     * @return True if the account is blacklisted, false otherwise.
     */
    function isBlacklisted(address _account) external view returns (bool) {
        return blacklisted[_account];
    }

    /**
     * @notice Adds an account to the blacklist.
     * @param _account The address to blacklist.
     * @dev Emits a {Blacklisted} event.
     * @dev Can only be called by the current blacklister.
     * @dev The address cannot be the zero address or the blacklister's own address.
     */
    function blacklist(address _account) external onlyBlacklister {
        if (blacklisted[_account]) revert Blacklistable__AlreadyBlacklisted(_account);
        if (_account == _blacklister) revert Blacklistable__BlacklisterSelfBlacklist();
        if (_account == address(0)) revert Blacklistable__NoZeroAddress();
        blacklisted[_account] = true;
        emit Blacklisted(_account);
    }

    /**
     * @notice Removes an account from the blacklist.
     * @param _account The address to remove from the blacklist.
     * @dev Emits an {UnBlacklisted} event.
     * @dev Can only be called by the current blacklister.
     */
    function unBlacklist(address _account) external onlyBlacklister {
         if (!blacklisted[_account]) revert Blacklistable__NotBlacklisted(_account);
        blacklisted[_account] = false;
        emit UnBlacklisted(_account);
    }

    /**
     * @notice Updates the blacklister role to a new address.
     * @param _newBlacklister The address of the new blacklister.
     * @dev Emits a {BlacklisterChanged} event.
     * @dev Can only be called by the permission admin.
     * @dev The new blacklister address cannot be the zero address.
     */
    function updateBlacklister(address _newBlacklister) external onlyPermissionAdmin {
        if (_newBlacklister == address(0)) revert Blacklistable__NoZeroAddress();
        _blacklister = _newBlacklister;
        emit BlacklisterChanged(_blacklister);
    }

    // Storage Gap for future upgrades
    uint256[49] private __gap;
}
