// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {PermissionAdmin} from "./PermissionAdmin.sol";

/**
 * @title Rescuable
 * @notice Contract that allows rescuing ERC20 tokens locked up in this contract by a "rescuer" role.
 * @dev Inherits from PermissionAdmin to manage rescuer permissions.
 */
abstract contract Rescuable is PermissionAdmin {
    using SafeERC20 for IERC20;

    address internal _rescuer;

    /// @notice Error thrown when the caller is not the rescuer.
    error Rescuable__CallerNotRescuer();

    /// @notice Error thrown when trying to set the rescuer to the zero address.
    /// @param value The address that was attempted to be set as the rescuer.
    error Rescuable__NoZeroAddress(address value);

    /// @notice Emitted when the rescuer is changed.
    /// @param newRescuer The address of the new rescuer.
    event RescuerChanged(address indexed newRescuer);

    /**
     * @notice Returns the current rescuer.
     * @return The address of the current rescuer.
     */
    function rescuer() external view returns (address) {
        return _rescuer;
    }

    /**
     * @dev Modifier to make a function callable only by the rescuer.
     */
    modifier onlyRescuer() {
        if (msg.sender != _rescuer) revert Rescuable__CallerNotRescuer();
        _;
    }

    /**
     * @notice Rescue ERC20 tokens locked up in this contract.
     * @param tokenContract The address of the ERC20 token contract.
     * @param to The recipient address to receive the rescued tokens.
     * @param amount The amount of tokens to withdraw.
     * @dev Can only be called by the current rescuer.
     */
    function rescueERC20(
        IERC20 tokenContract,
        address to,
        uint256 amount
    ) external onlyRescuer {
        tokenContract.safeTransfer(to, amount);
    }

    /**
     * @notice Assign the rescuer role to a given address.
     * @param newRescuer The address of the new rescuer.
     * @dev Emits a {RescuerChanged} event.
     * @dev Can only be called by the permission admin.
     * @dev The new rescuer address cannot be the zero address.
     */
    function updateRescuer(address newRescuer) external onlyPermissionAdmin {
        if (newRescuer == address(0)) revert Rescuable__NoZeroAddress(newRescuer);
        _rescuer = newRescuer;
        emit RescuerChanged(newRescuer);
    }

    // Storage Gap for future upgrades
    uint256[49] private __gap;
}
